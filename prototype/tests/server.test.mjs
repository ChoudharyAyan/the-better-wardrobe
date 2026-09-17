import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {createDiscovery} from '../lib/discovery.mjs';
test('HTTP boundary serves app, reports missing keys and keeps configuration private',async()=>{
 const server=createServer(createDiscovery({env:{}}));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 try{
 assert.equal((await fetch(base)).status,200);
 assert.equal((await fetch(base+'/.env')).status,403);
 assert.equal((await fetch(base+'/api/discover/image/'+'a'.repeat(48))).status,404);
 const status=await(await fetch(base+'/api/discover/status')).json();assert.equal(status.shopping,false);
 assert.equal((await fetch(base+'/api/developer/observability')).status,404);
 const missing=await fetch(base+'/api/discover/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attributes:{category:'Shirt',colour:'blue'}})});assert.equal(missing.status,503);assert.match((await missing.json()).error,/SerpApi/);
 assert.equal((await fetch(base+'/api/discover/search',{method:'POST',body:'bad'})).status,415);
 assert.equal((await fetch(base+'/api/discover/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'bad'})).status,400);
 assert.equal((await fetch(base+'/api/discover/search',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:'{}'})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
test('developer observability endpoint is feature gated',async()=>{
 const service={observability:()=>({enabled:true,totals:{requests:0},recentRequests:[],recentSearches:[]})};const server=createServer(service);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/developer/observability');assert.equal(r.status,200);assert.equal((await r.json()).enabled,true);}finally{await new Promise(r=>server.close(r));}
});
test('developer QA endpoint is feature gated, works from any host, and rejects bad submissions',async()=>{
 let received=null;
 const qaStore={add:async body=>{received=body;return {id:'a1b2c3d4e5f6a7b8'};}};
 const off=createServer({status:()=>({developerDashboard:false})},qaStore);await new Promise(r=>off.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+off.address().port+'/api/developer/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,404);}finally{await new Promise(r=>off.close(r));}
 const on=createServer({status:()=>({developerDashboard:true})},qaStore);await new Promise(r=>on.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+on.address().port;
 try{
  const ok=await fetch(base+'/api/developer/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,abc',note:'Chips show before AI runs'})});
  assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{ok:true,id:'a1b2c3d4e5f6a7b8'});assert.equal(received.note,'Chips show before AI runs');
  assert.equal((await fetch(base+'/api/developer/qa',{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/developer/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:'not json'})).status,400);
  assert.equal((await fetch(base+'/api/developer/qa',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:'{}'})).status,403);
 }finally{await new Promise(r=>on.close(r));}
});
test('streamed progress reports backend milestones followed by a result',async()=>{
 const service={search:async(body,progress)=>{progress({percent:40,label:'Retrieved'});return {results:[]};}};
 const server=createServer(service);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/discover/search',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:'{}'});const events=(await r.text()).trim().split('\n').map(JSON.parse);assert.equal(events[0].percent,40);assert.equal(events[1].type,'result');}finally{await new Promise(r=>server.close(r));}
});
