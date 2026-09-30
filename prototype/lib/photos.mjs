// Ephemeral, user-selected Google Photos import. No token or image persistence.
export function createPhotos({env=process.env,fetchImpl=fetch}={}) {
 const fail=(status,message)=>Object.assign(new Error(message),{status});
 async function request(url,token,method='GET',body){
  const response=await fetchImpl(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fail(response.status===401?401:502,response.status===401?'Google Photos access expired. Connect again.':'Google Photos could not complete the request. Try again.');
  return response;
 }
 async function json(path,token,method='GET',body){const response=await request('https://photospicker.googleapis.com/v1/'+path,token,method,body);return response.status===204?{}:response.json();}
 return {
 config:()=>({googleClientId:env.GOOGLE_PHOTOS_CLIENT_ID||'',instagram:'professional-only-not-connected'}),
 async run(action,body,token){
  if(!env.GOOGLE_PHOTOS_CLIENT_ID)throw fail(503,'Google Photos is not configured. Choose device photos instead.');
  if(typeof token!=='string'||!token||token.length>4096||/[\r\n]/.test(token))throw fail(401,'Google Photos sign-in is required.');
  // Style references keep the original six; a wardrobe import may ask for up to twenty.
  const limit=Math.min(20,Math.max(1,Math.floor(Number(body?.max))||6));
  if(action==='create'){
   const session=await json('sessions',token,'POST',{pickingConfig:{maxItemCount:String(limit)}});
   const url=new URL(session.pickerUri);if(url.protocol!=='https:'||url.hostname!=='photos.google.com')throw fail(502,'Unexpected Google picker address.');
   return {id:session.id,pickerUri:session.pickerUri,pollingConfig:session.pollingConfig};
  }
  if(!/^[a-zA-Z0-9_-]{1,256}$/.test(body?.sessionId||''))throw fail(400,'Invalid photo session.');
  const id=encodeURIComponent(body.sessionId);
  if(action==='delete'){await json('sessions/'+id,token,'DELETE');return {ok:true};}
  if(action!=='collect')throw fail(404,'Unknown photo action.');
  const session=await json('sessions/'+id,token);
  if(!session.mediaItemsSet)return {ready:false,pollingConfig:session.pollingConfig};
  const items=[];let pageToken='',pages=0;
  do {const page=await json('mediaItems?sessionId='+id+'&pageSize=100'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''),token);items.push(...(page.mediaItems||[]).filter(x=>x.type==='PHOTO'));pageToken=page.nextPageToken||'';}while(pageToken&&items.length<limit&&++pages<3);
  const images=[];
  for(const item of items.slice(0,limit)){
   const url=new URL(item.mediaFile?.baseUrl||'https://invalid.local');
   if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)googleusercontent\.com$/.test(url.hostname))continue;
   // Twenty wardrobe photos at 640px stay under Vercel's 4.5 MB response cap; detection resizes anyway.
   const response=await request(url.href+(limit>6?'=w640-h640':'=w1200-h1200'),token);
   const type=response.headers.get('content-type')?.split(';')[0];
   if(!['image/jpeg','image/png','image/webp'].includes(type))continue;
   const parts=[];let size=0;
   for await(const part of response.body){size+=part.length;if(size>2_000_000)throw fail(413,'A selected image is too large. Choose a smaller photo.');parts.push(part);}
   images.push({dataUrl:'data:'+type+';base64,'+Buffer.concat(parts).toString('base64')});
  }
  return {ready:true,images};
 }
 };
}
