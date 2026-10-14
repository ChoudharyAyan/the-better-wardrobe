import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {createWardrobe,cleanItem,productFromPage} from '../lib/wardrobe.mjs';
import {createCutout,parseMasks,applyMask} from '../lib/cutout.mjs';
import {createAccounts} from '../lib/accounts.mjs';
import {createServer} from '../server.mjs';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
// Loads a browser script into a sandbox and returns its window.
function load(file,extra={}){const window={...extra};vm.runInContext(read(file),vm.createContext({window,globalThis:window,console,encodeURIComponent,setTimeout,clearTimeout,Promise,...extra}));return window;}

// A 200×200 photo: grey background with a red 100×100 square in the middle, and a mask for it.
const photo=()=>sharp({create:{width:200,height:200,channels:3,background:'#888888'}}).composite([{input:{create:{width:100,height:100,channels:3,background:'#d01010'}},left:50,top:50}]).jpeg().toBuffer();
async function squareMask(){const inner=await sharp({create:{width:50,height:50,channels:3,background:'#ffffff'}}).png().toBuffer();return sharp({create:{width:100,height:100,channels:3,background:'#000000'}}).composite([{input:inner,left:25,top:25}]).png().toBuffer();}

test('the shop connectors in the app are the same code the browser extension runs',()=>{
 assert.equal(read('dist/store-connectors.js'),read('extension/connectors.js'));
 assert.equal(read('dist/store-observer.js'),read('extension/observer.js'));
});

test('cleanItem keeps only wardrobe fields, and drawn basics keep their shape and colour',()=>{
 const item=cleanItem({id:'basic-white-t-shirt',name:'White T-shirt',category:'Shirts',art:{shape:'tee',colour:'#F4F1EA'},password:'x',price:'499.6',status:'laundry'});
 assert.deepEqual(item.art,{shape:'tee',colour:'#F4F1EA'});assert.equal(item.price,500);assert.equal(item.status,'laundry');assert.equal(item.password,undefined);
 assert.equal(cleanItem({id:'a',name:'x',art:{shape:'<svg>',colour:'red'}}).art,null);
 assert.equal(cleanItem({id:'a',name:'x',category:'Ethnic wear'}).category,'Ethnic wear');
 assert.throws(()=>cleanItem({id:'../etc',name:'x'}),e=>e.status===400);
});

test('wardrobe store keeps pictures apart from the list and scopes everything to the account',async()=>{
 const w=createWardrobe({env:{}});
 await assert.rejects(w.list(''),e=>e.status===401);
 const png=(await sharp({create:{width:4,height:4,channels:3,background:'#fff'}}).png().toBuffer()).toString('base64');
 const saved=await w.putItem('acct-1','photo-1',{item:{name:'Red kurta',category:'Ethnic wear'},image:'data:image/png;base64,'+png});
 assert.match(saved.image,/^\/api\/wardrobe\/image\/photo-1\?v=[a-f0-9]{12}$/);
 const linked=await w.putItem('acct-1','order-myntra-1',{item:{name:'Shirt',category:'Shirts'},image:'https://assets.myntassets.com/1.jpg'});
 assert.equal(linked.image,'https://assets.myntassets.com/1.jpg');
 // Renaming without a new picture keeps the stored one.
 const renamed=await w.putItem('acct-1','photo-1',{item:{name:'Maroon kurta',category:'Ethnic wear'}});assert.equal(renamed.image,saved.image);
 const {items}=await w.list('acct-1');assert.deepEqual(items.map(i=>i.name).sort(),['Maroon kurta','Shirt']);
 assert.equal((await w.image('acct-1','photo-1')).type,'image/png');
 assert.equal((await w.list('acct-2')).items.length,0,'another account sees nothing');
 assert.equal(await w.image('acct-2','photo-1'),null);
 await w.removeItem('acct-1','photo-1');assert.equal((await w.list('acct-1')).items.length,1);
 const meta=await w.putMeta('acct-1',{wears:[{id:'w1',date:'2026-10-14',items:['order-myntra-1']}],shops:['myntra'],aiConsent:true,extra:1});
 assert.deepEqual(meta.shops,['myntra']);assert.equal(meta.extra,undefined);
});

test('product links read JSON-LD first, then Open Graph, and only keep rupee prices',()=>{
 const ld=`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Roadster Men Checked Shirt","brand":{"name":"Roadster"},"image":["https://assets.myntassets.com/s.jpg"],"offers":{"price":"899","priceCurrency":"INR"}}]}</script>`;
 assert.deepEqual(productFromPage(ld,'https://www.myntra.com/shirts/1'),{name:'Roadster Men Checked Shirt',brand:'Roadster',image:'https://assets.myntassets.com/s.jpg',price:899,productUrl:'https://www.myntra.com/shirts/1'});
 const og=`<meta property="og:title" content="Blue Kurta &amp; Pyjama"><meta property="og:image" content="https://img.example.com/k.jpg"><meta property="product:price:amount" content="20"><meta property="product:price:currency" content="USD">`;
 const p=productFromPage(og,'https://www.ajio.com/p/1');assert.equal(p.name,'Blue Kurta & Pyjama');assert.equal(p.price,null);
 assert.equal(productFromPage('<html></html>','https://x.example'),null);
});

test('cutouts apply the Gemini mask to the real pixels, then fall back to OpenAI',async()=>{
 const mask=await squareMask(),image='data:image/jpeg;base64,'+(await photo()).toString('base64');
 const parsed=parseMasks('```json\n'+JSON.stringify([{box_2d:[250,250,750,750],mask:'data:image/png;base64,'+mask.toString('base64'),label:'red square'}])+'\n```');
 assert.deepEqual(parsed.box,[250,250,750,750]);assert.equal(parsed.label,'red square');
 assert.equal(parseMasks('not json'),null);assert.equal(parseMasks(JSON.stringify([{box_2d:[0,0,5,5],mask:'data:image/png;base64,AA=='}])),null,'tiny boxes are ignored');
 // The cutout is the red square, untouched: no grey background, no recolouring.
 const out=await applyMask(await photo(),parsed);
 const {data,info}=await sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.ok(info.width<=60&&info.width>=45,'trimmed to the piece');
 const centre=((info.height>>1)*info.width+(info.width>>1))*4;assert.ok(data[centre]>180&&data[centre+1]<60&&data[centre+3]===255,'centre keeps its own red');
 const empty=await sharp({create:{width:100,height:100,channels:3,background:'#000000'}}).png().toBuffer();
 await assert.rejects(applyMask(await photo(),{box:[0,0,1000,1000],mask:empty}),/separate/);

 const calls=[];
 const gemini=createCutout({env:{GEMINI_API_KEY:'g'},fetcher:async(url,init)=>{calls.push(url);const body=JSON.parse(init.body);assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify([{box_2d:[250,250,750,750],mask:'data:image/png;base64,'+mask.toString('base64'),label:'x'}])}]}}]})};}});
 assert.equal(gemini.configured(),true);
 const r=await gemini.cut({image,label:'red top'});assert.equal(r.provider,'gemini');assert.match(r.image,/^data:image\/webp;base64,/);
 await gemini.cut({image,label:'red top'});assert.equal(calls.length,1,'the same photo is cut once');

 const fallback=createCutout({env:{GEMINI_API_KEY:'g',OPENAI_API_KEY:'o'},fetcher:async url=>{
  if(url.includes('googleapis'))return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'[]'}]}}]})};
  const png=await sharp({create:{width:40,height:40,channels:4,background:{r:200,g:0,b:0,alpha:1}}}).png().toBuffer();
  return {ok:true,status:200,json:async()=>({data:[{b64_json:png.toString('base64')}]})};
 }});
 assert.equal((await fallback.cut({image,label:'red top'})).provider,'openai');

 const limited=createCutout({env:{GEMINI_API_KEY:'g'},fetcher:async()=>({ok:false,status:429,json:async()=>({})})});
 await assert.rejects(limited.cut({image}),e=>e.status===429);
 assert.equal(createCutout({env:{}}).configured(),false);
});

test('saved store pieces are cut out from the store photo, fetched only from store image hosts',async()=>{
 const mask=await squareMask(),jpeg=await photo(),asked=[];
 const maskReply={ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify([{box_2d:[250,250,750,750],mask:'data:image/png;base64,'+mask.toString('base64')}])}]}}]})};
 const c=createCutout({env:{GEMINI_API_KEY:'g'},fetcher:async(url)=>{asked.push(String(url));if(String(url).includes('googleapis'))return maskReply;
  return {ok:true,status:200,url:String(url),headers:{get:()=>'image/jpeg'},arrayBuffer:async()=>jpeg.buffer.slice(jpeg.byteOffset,jpeg.byteOffset+jpeg.byteLength)};}});
 const r=await c.cut({image:'https://assets.myntassets.com/w_540,q_85/v1/assets/images/shirt.jpg',label:'shirts'});
 assert.equal(r.provider,'gemini');assert.equal(asked[0],'https://assets.myntassets.com/w_540,q_85/v1/assets/images/shirt.jpg');
 for(const bad of ['https://169.254.169.254/latest/meta-data','https://evil.example/x.jpg','http://assets.myntassets.com/x.jpg','https://user:pw@assets.myntassets.com/x.jpg','https://myntassets.com.evil.example/x.jpg'])
  await assert.rejects(c.cut({image:bad}),e=>e.status===400,bad);
 const html=createCutout({env:{GEMINI_API_KEY:'g'},fetcher:async url=>({ok:true,status:200,url:String(url),headers:{get:()=>'text/html'},arrayBuffer:async()=>new ArrayBuffer(8)})});
 await assert.rejects(html.cut({image:'https://rukminim1.flixcart.com/image/480/480/x.jpeg'}),e=>e.status===422,'only images');
 const moved=createCutout({env:{GEMINI_API_KEY:'g'},fetcher:async()=>({ok:true,status:200,url:'https://evil.example/x.jpg',headers:{get:()=>'image/jpeg'},arrayBuffer:async()=>new ArrayBuffer(8)})});
 await assert.rejects(moved.cut({image:'https://m.media-amazon.com/images/I/x.jpg'}),e=>e.status===422,'a redirect off the store host is refused');
});

test('wardrobe routes: signed-in only for the list, same-site only, links and cutouts for everyone',async()=>{
 const cutout={configured:()=>true,cut:async()=>({image:'data:image/webp;base64,AAAA',provider:'gemini'})};
 const pages={'https://www.myntra.com/p/1':'<meta property="og:title" content="Black Kurta"><meta property="og:image" content="https://assets.myntassets.com/k.jpg">'};
 const server=createServer({status:()=>({})},undefined,undefined,undefined,undefined,undefined,undefined,createAccounts({env:{}}),createWardrobe({env:{}}),cutout,async url=>{if(!pages[url])throw new Error('blocked');return pages[url];});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  let cookie=(await fetch(base+'/api/me')).headers.get('set-cookie').split(';')[0];
  const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body&&JSON.stringify(body)});
  assert.deepEqual(await (await call('/api/wardrobe/status')).json(),{signedIn:false,cutouts:true,email:false});
  const guest=await call('/api/wardrobe');assert.equal(guest.status,401);assert.equal((await guest.json()).signIn,true);
  assert.equal((await call('/api/wardrobe/cutout','POST',{image:'data:image/png;base64,AA=='})).status,200);
  assert.equal((await (await call('/api/wardrobe/link','POST',{url:'https://www.myntra.com/p/1'})).json()).product.name,'Black Kurta');
  assert.equal((await call('/api/wardrobe/link','POST',{url:'https://evil.example/p'})).status,422);
  assert.equal((await call('/api/wardrobe/link','POST',{url:'javascript:alert(1)'})).status,400);
  assert.equal((await call('/api/wardrobe/status','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);

  cookie+='; '+(await call('/api/auth/preview','POST',{})).headers.get('set-cookie').split(';')[0];
  const put=await call('/api/wardrobe/items/basic-white-t-shirt','PUT',{item:{name:'White T-shirt',category:'Shirts',art:{shape:'tee',colour:'#F4F1EA'}}});
  assert.equal(put.status,200);
  const list=await (await call('/api/wardrobe')).json();assert.equal(list.items[0].art.shape,'tee');
  assert.equal((await call('/api/wardrobe/meta','PUT',{shops:['myntra','ajio']})).status,200);
  assert.deepEqual((await (await call('/api/wardrobe')).json()).meta.shops,['myntra','ajio']);
  assert.equal((await call('/api/wardrobe/items/basic-white-t-shirt','DELETE')).status,200);
  assert.equal((await (await call('/api/wardrobe')).json()).items.length,0);
 }finally{await new Promise(r=>server.close(r));}
});

test('intake: innerwear, kids sizes and likely gifts are hidden, never dropped',()=>{
 const {WardrobeIntake:W}=load('dist/wardrobe-intake.js');
 assert.equal(W.screen({innerwear:true},{}),'Innerwear');
 assert.equal(W.screen({gender:'Boys'},{gender:'male'}),"Kids' sizes");
 assert.equal(W.screen({gender:'Women'},{gender:'male'}),'Looks like a gift');
 assert.equal(W.screen({gender:'Men'},{gender:'female'}),'Looks like a gift');
 assert.equal(W.screen({gender:'Unisex'},{gender:'male'}),'');
 assert.equal(W.screen({gender:'Women'},{gender:'other'}),'','no guessing without a clear profile');
});

test('intake: XP, levels and streaks follow the design system rules',()=>{
 const {WardrobeIntake:W}=load('dist/wardrobe-intake.js');
 const items=Array.from({length:16},(_,i)=>({id:'p'+i,brand:i<2?'Roadster':''}));
 const wears=[{date:'2026-10-14',items:['p0']},{date:'2026-10-13',items:['p1']},{date:'2026-10-11',items:['p2']}];
 const s=W.progress({items,wears},'2026-10-14');
 assert.deepEqual({xp:s.xp,number:s.number,title:s.title,nextAt:s.nextAt,streak:s.streak},{xp:16*10+3*15+2*5,number:2,title:'Stylist',nextAt:30,streak:2});
 assert.equal(W.progress({items,wears},'2026-10-15').streak,2,'yesterday still counts');
 assert.equal(W.progress({items,wears},'2026-10-16').streak,0);
 assert.equal(W.progress({items:[],wears:[]}).title,'Collector');
 assert.equal(W.notWornSince({items:[{id:'a',purchased:'2026-01-01'},{id:'b',purchased:'2026-01-01'}],wears:[{date:'2026-10-01',items:['a']}]},60,'2026-10-14'),1);
 assert.equal(new Set(W.BASICS.map(b=>b.id)).size,W.BASICS.length);
 assert.match(W.basicImage('kurta','#7E1F3A'),/^data:image\/svg\+xml,/);
});

test('intake pool keeps at most N tasks in flight and reports each one as it lands',async()=>{
 const {WardrobeIntake:W}=load('dist/wardrobe-intake.js');
 let live=0,peak=0;const order=[];
 const results=await W.pool([30,10,20,5,15],2,async ms=>{live++;peak=Math.max(peak,live);await new Promise(r=>setTimeout(r,ms));live--;if(ms===5)throw new Error('bad');return ms;},(r,i)=>order.push(i));
 assert.equal(peak,2);assert.equal(order.length,5);assert.equal(results[3].ok,false);assert.equal(results[0].value,30);
});

test('account sync uploads only what changed and merges a guest wardrobe on sign-in',async()=>{
 const store=new Map(),calls=[];
 const server={items:[{id:'order-myntra-1',name:'Shirt',category:'Shirts',image:'/api/wardrobe/image/order-myntra-1?v=1'},{id:'basic-black-cap',name:'Black cap',category:'Accessories',art:{shape:'cap',colour:'#2B2A2F'}}],meta:{wears:[{id:'w1',date:'2026-10-01',items:['order-myntra-1']}],shops:['myntra']}};
 const fetch=async(path,init={})=>{calls.push(init.method+' '+path);const body=init.body?JSON.parse(init.body):null;
  const reply=path==='/api/wardrobe'?server:path.startsWith('/api/wardrobe/items/')?{item:{...body.item,image:body.image?.startsWith('data:')?'/api/wardrobe/image/x?v=2':body.image}}:{};
  return {ok:true,status:200,json:async()=>reply};};
 let timer=null;
 const w=load('dist/wardrobe-sync.js',{fetch,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){}});
 const S=w.WardrobeSync;
 const local={items:[{id:'sample',name:'Sample',source:'Sample wardrobe'},{id:'photo-1',name:'Red kurta',category:'Ethnic wear',image:'data:image/webp;base64,AAAA'}],wears:[{id:'seed-1',date:'2026-08-01',items:['sample']}],looks:[],shops:[]};
 const merged=await S.start('a@example.com',local,{basicImage:(s,c)=>`art:${s}:${c}`});
 assert.deepEqual([...merged.items.map(p=>p.id)],['order-myntra-1','basic-black-cap','photo-1'],'sample pieces never reach an account');
 assert.equal(merged.items[1].image,'art:cap:#2B2A2F');assert.equal(merged.uploaded,1);assert.deepEqual([...merged.shops],['myntra']);
 assert.equal(merged.wears.length,1,'sample wears are left behind');
 const state={...local,...merged};
 S.push(state);calls.length=0;await timer();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(calls,['PUT /api/wardrobe/items/photo-1','PUT /api/wardrobe/meta'],'only the guest piece and the meta are sent');
 assert.equal(state.items[2].image,'/api/wardrobe/image/x?v=2','the local data URL is swapped for the server copy');
 state.items=state.items.filter(p=>p.id!=='order-myntra-1');
 S.push(state);calls.length=0;await timer();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(calls,['DELETE /api/wardrobe/items/order-myntra-1']);
 assert.equal(S._payload({id:'b',art:{shape:'tee',colour:'#fff'},image:'data:image/svg+xml,x'}).image,undefined,'drawn basics send no picture');
});

test('phone app: Myntra orders stream from the in-app browser into the app',async()=>{
 const listeners={},scripts=[],opened=[];let closed=false;
 globalThis.Capacitor={isNativePlatform:()=>true,Plugins:{InAppBrowser:{
  addListener:async(name,fn)=>{listeners[name]=fn;return {remove(){}};},
  openWebView:async opts=>{opened.push(opts.url);assert.match(opts.preShowScript,/__tbwCaptured/);return {id:'w1'};},
  executeScript:async({code})=>{scripts.push(code);},close:async()=>{closed=true;}
 }}};
 const realFetch=globalThis.fetch;globalThis.fetch=async()=>({text:async()=>read('dist/store-observer.js')});
 try{
  const {run,available}=await import('../dist/native-import.js');
  assert.equal(available('myntra'),true);assert.equal(available('meesho'),true);assert.equal(available('zara'),false);
  const chunks=[],states=[];
  const done=run('myntra',{onData:d=>chunks.push(d),onStatus:s=>states.push(s)});
  await new Promise(r=>setTimeout(r,0));
  listeners.browserPageLoaded();assert.match(scripts.at(-1),/Import Myntra orders/);assert.match(scripts.at(-1),/elementsFromPoint/,'the pill lifts above the store\'s own bottom bars');
  listeners.messageFromWebview({detail:{tbw:'go'}});assert.match(scripts.at(-1),/__tbwEmit/);assert.match(scripts.at(-1),/my\/orders\?p=/);
  listeners.messageFromWebview({detail:{tbw:'part',data:{lines:[{product:{id:1}}]},progress:{page:1,pages:2}}});
  listeners.messageFromWebview({detail:{tbw:'part',data:{lines:[{product:{id:2}}]},progress:{page:2,pages:2}}});assert.match(scripts.at(-1),/100% · 2 items read/);assert.match(scripts.at(-1),/firstChild\.style\.width=p\+'%'/);
  listeners.messageFromWebview({detail:{tbw:'done',result:{lines:[{product:{id:1}},{product:{id:2}}]}}});
  assert.deepEqual(await done,{count:2});assert.equal(opened[0],'https://www.myntra.com/my/orders');assert.equal(chunks.length,2,'the final result is not added twice');
  assert.match(scripts.at(-1),/Done · 2 items read/);assert.match(scripts.at(-1),/Done ✓/);assert.equal(closed,false,'the finished bar shows for a moment');await new Promise(r=>setTimeout(r,950));assert.equal(closed,true);
  const login=run('flipkart',{onStatus:s=>states.push(s)});await new Promise(r=>setTimeout(r,0));
  listeners.messageFromWebview({detail:{tbw:'done',result:{error:'login'}}});assert.equal(states.at(-1),'login');
  listeners.closeEvent();assert.deepEqual(await login,{count:0,closed:true});
 }finally{delete globalThis.Capacitor;globalThis.fetch=realFetch;}
});

test('phone app: only Flipkart, and only when asked, opens identifying as Chrome',async()=>{
 const opens=[],calls=[];const listeners={};
 globalThis.Capacitor={isNativePlatform:()=>true,Plugins:{InAppBrowser:{addListener:async(name,fn)=>{listeners[name]=fn;return {remove(){}};},openWebView:async opts=>{opens.push(opts);return {id:'w'};},executeScript:async({code})=>{calls.push('script:'+(/unregister/.test(code)?'fresh':'other'));},close:async()=>{},clearCache:async o=>{calls.push('clearCache:'+o.id);},reload:async o=>{calls.push('reload:'+o.id);}}}};
 const realFetch=globalThis.fetch;globalThis.fetch=async()=>({text:async()=>''});
 const realNav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 10a Build/X; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.1.2 Mobile Safari/537.36'},configurable:true});
 try{
  const {run,needsChrome,chromeAgent}=await import('../dist/native-import.js');
  assert.equal(needsChrome('flipkart'),true);assert.equal(needsChrome('myntra'),false);
  assert.equal(chromeAgent(),'Mozilla/5.0 (Linux; Android 17; Pixel 10a Build/X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.1.2 Mobile Safari/537.36');
  for(const [id,asChrome] of [['flipkart',false],['flipkart',true],['myntra',true]]){const p=run(id,{asChrome});await new Promise(r=>setTimeout(r,asChrome?450:0));listeners.closeEvent();await p;}
  assert.equal(opens[0].headers,undefined,'Flipkart without consent opens as it is');
  assert.deepEqual(calls,['clearCache:w','script:fresh','reload:w'],'only the Chrome open clears cached failures and reloads');
  assert.doesNotMatch(opens[1].headers['User-Agent'],/; wv|Version\/4\.0/);
  assert.equal(opens[2].headers,undefined,'other stores never change identity');
 }finally{delete globalThis.Capacitor;globalThis.fetch=realFetch;if(realNav)Object.defineProperty(globalThis,'navigator',realNav);}
});

test('insights: palette, gaps by profile, recap and complete-this-look',()=>{
 const {WardrobeInsights:I}=load('dist/wardrobe-insights.js');
 const items=[{id:'a',name:'Navy linen shirt',category:'Shirts'},{id:'b',name:'Blue jeans',category:'Trousers',price:2000},{id:'c',name:'White sneakers',category:'Footwear'},{id:'d',name:'Navy polo',category:'Shirts'},{id:'e',name:'Maroon kurta',category:'Ethnic wear',art:{shape:'kurta',colour:'#7E1F3A'}}];
 assert.deepEqual([...I.palette(items).map(c=>c.name)],['navy','blue','white','maroon']);
 const male=[...I.gaps(items,{gender:'male'}).map(g=>g.id)];assert.ok(male.includes('formal-shoes')&&male.includes('wedding')&&male.includes('layer')&&male.includes('belt'));
 assert.equal(I.gaps(items,{gender:'female'}).find(g=>g.id==='wedding').search,'lehenga');
 const state={items,wears:[{date:'2026-10-02',items:['a','b']},{date:'2026-10-05',items:['b','c']},{date:'2025-01-01',items:['d']}]};
 const r=I.recap(state,{from:'2026-10-01',to:'2026-11-30'});
 assert.equal(r.wears,2);assert.equal(r.mostWorn[0].item.id,'b');assert.equal(r.bestValue.cpw,1000);assert.deepEqual([...r.neverWorn.map(p=>p.id)].sort(),['d','e']);
 const c=I.complete(items[0],state);assert.deepEqual([...c.picks.map(p=>p.id)],['b','c']);assert.deepEqual([...c.missing],['Belts']);
 assert.deepEqual([...I.complete(items[4],state).picks.map(p=>p.id)],['b','c'],'a kurta is not paired with another kurta');
 assert.equal(I.similar({name:'Roadster Men Navy Checked Shirt',retailer:'myntra',orderedAt:'2026-10-01'},{name:'Roadster Navy Checked Shirt',retailer:'Myntra',orderedAt:'2026-10-20'}),true);
 assert.equal(I.similar({name:'Navy Shirt',retailer:'zara'},{name:'Navy Trousers',retailer:'zara'}),false);
});

test('import progress: share done and a rough time left once a little is done',()=>{
 const {WardrobeIntake:W}=load('dist/wardrobe-intake.js');
 assert.deepEqual({...W.importProgress(3,0,0)},{pct:null,left:''},'unknown total: a moving bar, no guess');
 assert.deepEqual({...W.importProgress(1,4,1000,11000)},{pct:25,left:'about 30 s left'});
 assert.deepEqual({...W.importProgress(1,2,1000,181000)},{pct:50,left:'about 3 min left'});
 assert.equal(W.importProgress(4,4,1000,9000).left,'','nothing left to estimate when done');
 assert.equal(W.importProgress(1,50,1000,2000).left,'','too early to guess');
});

test('phone app: the import pill waits until the person is signed in to the store',async()=>{
 const vm=await import('node:vm');const {signedIn}=await import('../dist/native-import.js');
 const visible={offsetParent:{}},hidden={offsetParent:null};
 const page=(pathname,inputs=[],fetchUrl='https://www.amazon.in/gp/css/order-history',status=200)=>({location:{pathname},document:{querySelectorAll:()=>inputs},navigator:{userAgent:'x'},fetch:async()=>({url:fetchUrl,status}),Promise});
 const run=(id,ctx)=>vm.runInNewContext(signedIn(id),ctx);
 assert.equal(await run('myntra',page('/login')),false,'a login page');
 assert.equal(await run('slikk',page('/orders',[visible])),false,'a visible login form');
 assert.equal(await run('slikk',page('/orders',[hidden])),true,'orders page, no login form');
 assert.equal(await run('flipkart',page('/rv/orders',[],'',401)),false,'Flipkart shows orders even signed out: its API decides');
 assert.equal(await run('flipkart',page('/rv/orders',[],'',200)),true);
 assert.equal(await run('amazon',page('/gp/aw/c',[],'https://www.amazon.in/ap/signin?x')),false,'Amazon order history bounces to sign-in');
 assert.equal(await run('amazon',page('/gp/aw/c')),true,'signed in, even while on the cart');
});

test('Slikk keeps the first of its comma-separated photos',async()=>{
 const {normalizeSlikk}=await import('../dist/order-import.js');
 const [item]=normalizeSlikk([{status:'delivered',date:'2026-08-05T10:00:00Z',returned:false,items:[{name:'Tapered Slim Fit Jeans',image:'https://cdn1.slikkclub.com/product/a_1.jpg,https://cdn1.slikkclub.com/product/a_2.jpg',price:'1249'}]}]);
 assert.equal(item.image,'https://cdn1.slikkclub.com/product/a_1.jpg');assert.equal(item.category,'Trousers');
});

