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
  if(action==='create'){
   const session=await json('sessions',token,'POST',{pickingConfig:{maxItemCount:'6'}});
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
  do {const page=await json('mediaItems?sessionId='+id+'&pageSize=100'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''),token);items.push(...(page.mediaItems||[]).filter(x=>x.type==='PHOTO'));pageToken=page.nextPageToken||'';}while(pageToken&&items.length<6&&++pages<3);
  const images=[];
  for(const item of items.slice(0,6)){
   const url=new URL(item.mediaFile?.baseUrl||'https://invalid.local');
   if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)googleusercontent\.com$/.test(url.hostname))continue;
   const response=await request(url.href+'=w1200-h1200',token);
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
