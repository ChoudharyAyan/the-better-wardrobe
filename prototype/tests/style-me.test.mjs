import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStyleMe} from '../lib/style-me.mjs';
import {createStyleEngine,starterLooks,sanitizeBrief} from '../lib/style-engine.mjs';
import {createStyleStore} from '../lib/style-store.mjs';
const uuid=()=>randomUUID();
const body=extra=>({requestId:uuid(),...extra});
const garment=(name,slot)=>({id:uuid(),name,slot,source:'concept',ownership:'unowned',assetVersion:'1'});
async function setup(preview={enabled:false}){
 const svc=createStyleMe({env:{},preview}),id=uuid();await svc.create('alice',{id,brief:{mode:'from-scratch'}});
 for(const [name,slot] of [['shirt','top'],['trousers','bottom'],['shoes','shoes']]){const s=await svc.get('alice',id);await svc.edit('alice',id,body({revision:s.canvas.revision,action:{type:'add',item:garment(name,slot)}}));}
 return {svc,id};
}
test('owner isolation applies to drafts, freezes and session deletion',async()=>{
 const {svc,id}=await setup();await assert.rejects(svc.get('bob',id),e=>e.status===404);await assert.rejects(svc.remove('bob',id),e=>e.status===404);assert.equal((await svc.list('bob')).length,0);
});
test('identical retry of a mutation does not increment revision twice',async()=>{
 const {svc,id}=await setup();const input=body({revision:3,action:{type:'pin',itemId:(await svc.get('alice',id)).canvas.items[0].id}});
 const one=await svc.edit('alice',id,input),two=await svc.edit('alice',id,input);assert.equal(one.canvas.revision,two.canvas.revision);
 await assert.rejects(svc.edit('alice',id,{...input,action:{type:'undo'}}),e=>e.status===409);
});
test('freezing and subsequent edits preserve the selected snapshot',async()=>{
 const {svc,id}=await setup();const result=await svc.freeze('alice',id,body({revision:3}));
 const frozen=result.frozen[0];await svc.edit('alice',id,body({revision:3,action:{type:'remove',itemId:result.canvas.items[0].id}}));
 const current=await svc.get('alice',id);assert.equal(current.frozen[0].items.length,3);assert.equal(current.canvas.items.length,2);assert.equal(current.frozen[0].id,frozen.id);
});
test('stale freeze and conflicting draft are rejected',async()=>{
 const {svc,id}=await setup();await assert.rejects(svc.freeze('alice',id,body({revision:0})),e=>e.code==='STALE_REVISION');
 await svc.edit('alice',id,body({revision:3,action:{type:'add',item:garment('dress','onePiece')}}));await assert.rejects(svc.freeze('alice',id,body({revision:4})),e=>e.code==='INVALID_OUTFIT');
});
test('preview fails clearly when provider is not enabled',async()=>{
 const {svc,id}=await setup();await assert.rejects(svc.render('alice',id,{}),e=>e.status===503);
});
test('preview retry uses one provider call; deleted preview cannot complete',async()=>{
 let calls=0,release;const renderer={enabled:true,render:async()=>{calls++;await new Promise(r=>release=r);return {image:'data:image/png;base64,fixture',label:'Illustration'};}};
 const {svc,id}=await setup(renderer);const s=await svc.freeze('alice',id,body({revision:3}));
 const request={jobId:uuid(),designId:s.frozen[0].id,photo:'fixture',consent:true,costAccepted:true};
 const rendering=svc.render('alice',id,request);await new Promise(r=>setTimeout(r,10));
 const repeated=await svc.render('alice',id,request);assert.equal(repeated.replayed,true);assert.equal(calls,1);
 await svc.deletePreview('alice',id,request.jobId);release();await assert.rejects(rendering,e=>e.status===409);assert.equal(Object.keys((await svc.get('alice',id)).jobs).length,0);
});
test('provider failure preserves frozen outfit and records retryable failure',async()=>{
 const {svc,id}=await setup({enabled:true,render:async()=>{throw new Error('secret provider token');}});const s=await svc.freeze('alice',id,body({revision:3}));
 const request={jobId:uuid(),designId:s.frozen[0].id,photo:'fixture',consent:true,costAccepted:true};await assert.rejects(svc.render('alice',id,request));
 const saved=await svc.get('alice',id);assert.equal(saved.frozen.length,1);assert.equal(saved.jobs[request.jobId].status,'failed');assert.ok(!saved.jobs[request.jobId].error.includes('secret'));
});
test('starter suggestions stay honest for an empty owned-only inventory',()=>{
 const b=sanitizeBrief({mode:'owned-only',request:'office'});assert.deepEqual(starterLooks(b,[]),[]);
});
test('curated mode excludes rejected garments and labels the source',async()=>{
 const engine=createStyleEngine({env:{}});const out=await engine.generate({brief:{mode:'from-scratch',exclusions:'sandals',request:'beach'},wardrobe:[]});
 assert.equal(out.provider,'curated');assert.ok(out.looks.every(l=>l.items.every(i=>!i.name.toLowerCase().includes('sandals'))));
});
test('model cannot invent owned IDs, change pins or disregard exclusions',async()=>{
 const response={message:'Looks',looks:[{title:'Bad',items:[{id:'invented',name:'shirt',slot:'top'}]}]};
 const engine=createStyleEngine({env:{OPENROUTER_API_KEY:'fixture'},fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(response)}}]})})});
 await assert.rejects(engine.generate({brief:{mode:'owned-only'},wardrobe:[]}),e=>e.status===502);
});
test('concurrent local transactions retain both independent edits',async()=>{
 const store=createStyleStore({env:{STYLE_MEMORY_STORE:'true'}});
 await Promise.all([store.transact('owner',async data=>{await new Promise(r=>setTimeout(r,5));data.a=1;}),store.transact('owner',data=>{data.b=2;})]);
 assert.deepEqual(await store.transact('owner',data=>structuredClone(data)),{a:1,b:2});
});
test('guest sessions migrate to account atomically and disappear from guest scope',async()=>{
 const {svc,id}=await setup();await svc.migrate('alice','account-one');assert.equal((await svc.get('account-one',id)).canvas.items.length,3);await assert.rejects(svc.get('alice',id),e=>e.status===404);await svc.migrate('alice','account-one');assert.equal((await svc.list('account-one')).length,1);
});
test('manual Canvas exclusions are validated again before freeze',async()=>{
 const {svc,id}=await setup();await svc.edit('alice',id,body({revision:3,action:{type:'brief',patch:{exclusions:'shirt'}}}));await assert.rejects(svc.freeze('alice',id,body({revision:4})),e=>e.code==='INVALID_OUTFIT');
});
test('generation reservation blocks a second request before charging or invoking AI',async()=>{
 const {svc,id}=await setup();const request=body({revision:3});await svc.reserve('alice',id,request);await assert.rejects(svc.reserve('alice',id,request),e=>e.status===409);await svc.release('alice',id,request.requestId);await svc.reserve('alice',id,request);
});
test('starter draft is persisted before AI finishes; later edits cannot be overwritten',async()=>{
 let finish;const engine={enabled:true,generate:async input=>{await new Promise(r=>finish=r);return {provider:'ai',brief:input.brief,message:'done',looks:[]};}};
 const svc=createStyleMe({env:{},engine}),id=uuid();await svc.create('alice',{id,brief:{mode:'from-scratch'}});
 let draft;const task=svc.generate('alice',id,body({revision:0,brief:{mode:'from-scratch',request:'office'},wardrobe:[]}),undefined,event=>draft=event.session);
 await new Promise(r=>setTimeout(r,10));assert.ok(draft.looks.length);assert.equal(draft.canvas.revision,1);
 await svc.select('alice',id,body({revision:1,lookId:draft.looks[0].id}));finish();await assert.rejects(task,e=>e.status===409);assert.equal((await svc.get('alice',id)).canvas.items.length,3);
});
test('explicit preference memory is owner scoped and can be reset without losing sessions',async()=>{
 const {svc,id}=await setup();await svc.preferences('alice',{mode:'mixed',exclusions:'heels',location:'private venue',weather:'hot'});assert.equal((await svc.preferences('alice')).preferences.exclusions,'heels');assert.equal((await svc.preferences('alice')).preferences.location,undefined);assert.deepEqual((await svc.preferences('bob')).preferences,{});assert.equal((await svc.list('alice')).length,1);await svc.clearPreferences('alice');assert.deepEqual((await svc.preferences('alice')).preferences,{});assert.ok(await svc.get('alice',id));
});
test('failed local transaction rolls back instead of leaking a partial mutation',async()=>{
 const store=createStyleStore({env:{STYLE_MEMORY_STORE:'true'}});await store.transact('owner',data=>{data.good=1;});await assert.rejects(store.transact('owner',data=>{data.bad=2;throw new Error('rollback');}));assert.deepEqual(await store.transact('owner',data=>structuredClone(data)),{good:1});
});
