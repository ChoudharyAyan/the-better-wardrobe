import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createCommunity,screenLead} from '../lib/community.mjs';
import {createServer} from '../server.mjs';

test('text rubric is transparent, conservative and cannot verify an image',()=>{
 const q={title:'Where can I find brown aviator sunglasses?',detail:'Brown tinted aviator sunglasses with gold frames in F1',contextTitle:'F1'};
 const close=screenLead(q,{text:'Brown tinted aviator sunglasses with gold frames at this shop',url:'https://shop.example/sunglasses/brown-aviator'});
 assert.ok(close.score>50);assert.ok(close.score<=85);assert.equal(close.publish,true);assert.match(close.method,/not visually verified/);
 const weak=screenLead(q,{text:'Try this unrelated white hoodie',url:''});assert.equal(weak.publish,false);
});

test('shared questions, screening, votes and XP spotlight persist across guests',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'tbw-community-'));
 const service=createCommunity({env:{},file:path.join(dir,'community.json')});
 const server=createServer(undefined,undefined,undefined,undefined,service);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const session=async()=>{const r=await fetch(base+'/api/community');return {cookie:r.headers.get('set-cookie').split(';')[0],feed:await r.json()};};
 const call=async(cookie,url,body)=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{
  const asker=await session(),helper=await session();
  assert.notEqual(asker.cookie,helper.cookie);
  const question=await call(asker.cookie,'/api/community/questions',{author:'Ayan',title:'Where can I find brown aviator sunglasses?',detail:'Brown tinted aviator sunglasses with gold frames, as seen in F1.',kind:'Find this',contextTitle:'F1'});
  assert.equal(question.status,200);const id=question.body.question.id;
  const seen=await fetch(base+'/api/community',{headers:{Cookie:helper.cookie}}).then(r=>r.json());assert.equal(seen.questions[0].id,id);assert.equal(seen.questions[0].mine,false);
  const weak=await call(helper.cookie,`/api/community/questions/${id}/answers`,{author:'Maya',text:'Try this totally different white hoodie instead.'});assert.equal(weak.status,200);assert.equal(weak.body.screening.status,'needs_detail');assert.equal(weak.body.feed.viewer.wallet.balance,0);
  const pixel='data:image/png;base64,'+(await sharp({create:{width:2,height:2,channels:3,background:'#6b4f33'}}).png().toBuffer()).toString('base64');
  const good=await call(helper.cookie,`/api/community/questions/${id}/answers`,{author:'Maya',text:'Brown tinted aviator sunglasses with a gold frame may be at this store.',url:'https://shop.example/brown-aviator-sunglasses',image:pixel});
  assert.equal(good.body.screening.status,'published');assert.equal(good.body.feed.viewer.wallet.balance,10);assert.equal(good.body.feed.questions[0].answerCount,1);
  const answerId=good.body.feed.questions[0].answers[0].id;assert.match(good.body.feed.questions[0].answers[0].image,/^data:image\/webp;base64,/);
  const self=await call(helper.cookie,`/api/community/answers/${answerId}/vote`,{vote:1});assert.equal(self.status,403);
  const vote=await call(asker.cookie,`/api/community/answers/${answerId}/vote`,{vote:1});assert.equal(vote.body.feed.questions[0].answers[0].votes,1);
  const repeat=await call(asker.cookie,`/api/community/answers/${answerId}/vote`,{vote:1});assert.equal(repeat.body.feed.questions[0].answers[0].votes,1);
  const poor=await call(asker.cookie,`/api/community/questions/${id}/spotlight`,{});assert.equal(poor.status,400);
  const persisted=JSON.parse(await readFile(path.join(dir,'community.json'),'utf8'));assert.equal(persisted.questions.length,1);assert.equal(persisted.answers.length,2);
 }finally{server.closeAllConnections?.();await new Promise(r=>server.close(r));await service.close();}
});

test('production without a database fails closed rather than inventing shared state',async()=>{
 const service=createCommunity({env:{VERCEL:'1'}});
 await assert.rejects(()=>service.handle({headers:{},socket:{}},'/api/community',{}),e=>e.status===503);
});
