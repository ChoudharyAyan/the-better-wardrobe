// Wardrobe import channels that turn pictures into review cards: order-history screenshots,
// an Instagram data export, Google Photos picks and camera shots. Every result lands in
// the app's existing import review, so nothing is saved without the user ticking it.
(()=>{
// null means "not clothing" and must survive: `?? 'unknown'` would turn it into "unclear".
const classify=(...t)=>window.OrderImport?window.OrderImport.classify(...t):'unknown';
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

// People scroll and screenshot with overlap, so the same order often appears twice. Items match on
// brand + name + date; within one screenshot, two identical lines (two pairs from one order) stay two.
// Pure so it can be tested: pages are [{image,retailer,items}] straight from the orders action.
const orderKey=it=>[it.brand,it.name,it.date].join('|').toLowerCase().replace(/[^a-z0-9|]+/g,'');
const stem=name=>String(name||'').replace(/(\.\.\.|…)\s*$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
function sameOrder(a,b){
 if(!a||!b||String(a.brand).toLowerCase()!==String(b.brand).toLowerCase())return false;
 if(a.date&&b.date&&a.date!==b.date)return false;
 const x=stem(a.name),y=stem(b.name);
 return Math.min(x.length,y.length)>=8&&(x.startsWith(y)||y.startsWith(x));
}
function mergeScreenshots(pages){
 const byKey=new Map();let skipped=0;
 for(const {image,retailer,items} of pages){
  const here=new Map();
  for(const it of items){
   if(it.status==='returned'||it.status==='cancelled'){skipped++;continue;}
   // The thumbnail-based type rescues names the app truncated ("Peter England Casualss Men Ski…").
   const category=classify(it.type,it.name);
   if(!category){skipped++;continue;}
   const key=orderKey(it);if(!here.has(key))here.set(key,[]);here.get(key).push({...it,category,image,retailer});
  }
  for(const [key,group] of here){
   // Apps truncate long names ("Men Strip…") and a scrolled-off header can hide the date, so fall back to
   // a same-brand entry whose name is a prefix of this one (or vice versa) with a compatible date.
   const fuzzy=byKey.has(key)?key:[...byKey.keys()].find(k=>sameOrder(byKey.get(k)[0],group[0]));
   const kept=byKey.get(fuzzy)||[];if(fuzzy&&fuzzy!==key){byKey.delete(fuzzy);if(!kept[0].date&&group[0].date)kept.forEach(x=>x.date=group[0].date);if(stem(group[0].name).length>stem(kept[0].name).length)kept.forEach(x=>x.name=group[0].name);}
   group.forEach((it,n)=>{const prev=kept[n];if(prev){prev.price??=it.price;prev.size||=it.size;prev.crop||=it.crop;}else kept.push(it);});
   byKey.set(key,kept);
  }
 }
 return {entries:[...byKey.values()].flat(),skipped};
}

// Order-history screenshots: one vision call per screenshot, then each product thumbnail is cropped on the phone.
// A screenshot that times out is skipped and reported, not allowed to sink the whole batch.
async function screenshots(files,progress=()=>{}){
 const list=imageFiles(files).slice(0,10),pages=[];let failed=0,lastError=null;
 if(!list.length)throw new Error('Choose PNG or JPG screenshots of your orders.');
 for(const [i,file] of list.entries()){
  progress(`Reading screenshot ${i+1} of ${list.length}…`);
  try{const image=await toDataUrl(file);const r=await post('orders',{image});pages.push({image,retailer:r.retailer,items:r.items});}
  catch(e){if(e.status===429||e.unconfigured)throw e;failed++;lastError=e;}
 }
 if(!pages.length)throw lastError;
 const {entries,skipped}=mergeScreenshots(pages),items=[];
 for(const it of entries){
  const unclear=it.category==='unknown'||it.category==='innerwear';
  items.push({id:'shot-'+crypto.randomUUID(),name:it.name,brand:it.brand,size:it.size,color:it.colour,price:it.price,priceFromScreenshot:it.price!=null,orderedAt:it.date||null,
   category:unclear?'Accessories':it.category,image:it.crop?await crop(it.image,it.crop):'',retailer:it.retailer||'',
   selected:!unclear&&it.status!=='in_progress',warning:it.status==='in_progress'?'Not delivered yet · select once it arrives.':unclear?'Category unclear · check before saving.':''});
 }
 return {items,skipped,failed};
}

// Outfit photos (Instagram, Google Photos, camera): detect each garment, crop it, name it.
// Each image is a src string, or {src,focus} where focus is the point the user tapped on themselves.
async function pieces(images,progress=()=>{}){
 const items=[];let empty=0,manual=0;
 for(const [i,entry] of images.entries()){
  const src=typeof entry==='string'?entry:entry.src,focus=typeof entry==='string'?null:entry.focus;
  progress(`Finding clothes in photo ${i+1} of ${images.length}…`);
  const image=src.startsWith('data:')?src:await toDataUrl(await (await fetch(src)).blob());
  let found=[];
  try{found=(await post('detect',focus?{image,focus}:{image})).items||[];}
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
 const cd=new DataView(await file.slice(offset,offset+size).arrayBuffer()),decoder=new TextDecoder(),photos=[],indexes=[];
 for(let p=0,n=0;n<count&&p+46<=cd.byteLength;n++){
  if(cd.getUint32(p,true)!==0x02014b50)break;
  const method=cd.getUint16(p+10,true),compressed=cd.getUint32(p+20,true),nameLen=cd.getUint16(p+28,true),extraLen=cd.getUint16(p+30,true),commentLen=cd.getUint16(p+32,true),local=cd.getUint32(p+42,true);
  const name=decoder.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nameLen));
  p+=46+nameLen+extraLen+commentLen;
  if(method!==0&&method!==8)continue;
  const read=async()=>{
   const head=new DataView(await file.slice(local,local+30).arrayBuffer());
   const start=local+30+head.getUint16(26,true)+head.getUint16(28,true),raw=file.slice(start,start+compressed);
   return method===0?raw:new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
  };
  // Only the user's own posts and stories. The export also carries DMs (messages/inbox/…) with
  // other people's photos; those are never listed or opened.
  if(/(^|\/)media\/(posts|archived_posts|stories)\/.+\.(jpe?g|png|webp)$/i.test(name))
   photos.push({name,load:async()=>URL.createObjectURL(new Blob([await read()],{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg'}))});
  else if(/(^|\/)(your_instagram_activity\/)?(media|content)\/[^/]+\.json$/i.test(name)&&compressed<5_000_000)indexes.push(read);
 }
 if(!photos.length)throw new Error('No photos found. Export your Instagram information with Posts selected.');
 // Exports don't always use YYYYMM folders (posts can sit directly in media/posts/), and ZIP file
 // dates are the export date. posts_1.json / stories.json list each uri with its creation_timestamp.
 const taken=new Map();
 const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(typeof v.uri==='string'&&Number.isFinite(v.creation_timestamp))taken.set(v.uri,v.creation_timestamp);Object.values(v).forEach(walk);}};
 for(const read of indexes){try{walk(JSON.parse(await (await read()).text()));}catch{}}
 const when=p=>taken.get(p.name)??taken.get(p.name.replace(/^.*?(media\/)/,'$1'))??Number(p.name.match(/\/(\d{4})(\d{2})\//)?.slice(1).join('')||0)/1e3;
 return photos.sort((a,b)=>when(b)-when(a)||b.name.localeCompare(a.name));
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

window.Importers={screenshots,mergeScreenshots,pieces,instagramPhotos,google,toDataUrl,imageFiles};
})();
