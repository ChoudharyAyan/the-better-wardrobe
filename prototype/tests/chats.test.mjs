import test from 'node:test';
import assert from 'node:assert/strict';
import {createChats,MAX_CHATS} from '../lib/chats.mjs';
import {createServer} from '../server.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let clock=0;const fresh=()=>createChats({env:{},now:()=>(clock+=1000)});

test('each guest keeps three chats; a fourth is refused with the list so the app can ask which to replace',async()=>{
 const c=fresh();
 for(let i=1;i<=MAX_CHATS;i++)await c.save('me',id(i),{title:'Chat '+i,data:{messages:[{role:'user',text:'q'+i}]}});
 await assert.rejects(c.save('me',id(4),{title:'Chat 4',data:{}}),e=>e.status===409&&e.chats.length===3&&e.chats[0].title==='Chat 3');
 await c.save('me',id(2),{title:'Renamed',data:{messages:[]}});
 assert.deepEqual((await c.list('me')).map(x=>x.title),['Renamed','Chat 3','Chat 1'],'updating an existing chat is fine and moves it to the top');
 await c.remove('me',id(1));await c.save('me',id(4),{title:'Chat 4',data:{}});
 assert.equal((await c.list('me')).length,3);
 assert.equal((await c.list('someone-else')).length,0,'guests never see each other’s chats');
 await assert.rejects(c.get('someone-else',id(2)),e=>e.status===404);
});

test('chats reject bad ids, bad payloads and oversized saves',async()=>{
 const c=fresh();
 await assert.rejects(c.save('me','../etc',{data:{}}),e=>e.status===400);
 await assert.rejects(c.save('me',id(1),{data:[1]}),e=>e.status===400);
 await assert.rejects(c.save('me',id(1),{data:{blob:'x'.repeat(400_001)}}),e=>e.status===413);
 assert.equal((await c.save('me',id(1),{title:'   ',data:{}})).title,'New search');
});

test('chat routes need a profile, follow its owner and return the 409 list',async()=>{
 const {createAccounts}=await import('../lib/accounts.mjs');
 const server=createServer({status:()=>({})},undefined,undefined,undefined,undefined,undefined,fresh(),createAccounts({env:{}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  // Guests who explore freely don't get saved chats.
  const guest=await fetch(base+'/api/discover/chats');assert.equal(guest.status,401);assert.equal((await guest.json()).signIn,true);
  const me=await fetch(base+'/api/me');const guestCookie=me.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(Object.fromEntries(Object.entries(await me.json()).filter(([k])=>['google','signedIn','previewAvailable'].includes(k))),{google:false,signedIn:false,previewAvailable:true});
  const preview=await fetch(base+'/api/auth/preview',{method:'POST',headers:{'Content-Type':'application/json',Cookie:guestCookie},body:'{}'});
  assert.equal(preview.status,200);const cookie=guestCookie+'; '+preview.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await fetch(base+'/api/discover/chats',{headers:{Cookie:cookie}})).json(),{chats:[]});
  const put=(n,title)=>fetch(base+'/api/discover/chats/'+id(n),{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({title,data:{messages:[]}})});
  for(let i=1;i<=3;i++)assert.equal((await put(i,'Chat '+i)).status,200);
  const full=await put(4,'Chat 4');assert.equal(full.status,409);assert.equal((await full.json()).chats.length,3);
  assert.equal((await (await fetch(base+'/api/discover/chats/'+id(2),{headers:{Cookie:cookie}})).json()).title,'Chat 2');
  assert.equal((await (await fetch(base+'/api/discover/chats/'+id(2),{method:'DELETE',headers:{Cookie:cookie}})).json()).chats.length,2);
  assert.equal((await fetch(base+'/api/discover/chats',{headers:{'Sec-Fetch-Site':'cross-site',Cookie:cookie}})).status,403);
  // A forged session is a guest.
  assert.equal((await fetch(base+'/api/discover/chats',{headers:{Cookie:guestCookie+'; tbw_session=cDpndWVzdA.9999999999999.forged'}})).status,401);
 }finally{await new Promise(r=>server.close(r));}
});

// Real Postgres (TEST_DATABASE_URL): the store's own statements, on temp tables inside a rolled-back transaction.
test('chat statements run on a real database',{skip:!process.env.TEST_DATABASE_URL&&'set TEST_DATABASE_URL to run'},async()=>{
 const {default:pg}=await import('pg');const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../lib/chats.mjs',import.meta.url),'utf8');
 const insert=src.match(/'(INSERT INTO tbw_discover_chats[^']+)'/)[1],list=src.match(/'(SELECT id,owner,title,data,updated_at FROM tbw_discover_chats WHERE owner[^']+)'/)[1],del=src.match(/'(DELETE FROM tbw_discover_chats[^']+)'/)[1];
 const client=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await client.connect();
 try{
  await client.query('BEGIN');await client.query('CREATE TEMP TABLE tbw_discover_chats (id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()) ON COMMIT DROP');
  await client.query(insert,['a','o1','First',JSON.stringify({messages:[{text:'hi'}]}),new Date().toISOString()]);
  await client.query(insert,['a','o1','Renamed',JSON.stringify({messages:[]}),new Date().toISOString()]);
  await client.query(insert,['a','intruder','Hijack',JSON.stringify({}),new Date().toISOString()]);
  const rows=(await client.query(list,['o1'])).rows;assert.equal(rows.length,1);assert.equal(rows[0].title,'Renamed','another owner cannot overwrite a chat');
  await client.query(del,['a','o1']);assert.equal((await client.query(list,['o1'])).rows.length,0);
 }finally{await client.query('ROLLBACK');await client.end();}
});
