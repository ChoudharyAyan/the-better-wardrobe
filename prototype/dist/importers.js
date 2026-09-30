// Wardrobe import channels that turn pictures into review cards: order-history screenshots,
// an Instagram data export, Google Photos picks and camera shots. Every result lands in
// the app's existing import review, so nothing is saved without the user ticking it.
(()=>{
const classify=(...t)=>window.OrderImport?.classify(...t)??'unknown';
const title=s=>String(s||'').trim().replace(/^\w/,c=>c.toUpperCase());
const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];

async function post(action,body){
 const r=await fetch('/api/discover/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){
  // Discover's server messages talk about crops; imports need their own wording.
  // A missing key is permanent (fall back to naming by hand); an overloaded model is not.
  const unconfigured=r.status===503&&/API key/i.test(data.error||'');
  const message=unconfigured?'Photo reading is not set up on this server yet.':r.status===429?'Photo reading has hit its limit for now. Try again later.':r.status>=500?'Our photo reader is busy right now. Try again in a minute.':data.error||'That did not work. Try again.';
  throw Object.assign(new Error(message),{status:r.status,unconfigured});
 }
 return data;
}
async function loadImage(src){const img=new Image();img.src=src;await img.decode();return img;}
function draw(img,sx,sy,sw,sh,max,quality=.85){
 const scale=Math.min(1,max/Math.max(sw,sh)),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
 c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
 return c.toDataURL('image/jpeg',quality);
}
// Phone screenshots and camera shots are several MB; vision only needs ~1600px on the long side.
async function toDataUrl(blob,max=1600){const url=URL.createObjectURL(blob);try{const img=await loadImage(url);return draw(img,0,0,img.naturalWidth,img.naturalHeight,max);}finally{URL.revokeObjectURL(url);}}
async function crop(dataUrl,c,max=700){
 const img=await loadImage(dataUrl),W=img.naturalWidth,H=img.naturalHeight;
 const x=Math.max(0,W*c.left/100),y=Math.max(0,H*c.top/100),w=Math.min(W-x,W*c.width/100),h=Math.min(H-y,H*c.height/100);
 return draw(img,x,y,w,h,max,.9);
}
const imageFiles=files=>[...files].filter(f=>IMAGE_TYPES.includes(f.type)&&f.size<=15*1024*1024);

// Order-history screenshots: one vision call per screenshot, then each product thumbnail is cropped on the phone.
async function screenshots(files,progress=()=>{}){
 const list=imageFiles(files).slice(0,10),items=[];let skipped=0;
 if(!list.length)throw new Error('Choose PNG or JPG screenshots of your orders.');
 for(const [i,file] of list.entries()){
  progress(`Reading screenshot ${i+1} of ${list.length}…`);
  const image=await toDataUrl(file);
  const {retailer,items:found}=await post('orders',{image});
  for(const it of found){
   if(it.status==='returned'||it.status==='cancelled'){skipped++;continue;}
   const category=classify(it.name);
   if(!category){skipped++;continue;}
   const unclear=category==='unknown'||category==='innerwear';
   items.push({id:'shot-'+crypto.randomUUID(),name:it.name,brand:it.brand,size:it.size,color:it.colour,price:it.price,priceFromScreenshot:it.price!=null,orderedAt:it.date||null,
    category:unclear?'Accessories':category,image:it.crop?await crop(image,it.crop):'',retailer:retailer||'',
    selected:!unclear&&it.status!=='in_progress',warning:it.status==='in_progress'?'Not delivered yet · select once it arrives.':unclear?'Category unclear · check before saving.':''});
  }
 }
 return {items,skipped};
}

// Outfit photos (Instagram, Google Photos, camera): detect each garment, crop it, name it.
async function pieces(images,progress=()=>{}){
 const items=[];let empty=0,manual=0;
 for(const [i,src] of images.entries()){
  progress(`Finding clothes in photo ${i+1} of ${images.length}…`);
  const image=src.startsWith('data:')?src:await toDataUrl(await (await fetch(src)).blob());
  let found=[];
  try{found=(await post('detect',{image})).items||[];}
  catch(e){
   // No vision provider (or quota hit): keep the photo so the user can name it by hand.
   if(e.unconfigured){manual++;items.push({id:'photo-'+crypto.randomUUID(),name:'',category:'Shirts',image,selected:false,warning:'Automatic detection is unavailable · name this piece to keep it.'});continue;}
   throw e;
  }
  if(!found.length){empty++;continue;}
  for(const f of found){
   const category=classify(f.label);
   if(!category)continue;
   const unclear=category==='unknown'||category==='innerwear';
   items.push({id:'photo-'+crypto.randomUUID(),name:title(f.label),category:unclear?'Accessories':category,image:await crop(image,f.crop),selected:!unclear,warning:unclear?'Category unclear · check before saving.':''});
  }
 }
 return {items,empty,manual};
}

// Instagram "Download your information" ZIP, read in the browser with the native
// DecompressionStream: only the central directory and chosen photos are ever loaded.
async function instagramPhotos(file){
 const tailLen=Math.min(file.size,65557),tail=new DataView(await file.slice(file.size-tailLen).arrayBuffer());
 let eocd=-1;for(let i=tailLen-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('That file is not a ZIP. Choose the file Instagram sent you.');
 const count=tail.getUint16(eocd+10,true),size=tail.getUint32(eocd+12,true),offset=tail.getUint32(eocd+16,true);
 if(offset===0xffffffff||size===0xffffffff)throw new Error('This export is too large to open here. Request it again with Media quality: Low.');
 const cd=new DataView(await file.slice(offset,offset+size).arrayBuffer()),decoder=new TextDecoder(),photos=[];
 for(let p=0,n=0;n<count&&p+46<=cd.byteLength;n++){
  if(cd.getUint32(p,true)!==0x02014b50)break;
  const method=cd.getUint16(p+10,true),compressed=cd.getUint32(p+20,true),nameLen=cd.getUint16(p+28,true),extraLen=cd.getUint16(p+30,true),commentLen=cd.getUint16(p+32,true),local=cd.getUint32(p+42,true);
  const name=decoder.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nameLen));
  p+=46+nameLen+extraLen+commentLen;
  if(!/(^|\/)media\/(posts|archived_posts|stories)\/.+\.(jpe?g|png|webp)$/i.test(name)||(method!==0&&method!==8))continue;
  photos.push({name,load:async()=>{
   const head=new DataView(await file.slice(local,local+30).arrayBuffer());
   const start=local+30+head.getUint16(26,true)+head.getUint16(28,true),raw=file.slice(start,start+compressed);
   const blob=method===0?raw:await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
   return URL.createObjectURL(new Blob([blob],{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg'}));
  }});
 }
 if(!photos.length)throw new Error('No photos found. Export your Instagram information with Posts selected.');
 // Folder names are YYYYMM, so a reverse sort puts the newest posts first.
 return photos.sort((a,b)=>b.name.localeCompare(a.name));
}

// Google Photos Picker via the existing /api/photos adapter. Opening the picker must come
// from a tap, so connect() returns the picker link and wait() polls until photos are chosen.
const google={token:'',session:null,
 async api(action,body={}){const r=await fetch('/api/photos/'+action,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+this.token},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Google Photos could not connect. Try again.');return data;},
 async connect(max=20){
  const config=await (await fetch('/api/photos/config')).json();
  if(!config.googleClientId)throw new Error('Google Photos is not set up on this server yet. Use the camera or your gallery instead.');
  if(!window.google?.accounts?.oauth2)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>reject(new Error('Google sign-in could not load.'));document.head.append(s);});
  this.token=await new Promise((resolve,reject)=>window.google.accounts.oauth2.initTokenClient({client_id:config.googleClientId,scope:'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',callback:r=>r.access_token?resolve(r.access_token):reject(new Error('Google sign-in was closed.')),error_callback:()=>reject(new Error('Google sign-in was closed.'))}).requestAccessToken());
  this.session=await this.api('create',{max});
  return this.session.pickerUri;
 },
 async wait(max=20,signal){
  const until=Date.now()+15*60000;
  try{
   while(Date.now()<until&&!signal?.aborted){
    await new Promise(r=>setTimeout(r,Math.max(2000,parseFloat(this.session.pollingConfig?.pollInterval||'5')*1000)));
    const result=await this.api('collect',{sessionId:this.session.id,max});
    if(result.ready)return result.images.map(i=>i.dataUrl);
    if(result.pollingConfig)this.session.pollingConfig=result.pollingConfig;
   }
   throw new Error('Google Photos timed out. Start again when you are ready.');
  }finally{this.api('delete',{sessionId:this.session.id}).catch(()=>{});this.session=null;this.token='';}
 }
};

window.Importers={screenshots,pieces,instagramPhotos,google,toDataUrl,imageFiles};
})();
