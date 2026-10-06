import test from 'node:test';
import assert from 'node:assert/strict';
import {createCredits} from '../lib/credits.mjs';
import {createServer} from '../server.mjs';

const memory=()=>{const m=new Map();return {async add(k,a,l){const n=(m.get(k)||0)+a;if(n>l)return null;m.set(k,n);return n;},async sub(k,a){m.set(k,Math.max(0,(m.get(k)||0)-a));},async get(k){return m.get(k)||0;}};};

test('120 credits buy exactly 8 Gemini 3 Flash or 15 GPT-5 nano searches',async()=>{
 for(const [model,expected] of [['gemini-3-flash',8],['gpt-5-nano',15]]){
  const c=createCredits({env:{},store:memory()});let n=0;
  while(true){try{await c.charge({guest:'g',ip:'1.1.1.1',model});n++;}catch(e){assert.equal(e.status,429);assert.equal(e.reason,'guest');break;}}
  assert.equal(n,expected,model);
 }
 const mixed=createCredits({env:{},store:memory()});
 for(let i=0;i<4;i++)await mixed.charge({guest:'g',ip:'ip',model:'gemini-3-flash'});
 assert.equal((await mixed.summary('g')).remaining,60);
 assert.equal((await mixed.charge({guest:'g',ip:'ip',model:'gpt-5-nano'})).remaining,52,'mixing models draws from one wallet');
});

test('failed searches are refunded, and the IP and daily caps hold even with new guests',async()=>{
 const c=createCredits({env:{DISCOVER_IP_DAILY_CREDITS:'150',DISCOVER_DAILY_CREDIT_CAP:'200'},store:memory()});
 await c.charge({guest:'a',ip:'9.9.9.9',model:'gemini-3-flash'});await c.refund({guest:'a',ip:'9.9.9.9',model:'gemini-3-flash'});
 assert.equal((await c.summary('a')).remaining,120,'a failed search costs nothing');
 // Clearing cookies (new guest ids) on one network stops at the IP's daily allowance: 150 credits = 10 Gemini searches.
 let n=0;for(let i=0;i<20;i++){try{await c.charge({guest:'cookie-'+i,ip:'9.9.9.9',model:'gemini-3-flash'});n++;}catch(e){assert.equal(e.reason,'ip');break;}}
 assert.equal(n,10);
 assert.equal((await c.summary('cookie-10')).remaining,120,'the guest refused by the IP cap was not charged');
 // The daily cap across everyone: 200 credits, 150 already used on that network.
 n=0;for(let i=0;i<20;i++){try{await c.charge({guest:'other-'+i,ip:'10.0.0.'+i,model:'gemini-3-flash'});n++;}catch(e){assert.equal(e.reason,'global');break;}}
 assert.equal(n,3);
});

test('a search ticket works twice, only for its guest, and cannot be forged or reused late',async()=>{
 let clock=1_000_000;const c=createCredits({env:{DISCOVER_TOKEN_SECRET:'s'},store:memory(),now:()=>clock});
 const {turn}=await c.charge({guest:'me',ip:'1',model:'gpt-5-nano'});
 assert.equal(await c.useTurn(turn,'someone-else'),false);
 assert.equal(await c.useTurn(turn,'me'),true);assert.equal(await c.useTurn(turn,'me'),true);assert.equal(await c.useTurn(turn,'me'),false,'third search needs a new question');
 const [n,e,o]=turn.split('.');assert.equal(await c.useTurn(`${n}.${Number(e)+999999}.${o}.${'0'.repeat(32)}`,'me'),false,'forged signature');
 const fresh=(await c.charge({guest:'me',ip:'1',model:'gpt-5-nano'})).turn;clock+=31*60000;
 assert.equal(await c.useTurn(fresh,'me'),false,'tickets expire after 30 minutes');
 assert.equal(await c.useTurn('','me'),false);assert.equal(await c.useTurn('a.b.c.d','me'),false);
});

test('the server charges on asking, hands back a ticket, gates shopping search on it, and refunds failures',async()=>{
 let fail=false;
 const discovery={status:()=>({shopping:true,models:[{id:'gemini-3-flash',credits:15},{id:'gpt-5-nano',credits:8}],defaultModel:'gemini-3-flash'}),
  interpret:async body=>{if(fail)throw Object.assign(new Error('model down'),{status:502});return {attributes:{category:'shirt'},query:'shirt',model:body.model};},
  search:async body=>({results:[],trace:{queries:[body.query]}})};
 const server=createServer(discovery,undefined,undefined,undefined,undefined,createCredits({env:{},store:memory()}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const first=await fetch(base+'/api/discover/credits');const cookie=first.headers.get('set-cookie').split(';')[0];
  assert.match(cookie,/^tbw_community=[a-f0-9]{48}$/);const wallet=await first.json();assert.equal(wallet.remaining,120);assert.equal(wallet.models.length,2);
  const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  const asked=await (await post('/api/discover/interpret',{text:'shirt',model:'gpt-5-nano'})).json();
  assert.equal(asked.model,'gpt-5-nano');assert.equal(asked.credits.remaining,112);assert.equal(asked.credits.cost,8);assert.ok(asked.turn);
  assert.equal((await post('/api/discover/search',{query:'shirt'})).status,403,'no ticket, no shopping search');
  assert.equal((await post('/api/discover/search',{query:'shirt',turn:asked.turn})).status,200);
  assert.equal((await post('/api/discover/interpret',{text:'shirt',model:'opus-max'})).status,200);
  assert.equal((await (await fetch(base+'/api/discover/credits',{headers:{Cookie:cookie}})).json()).remaining,97,'unknown model is billed as the default (15)');
  fail=true;assert.equal((await post('/api/discover/interpret',{text:'shirt'})).status,502);
  assert.equal((await (await fetch(base+'/api/discover/credits',{headers:{Cookie:cookie}})).json()).remaining,97,'the failed call was refunded');
 }finally{await new Promise(r=>server.close(r));}
});
