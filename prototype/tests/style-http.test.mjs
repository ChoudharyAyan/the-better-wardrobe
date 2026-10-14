import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from '../server.mjs';
import {createStyleMe} from '../lib/style-me.mjs';
test('Style API creates/resumes private sessions, rejects cross-origin edits, and hides other owners',async()=>{
 const service=createStyleMe({env:{}}),server=createServer(...Array(12).fill(undefined),service);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const id=randomUUID();const create=await fetch(base+'/api/style/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,brief:{mode:'from-scratch'}})});assert.equal(create.status,201);
  const cookie=create.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/style/sessions/'+id,{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(base+'/api/style/sessions/'+id)).status,404);
  assert.equal((await fetch(base+'/api/style/sessions/'+id+'/edit',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'})).status,403);
  const payload={requestId:randomUUID(),revision:0,action:{type:'add',item:{id:'shirt',name:'White shirt',slot:'top',source:'concept',ownership:'unowned'}}};
  const result=await fetch(base+'/api/style/sessions/'+id+'/edit',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(result.status,200);
  const stale=await fetch(base+'/api/style/sessions/'+id+'/edit',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:randomUUID()})});assert.equal(stale.status,409);
  assert.equal((await fetch(base+'/api/style/status')).headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));}
});
