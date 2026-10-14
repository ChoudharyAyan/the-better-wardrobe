import {createStyleMe} from './lib/style-me.mjs';
import http from 'node:http';
import {createPhotos} from './lib/photos.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createDiscovery,ApiError,modelKey,safeURL} from './lib/discovery.mjs';
import {createCredits} from './lib/credits.mjs';
import {createChats} from './lib/chats.mjs';
import {createAccounts,departmentFor} from './lib/accounts.mjs';
import {lookCards} from './lib/looks.mjs';
import {randomBytes} from 'node:crypto';
import {createQaStore} from './lib/qa.mjs';
import {createConnectorStore,STORES} from './lib/connectors.mjs';
import {readFeed} from './lib/mall-feed.mjs';
import {createCommunity} from './lib/community.mjs';
import {createWardrobe,productFromPage} from './lib/wardrobe.mjs';
import {createCutout} from './lib/cutout.mjs';
import {createInbox} from './lib/inbox.mjs';
import {retailerPage} from './lib/discovery.mjs';
import mallSnapshot from './dist/assets/mall-updates.json' with {type:'json'};
import {createLookPhotos} from './lib/look-photos.mjs';
// The phone app's id; its sign-in link is APP_SCHEME://auth (mobile/android AndroidManifest.xml).
const APP_SCHEME='com.thewardrobeos.app';
try{process.loadEnvFile(fileURLToPath(new URL('./.env',import.meta.url)));}catch(e){if(e.code!=='ENOENT')throw e;}
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
// The bare (req,res) listener is what Vercel's Node runtime invokes; createServer wraps it for local runs.
export function createHandler(discovery=createDiscovery(),qaStore=createQaStore(),photos=createPhotos(),connectors=createConnectorStore(),community=createCommunity(),credits=createCredits(),chats=createChats(),accounts=createAccounts(),wardrobe=createWardrobe(),cutout=createCutout(),pageFetcher=retailerPage,inbox=createInbox(),styleMe=createStyleMe(),lookPhotos=createLookPhotos()){
// Wardrobe AI (cutouts, link reading) per guest per hour: a backstop on a shared preview, generous
// enough for a 100-piece first import. Per instance, like Discover's hourly cap.
const wardrobeUse=new Map();
const wardrobeAllowance=who=>{const hour=Math.floor(Date.now()/3600000),key=who+'|'+hour,n=(wardrobeUse.get(key)||0)+1;if(wardrobeUse.size>5000)wardrobeUse.clear();wardrobeUse.set(key,n);return n<=Number(process.env.WARDROBE_GUEST_HOURLY||400);};
return async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname.startsWith('/api/')){
 if(pathname.startsWith('/api/community')){
  if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open the app to use Community.'});
  const origin=String(req.headers.origin||'');
  if(origin){let parsed;try{parsed=new URL(origin);}catch{return send(403,{error:'Invalid origin.'});}if(parsed.host!==req.headers.host)return send(403,{error:'Open the app to use Community.'});}
  let body={};
  if(req.method==='POST'){
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
   let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1_500_000)return send(413,{error:'Request too large'});chunks.push(chunk);}
   try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'Invalid JSON'});}
   if(!body||typeof body!=='object'||Array.isArray(body))return send(400,{error:'Invalid request'});
  }
  const result=await community.handle(req,pathname,body);
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...result.headers});return res.end(JSON.stringify(result.data));
 }
 if(req.method==='GET'&&pathname==='/api/mall/updates'){
  const feed=await readFeed();
  return send(200,feed.generatedAt?feed:mallSnapshot);
 }
 // Store connectors: local development only (ORDER_CONNECTORS=true, never on Vercel, localhost only).
 if(pathname.startsWith('/api/connectors/')){
  const host=String(req.headers.host||'').replace(/^\[|\](?=:|$)/g,'').split(':')[0];
  if(!connectors.enabled||!['localhost','127.0.0.1','::1'].includes(host))return send(404,{error:'Not found'});
  const origin=String(req.headers.origin||'');
  if(req.method==='POST'&&pathname==='/api/connectors/import'){
   // Only the extension's service worker (or a non-browser client) may submit; a web page may not.
   if(origin&&!origin.startsWith('chrome-extension://'))return send(403,{error:'Forbidden'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
   let size=0,parts=[];for await(const part of req){size+=part.length;if(size>5_000_000)return send(413,{error:'Import too large'});parts.push(part);}
   let body;try{body=JSON.parse(Buffer.concat(parts).toString());}catch{return send(400,{error:'Invalid JSON'});}
   if(!STORES.includes(body?.store))return send(400,{error:'Unknown store.'});
   await connectors.put(body.store,body.data);return send(200,{ok:true});
  }
  if(req.headers['sec-fetch-site']==='cross-site'||(origin&&new URL(origin).host!==req.headers.host))return send(403,{error:'Forbidden'});
  if(req.method==='GET'&&pathname==='/api/connectors/status')return send(200,{enabled:true,batches:await connectors.list()});
  const store=pathname.match(/^\/api\/connectors\/batch\/([a-z]+)$/)?.[1];
  if(store&&STORES.includes(store)){
   if(req.method==='GET'){const batch=await connectors.get(store);return batch?send(200,batch):send(404,{error:'No orders imported yet.'});}
   if(req.method==='DELETE'){await connectors.clear(store);return send(200,{ok:true});}
  }
  return send(404,{error:'Not found'});
 }
 if(req.method==='GET'&&pathname==='/api/photos/config')return send(200,photos.config());
 if(pathname.startsWith('/api/photos/')){
  if(req.method!=='POST')return send(405,{error:'POST required'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))return send(403,{error:'Open the app to import photos.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
  let size=0,parts=[];for await(const part of req){size+=part.length;if(size>8192)return send(413,{error:'Request too large'});parts.push(part);}
  let body;try{body=JSON.parse(Buffer.concat(parts).toString())}catch{return send(400,{error:'Invalid JSON'});}
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  try{return send(200,await photos.run(pathname.split('/').pop(),body,token));}catch(e){return send(e.status||502,{error:e.status?e.message:'Google Photos could not connect. Please retry.'});}
 }

 // One anonymous guest identity for Community XP and Discover credits.
 const secure=req.socket?.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':'';
 const cookies=[];const setCookie=c=>{cookies.push(c);res.setHeader('Set-Cookie',cookies);};
 const cookie=name=>String(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'))?.[1]||'';
 let guestId='';const guest=()=>{if(guestId)return guestId;const token=cookie('tbw_community');if(/^[a-f0-9]{48}$/.test(token))return guestId=token;guestId=randomBytes(24).toString('hex');setCookie(`tbw_community=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);return guestId;};
 // Signed-in account (Google, or a preview profile while Google isn't configured).
 const accountId=accounts.readSession(cookie('tbw_session'));
 const startSession=id=>setCookie(`tbw_session=${accounts.session(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*86400}${secure}`);
 const sameSite=()=>req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||(()=>{try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}})());
 // Sign-in returns to the domain the person is on (app.thewardrobeos.com or the vercel.app URL), so the session
 // cookie lands where they are. Only hosts we serve are trusted; anything else falls back to PUBLIC_BASE_URL.
 const origin=()=>{const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim().toLowerCase();if(/^(app\.thewardrobeos\.com|thewardrobeos\.com|www\.thewardrobeos\.com|the-better-wardrobe\.vercel\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?|192\.168\.\d+\.\d+(:\d+)?)$/.test(host))return `${secure||!/^(localhost|127|192)/.test(host)?'https':'http'}://${host}`;const base=process.env.PUBLIC_BASE_URL;return base?base.replace(/\/$/,''):`http://${req.headers.host}`;};
 const redirect=(location)=>{res.writeHead(302,{Location:location,'Cache-Control':'no-store'});res.end();};
 const readJson=async limit=>{if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError(415,'JSON required');let size=0,parts=[];for await(const part of req){size+=part.length;if(size>limit)throw new ApiError(413,'Request too large');parts.push(part);}let body;try{body=JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw new ApiError(400,'Invalid JSON');}if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Invalid request');return body;};
 if(pathname.startsWith('/api/style/')){
  if(!sameSite())return send(403,{error:'Open Style Me in the app.'});
  const guestOwner='guest:'+guest(),who=accountId?'account:'+accountId:guestOwner;
  if(accountId)await styleMe.migrate(guestOwner,who);
  if(pathname==='/api/style/preferences'){if(req.method==='GET')return send(200,await styleMe.preferences(who));if(req.method==='POST')return send(200,await styleMe.preferences(who,await readJson(8192)));if(req.method==='DELETE')return send(200,await styleMe.clearPreferences(who));return send(405,{error:'Method not allowed.'});}
  if(req.method==='GET'&&pathname==='/api/style/status')return send(200,styleMe.status());
  if(req.method==='GET'&&pathname==='/api/style/sessions')return send(200,{sessions:await styleMe.list(who)});
  if(req.method==='POST'&&pathname==='/api/style/sessions')return send(201,await styleMe.create(who,await readJson(16000)));
  const match=pathname.match(/^\/api\/style\/sessions\/([a-f0-9-]{36})(?:\/(generate|edit|select|freeze|fork|feedback|reference|preview)(?:\/([a-f0-9-]{36}))?)?$/);
  if(!match)return send(404,{error:'Styling operation not found.'});
  const [,id,action,jobId]=match;
  if(!action&&req.method==='GET')return send(200,await styleMe.get(who,id));
  if(!action&&req.method==='DELETE')return send(200,await styleMe.remove(who,id));
  if(action==='preview'&&jobId&&req.method==='DELETE')return send(200,await styleMe.deletePreview(who,id,jobId));
  if(req.method!=='POST'||jobId)return send(405,{error:'Method not allowed.'});
  const body=await readJson(['preview','reference','freeze'].includes(action)?4_400_000:150_000);
  if(action==='generate'){const replay=await styleMe.replay(who,id,body);if(replay)return send(200,replay);await styleMe.reserve(who,id,body);}
  const cancelled=new AbortController();res.on('close',()=>{if(!res.writableFinished)cancelled.abort();});
  let charge;
  const model='gpt-5-nano',spender={guest:guest(),ip:String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'unknown',model};
  try{
   if(action==='generate'&&styleMe.status().ai){await credits.budgetOk?.();charge=await credits.charge(spender);}
   if(action==='preview'&&styleMe.status().preview){
    const session=await styleMe.get(who,id);
    if(!session.jobs[body.jobId]){if(body.consent!==true||body.costAccepted!==true)throw new ApiError(400,'Confirm photo processing and credit cost.');charge=await credits.charge(spender);}
   }
   if(action==='reference'){if(body.consent!==true)throw new ApiError(400,'Confirm image processing before upload.');await credits.budgetOk?.();return send(200,await styleMe.reference(who,id,body,await discovery.detect({image:body.image},undefined,cancelled.signal)));}
   if(action==='generate'&&req.headers.accept==='application/x-ndjson'){
    res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'});
    const emit=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
    try{const result=await styleMe.generate(who,id,body,cancelled.signal,emit);emit({type:'result',data:result});}catch(e){if(charge)await credits.refund(spender).catch(()=>{});charge=null;emit({type:'error',status:e.status||502,error:e.status?e.message:'The stylist could not answer. Your current design is safe.'});}res.end();return;
   }
   const result=action==='preview'?await styleMe.render(who,id,body,cancelled.signal):await styleMe[action](who,id,body,cancelled.signal);
   if(action==='preview'&&result.replayed&&charge){await credits.refund(spender);charge=null;}
   return send(200,{...result,...(charge?{credits:{cost:charge.cost,remaining:charge.remaining}}:{})});
  }catch(e){if(charge)await credits.refund(spender).catch(()=>{});if(e.name==='CanvasError')return send(e.code==='STALE_REVISION'?409:400,{error:e.message,code:e.code});throw e;}finally{if(action==='generate')await styleMe.release(who,id,body.requestId).catch(()=>{});}
 }
 if(req.method==='GET'&&pathname==='/api/me'){guest();return send(200,await accounts.me(accountId));}
 if(req.method==='PUT'&&pathname==='/api/me/profile'){if(!sameSite())return send(403,{error:'Forbidden'});return send(200,{profile:await accounts.saveProfile(accountId,await readJson(8192))});}
 if(req.method==='POST'&&pathname==='/api/auth/preview'){if(!sameSite())return send(403,{error:'Forbidden'});const id=await accounts.preview(guest());startSession(id);return send(200,await accounts.me(id));}
 if(req.method==='POST'&&pathname==='/api/auth/app-exchange'){if(!sameSite())return send(403,{error:'Forbidden'});const id=accounts.appExchange(await readJson(4096));startSession(id);return send(200,await accounts.me(id));}
 if(req.method==='POST'&&pathname==='/api/auth/logout'){if(!sameSite())return send(403,{error:'Forbidden'});setCookie(`tbw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);return send(200,{ok:true});}
 if(req.method==='GET'&&pathname==='/api/auth/google'){const {url,cookie:flow}=accounts.authStart(origin()+'/api/auth/google/callback',{app:new URL(req.url,'http://localhost').searchParams.get('app')});setCookie(`tbw_oauth=${flow}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);return redirect(url);}
 if(req.method==='GET'&&pathname==='/api/auth/google/callback'){
  const q=new URL(req.url,'http://localhost').searchParams;setCookie(`tbw_oauth=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  if(q.get('error'))return redirect('/#welcome');
  const {id,onboarded,app}=await accounts.authFinish({code:q.get('code'),state:q.get('state'),cookie:cookie('tbw_oauth'),redirectUri:origin()+'/api/auth/google/callback'});
  // Started from the phone app: hand the app a one-time code through its own link; the session is made inside the app.
  if(app)return redirect(`intent://auth?code=${encodeURIComponent(accounts.appCode(id,app))}#Intent;scheme=${APP_SCHEME};package=${APP_SCHEME};end`);
  startSession(id);return redirect(onboarded?'/#discover':'/#onboarding');
 }
 // My Wardrobe (PRD NFR#2): the signed-in person's pieces, wear log and picks, kept on the server.
 if(pathname==='/api/wardrobe'||pathname.startsWith('/api/wardrobe/')){
  // Forwarded order emails arrive from the mail service, not the app, so this sits before the
  // same-site check and is guarded by the shared webhook secret instead (PRD FR#6).
  if(req.method==='POST'&&pathname==='/api/wardrobe/inbound'){
   if(!inbox.authorized(String(req.headers.authorization||''),String(req.headers['x-inbound-secret']||'')))return send(401,{error:'Not allowed'});
   await credits.budgetOk?.();
   return send(200,await inbox.receive(await readJson(4_500_000)));
  }
  if(!sameSite())return send(403,{error:'Open the app to use your wardrobe.'});
  // Photos from your own Instagram posts, fetched here so the app can find you in them on the phone (a page
  // can't read another site's pixels). Only Instagram's and Facebook's image hosts; nothing is kept.
  if(req.method==='GET'&&pathname==='/api/wardrobe/photo'){
   if(!wardrobeAllowance(guest()))return send(429,{error:'Try again in a little while.'});
   let u;try{u=new URL(new URL(req.url,'http://localhost').searchParams.get('url')||'');}catch{return send(400,{error:'Unsupported photo.'});}
   if(u.protocol!=='https:'||u.username||u.password||!/(^|\.)(cdninstagram\.com|fbcdn\.net)$/i.test(u.hostname))return send(400,{error:'Unsupported photo.'});
   const r=await fetch(u.href,{signal:AbortSignal.timeout(15000)}).catch(()=>null);
   const type=r?.headers.get('content-type')||'';
   if(!r?.ok||!/^image\//i.test(type)||!/(^|\.)(cdninstagram\.com|fbcdn\.net)$/i.test(new URL(r.url||u.href).hostname))return send(422,{error:'That photo could not be fetched.'});
   const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>8_000_000)return send(413,{error:'That photo is too large.'});
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'private, max-age=600','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  if(req.method==='POST'&&pathname==='/api/wardrobe/cutout'){
   if(!wardrobeAllowance(guest()))return send(429,{error:'Cutouts are paused for this hour. Your photos are kept as they are.'});
   await credits.budgetOk?.();
   return send(200,await cutout.cut(await readJson(4_500_000)));
  }
  if(req.method==='POST'&&pathname==='/api/wardrobe/link'){
   if(!wardrobeAllowance(guest()))return send(429,{error:'Try again in a little while.'});
   const {url}=await readJson(4096);const target=safeURL(String(url||''));
   if(!target)return send(400,{error:'Paste a product link that starts with https://'});
   let html;try{html=await pageFetcher(target);}catch{return send(422,{error:'We can read links from Myntra, AJIO, Flipkart, Amazon, Nykaa Fashion and other major Indian stores. Try a link from one of them.'});}
   const product=productFromPage(html,target);
   return product?send(200,{product}):send(422,{error:'That page does not show a product we can read. Add it with a photo instead.'});
  }
  if(req.method==='GET'&&pathname==='/api/wardrobe/status')return send(200,{signedIn:Boolean(accountId),cutouts:cutout.configured(),email:inbox.configured()});
  if(!accountId)return send(401,{error:'Sign in to keep your wardrobe on every device.',signIn:true});
  if(req.method==='GET'&&pathname==='/api/wardrobe')return send(200,await wardrobe.list(accountId));
  if(req.method==='GET'&&pathname==='/api/wardrobe/inbox')return send(200,{address:await inbox.address(accountId),items:await inbox.pending(accountId)});
  if(req.method==='POST'&&pathname==='/api/wardrobe/inbox/ack'){const {ids}=await readJson(60_000);return send(200,{removed:await inbox.ack(accountId,ids)});}
  if(req.method==='PUT'&&pathname==='/api/wardrobe/meta')return send(200,{meta:await wardrobe.putMeta(accountId,await readJson(450_000))});
  const imagePath=pathname.match(/^\/api\/wardrobe\/image\/([^/]+)$/);
  if(req.method==='GET'&&imagePath){const img=await wardrobe.image(accountId,imagePath[1]);if(!img)return send(404,{error:'Not found'});res.writeHead(200,{'Content-Type':img.type,'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(img.data);}
  const itemPath=pathname.match(/^\/api\/wardrobe\/items\/([^/]+)$/);
  if(itemPath&&req.method==='PUT')return send(200,{item:await wardrobe.putItem(accountId,itemPath[1],await readJson(1_700_000))});
  if(itemPath&&req.method==='DELETE'){await wardrobe.removeItem(accountId,itemPath[1]);return send(200,{ok:true});}
  return send(404,{error:'Not found'});
 }
 // Public web photo for a trending look or a typed prompt (Bing image results, Wikimedia fallback), never the paid search.
 if(req.method==='GET'&&pathname==='/api/discover/look-photo'){const q=new URL(req.url,'http://localhost').searchParams.get('q')||'';if(q.trim().length<3||q.length>300)return send(400,{error:'Use a photo query between 3 and 300 characters.'});return send(200,await lookPhotos.search(q));}
 if(req.method==='GET'&&pathname==='/api/discover/looks')return send(200,{looks:lookCards()});
 const ip=()=>String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'unknown';
 // Saved Discover chats (three per guest in the beta).
 const chatPath=pathname.match(/^\/api\/discover\/chats(?:\/([a-f0-9-]{36}))?$/);
 if(chatPath){
  if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Forbidden'});
  if(!accountId)return send(401,{error:'Sign in to save and revisit chats.',signIn:true});
  const id=chatPath[1],who=accounts.chatOwner(accountId,guest());
  if(req.method==='GET'&&!id)return send(200,{chats:await chats.list(who)});
  if(req.method==='GET')return send(200,await chats.get(who,id));
  if(req.method==='DELETE'&&id){await chats.remove(who,id);return send(200,{chats:await chats.list(who)});}
  if(req.method==='PUT'&&id){
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
   let size=0,parts=[];for await(const part of req){size+=part.length;if(size>450_000)return send(413,{error:'This chat is too large to save.'});parts.push(part);}
   let body;try{body=JSON.parse(Buffer.concat(parts).toString());}catch{return send(400,{error:'Invalid JSON'});}
   try{return send(200,await chats.save(who,id,body));}catch(e){if(e.status===409)return send(409,{error:e.message,chats:e.chats});throw e;}
  }
  return send(405,{error:'Method not allowed'});
 }
 if(req.method==='GET'&&pathname==='/api/discover/credits'){const {models,defaultModel}=discovery.status();return send(200,{...await credits.summary(guest()),models,defaultModel});}
 if(req.method==='GET'&&pathname==='/api/discover/status')return send(200,discovery.status());
 if(req.method==='GET'&&pathname==='/api/developer/observability'){const host=String(req.headers.host||'').replace(/^\[|\](?=:|$)/g,'').split(':')[0];const dashboard=discovery.observability?.();if(!dashboard?.enabled||!['localhost','127.0.0.1','::1'].includes(host))return send(404,{error:'Not found'});return send(200,dashboard);}
 if(req.method==='GET'&&/^\/api\/discover\/image\/[a-f0-9]{48}$/.test(pathname)){const img=discovery.getImage(pathname.split('/').pop());if(!img)return send(404,{error:'Image expired'});res.writeHead(200,{'Content-Type':img.type,'Cache-Control':'no-store','X-Robots-Tag':'noindex, noarchive','X-Content-Type-Options':'nosniff'});return res.end(img.data);}
 if(req.method==='GET'&&pathname==='/api/developer/qa'){if(!discovery.status?.().developerDashboard)return send(404,{error:'Not found'});return send(200,{items:await qaStore.list()});}
 if(req.method==='GET'&&/^\/api\/developer\/qa\/[a-f0-9]{16}\/image$/.test(pathname)){if(!discovery.status?.().developerDashboard)return send(404,{error:'Not found'});const img=await qaStore.image(pathname.split('/')[4]);if(!img)return send(404,{error:'Not found'});res.writeHead(200,{'Content-Type':img.type,'Cache-Control':'private, max-age=3600','X-Robots-Tag':'noindex, noarchive','X-Content-Type-Options':'nosniff'});return res.end(img.data);}
 if(req.method==='POST'&&pathname==='/api/developer/qa'){
  if(!discovery.status?.().developerDashboard)return send(404,{error:'Not found'});
  if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open the app to send a QA note.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
  let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4500000)throw new ApiError(413,'Screenshot too large. Try a smaller image.');chunks.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ApiError(400,'Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Invalid request.');
  const {id}=await qaStore.add(body);
  return send(200,{ok:true,id});
 }
 if(req.method!=='POST'||!['/api/discover/detect','/api/discover/orders','/api/discover/analyze','/api/discover/interpret','/api/discover/search'].includes(pathname))return send(404,{error:'Not found'});
 if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open Discover to make a search.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
 const action=pathname.split('/').pop();
 let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4500000)throw new ApiError(413,'Image too large. Try a smaller crop.');chunks.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ApiError(400,'Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Invalid request.');
 // A phone that cancels, retries or drops off must free the single local model slot instead of queueing behind itself.
 const cancelled=new AbortController();res.on('close',()=>{if(!res.writableFinished)cancelled.abort();});
 // Asking costs credits (the model call); the answer carries a ticket good for two shopping searches.
 // Wardrobe imports (detect, orders) stay outside the search allowance and keep the hourly limit.
 let charge=null;const who={guest:guest(),ip:ip(),model:modelKey(body.model)};body.model=who.model;
 // The person's own profile sets Discover's default department; a client can't pick someone else's.
 delete body.department;if(action==='interpret'&&accountId){const a=await accounts.get(accountId);body.department=departmentFor(a?.profile);}
 // Every AI call (search and wardrobe imports) stops before the prepaid balance runs out.
 if(['detect','orders','analyze','interpret'].includes(action))await credits.budgetOk?.();
 if(['interpret','analyze'].includes(action))charge=await credits.charge(who);
 if(action==='search'&&discovery.status?.().shopping&&!await credits.useTurn(body.turn,who.guest))return send(403,{error:'Ask a new question to search again.'});
 const runAction=async progress=>{try{const result=await discovery[action](body,progress,cancelled.signal);
  // Nothing fashion was understood ("let's solve a differential equation"): the question is free and unlocks no search.
  if(charge&&action==='interpret'&&!result.attributes){await credits.refund(who);return {...result,credits:{remaining:charge.remaining+charge.cost,cost:0}};}
  return charge?{...result,credits:{remaining:charge.remaining,cost:charge.cost},turn:charge.turn}:result;}catch(e){if(charge)await credits.refund(who).catch(()=>{});throw e;}};
 if(req.headers.accept==='application/x-ndjson'){
 res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'});
 const emit=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
 try{const result=await runAction(p=>emit({type:'progress',...p}));emit({type:'result',data:result});}catch(e){emit({type:'error',error:e instanceof ApiError?e.message:'Unable to complete this search.'});}res.end();return;
 }return send(200,await runAction(undefined));
 }
 if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(root)||pathname.split('/').some(p=>p.startsWith('.')))return send(403,{error:'Forbidden'});
 const content=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){const status=e.status||(e.code==='ENOENT'?404:500);if(status>=500&&!e.status)console.error('Unhandled',req.method,String(req.url||'').split('?')[0],e?.code||'',String(e?.message||e).replace(/postgres(ql)?:\/\/\S+/gi,'<db-url>').slice(0,300));send(status,{error:e instanceof ApiError||e.status?e.message:'Unable to complete this request.'});}
};}
export function createServer(discovery,qaStore,photos,connectors,community,credits,chats,accounts,wardrobe,cutout,pageFetcher,inbox,styleMe){return http.createServer(createHandler(discovery,qaStore,photos,connectors,community,credits,chats,accounts,wardrobe,cutout,pageFetcher,inbox,styleMe));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const port=Number(process.env.PORT||5173),host=process.env.HOST||'0.0.0.0';createServer().listen(port,host,()=>console.log(`The Wardrobe OS: http://127.0.0.1:${port} · network enabled`));}
