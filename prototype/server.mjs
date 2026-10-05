import http from 'node:http';
import {createPhotos} from './lib/photos.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createDiscovery,ApiError} from './lib/discovery.mjs';
import {createQaStore} from './lib/qa.mjs';
import {createConnectorStore,STORES} from './lib/connectors.mjs';
import {readFeed} from './lib/mall-feed.mjs';
import {createCommunity} from './lib/community.mjs';
import mallSnapshot from './dist/assets/mall-updates.json' with {type:'json'};
try{process.loadEnvFile(fileURLToPath(new URL('./.env',import.meta.url)));}catch(e){if(e.code!=='ENOENT')throw e;}
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
// The bare (req,res) listener is what Vercel's Node runtime invokes; createServer wraps it for local runs.
export function createHandler(discovery=createDiscovery(),qaStore=createQaStore(),photos=createPhotos(),connectors=createConnectorStore(),community=createCommunity()){
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
 if(req.method!=='POST'||!['/api/discover/detect','/api/discover/orders','/api/discover/analyze','/api/discover/search'].includes(pathname))return send(404,{error:'Not found'});
 if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open Discover to make a search.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
 const action=pathname.split('/').pop();
 let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4500000)throw new ApiError(413,'Image too large. Try a smaller crop.');chunks.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ApiError(400,'Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Invalid request.');
 // A phone that cancels, retries or drops off must free the single local model slot instead of queueing behind itself.
 const cancelled=new AbortController();res.on('close',()=>{if(!res.writableFinished)cancelled.abort();});if(req.headers.accept==='application/x-ndjson'){
 res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'});
 const emit=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
 try{const result=await discovery[action](body,p=>emit({type:'progress',...p}),cancelled.signal);emit({type:'result',data:result});}catch(e){emit({type:'error',error:e instanceof ApiError?e.message:'Unable to complete this search.'});}res.end();return;
 }return send(200,await discovery[action](body,undefined,cancelled.signal));
 }
 if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(root)||pathname.split('/').some(p=>p.startsWith('.')))return send(403,{error:'Forbidden'});
 const content=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){send(e.status|| (e.code==='ENOENT'?404:500),{error:e instanceof ApiError||e.status?e.message:'Unable to complete this request.'});}
};}
export function createServer(discovery,qaStore,photos,connectors,community){return http.createServer(createHandler(discovery,qaStore,photos,connectors,community));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const port=Number(process.env.PORT||5173),host=process.env.HOST||'0.0.0.0';createServer().listen(port,host,()=>console.log(`The Better Wardrobe: http://127.0.0.1:${port} · network enabled`));}
