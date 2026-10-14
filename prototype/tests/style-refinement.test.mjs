import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,editCanvas,validateCanvas,freezeDesign} from '../dist/style-me/canvas.js';
import {refineBrief} from '../dist/style-me/constraints.js';
import {wardrobeRecords} from '../dist/style-me/wardrobe-adapter.js';
import {createDraftEditor} from '../dist/style-me/draft-editor.js';
import {createStyleEngine,normalizeWardrobe,tripSuggestions,sanitizeBrief} from '../lib/style-engine.mjs';
const piece=(id,slot,name=id)=>({id,slot,name,source:'concept',ownership:'unowned',assetVersion:'1'});
const base=()=>createCanvas({id:'draft',brief:{mode:'from-scratch'},items:[piece('shirt','top'),piece('pants','bottom'),piece('shoes','shoes')]});
test('compound chat refinement retains occasion and updates budget, exclusions and aesthetic',()=>{
 const b=refineBrief({mode:'mixed',occasion:'Office dinner',exclusions:'wool',budget:5000},'less formal, no heels, under ₹3,000');
 assert.equal(b.occasion,'Office dinner');assert.equal(b.budget,3000);assert.equal(b.aesthetic,'More casual');assert.match(b.exclusions,/heels/);assert.match(b.exclusions,/wool/);
});
test('all slots enforce exclusions and coverage before freezing',()=>{
 const c=base();c.brief.exclusions='no heels and leather';c.items[2].name='Suede heeled boots';c.brief.coverage='covered arms';c.items[0].name='Sleeveless shirt';
 const issues=validateCanvas(c);assert.ok(issues.some(i=>i.code==='EXCLUDED'));assert.ok(issues.some(i=>i.code==='COVERAGE'));
 assert.throws(()=>freezeDesign(c,0,{id:'frozen',createdAt:'now'}),e=>e.code==='INVALID_OUTFIT');
});
test('valid explicit clothing layers and free board transforms survive immutable freeze',()=>{
 let c=base();c.items[0].layer=0;c=editCanvas(c,0,{type:'add',item:{...piece('overshirt','top'),layer:1}});
 assert.deepEqual(validateCanvas(c),[]);c=editCanvas(c,1,{type:'move',itemId:'shirt',x:.3,y:.2,scale:1.5,rotation:45,depth:7});
 const f=freezeDesign(c,2,{id:'f',createdAt:'now'});assert.equal(f.layout.shirt.rotation,45);assert.equal(f.items.find(i=>i.id==='overshirt').layer,1);
 assert.throws(()=>editCanvas(c,2,{type:'move',itemId:'shirt',x:.3,y:.2,scale:8}),e=>e.code==='INVALID_POSITION');
 assert.throws(()=>editCanvas(c,2,{type:'describe',itemId:'shirt',patch:{layer:99}}),e=>e.code==='INVALID_LAYER');
});
test('pins protect correction and placement as well as replacement',()=>{
 const c=editCanvas(base(),0,{type:'pin',itemId:'shirt'});
 for(const action of [{type:'describe',itemId:'shirt',patch:{name:'changed'}},{type:'move',itemId:'shirt',x:.2,y:.3}])assert.throws(()=>editCanvas(c,1,action),e=>e.code==='PINNED_ITEM');
});
test('wardrobe projection preserves Indian categories, lifecycle and version changes without mutating records',()=>{
 const records=[{id:'import:kurta.1',name:'Navy kurta',category:'Ethnic wear',status:'available',imageVersion:'one'},{id:'lent',name:'Shirt',category:'Shirts',status:'lent'},{id:'archive',name:'Archive',category:'Shirts',archived:true},{id:'unknown',name:'Other',category:'Unknown'}];
 const before=structuredClone(records),mapped=wardrobeRecords(records,{canonical:true});assert.deepEqual(records,before);assert.equal(mapped.length,2);assert.equal(mapped[0].slot,'top');assert.equal(mapped[0].source,'wardrobe');assert.equal(mapped[1].available,false);
 assert.equal(normalizeWardrobe(mapped)[0].ownership,'confirmed');assert.equal(normalizeWardrobe(mapped)[0].itemRevision,mapped[0].itemRevision);
 const changed=wardrobeRecords([{...records[0],status:'laundry'}],{canonical:true});assert.notEqual(changed[0].itemRevision,mapped[0].itemRevision);
 assert.equal(wardrobeRecords([records[0]])[0].ownership,'user-described');
});
test('change only the shoes preserves all other pieces without temporary pins',async()=>{
 const engine=createStyleEngine({env:{}}),current=base().items;
 const out=await engine.generate({brief:{mode:'from-scratch',request:'change only the shoes'},wardrobe:[],current});
 assert.ok(out.looks.length);for(const look of out.looks){assert.equal(look.items.find(i=>i.slot==='top').id,'shirt');assert.equal(look.items.find(i=>i.slot==='bottom').id,'pants');}
});
test('trip essentials distinguish mountain, beach and work without fabricating products',()=>{
 const mountain=tripSuggestions(sanitizeBrief({mode:'mixed',request:'Himachal holiday'}),[]),beach=tripSuggestions(sanitizeBrief({mode:'mixed',request:'Varkala beach holiday'}),[]);
 assert.ok(mountain.some(s=>s.item.id==='essential-mountain-jacket'));assert.ok(mountain.some(s=>s.item.id==='essential-scarf'&&s.priority==='optional'));assert.ok(beach.some(s=>s.item.id==='essential-flip-flops'));
 assert.ok([...mountain,...beach].every(s=>s.item.ownership==='unowned'&&!s.item.price&&!s.item.url));
});
test('local edits are immediate while network writes are ordered and cannot replace newer state',async()=>{
 let session={id:'draft',canvas:base()},remote=structuredClone(session),release,calls=0;
 const editor=createDraftEditor({read:()=>session,write:s=>session=s,send:async(id,body)=>{calls++;if(calls===1)await new Promise(r=>release=r);remote.canvas=editCanvas(remote.canvas,body.revision,body.action);return structuredClone(remote);}});
 const a=editor.edit({type:'move',itemId:'shirt',x:.2,y:.3});assert.equal(session.canvas.revision,1);assert.equal(session.canvas.layout.shirt.x,.2);
 const b=editor.edit({type:'move',itemId:'pants',x:.7,y:.6});assert.equal(session.canvas.revision,2);await Promise.resolve();assert.equal(calls,1);release();await Promise.all([a,b]);assert.deepEqual(session.canvas,remote.canvas);assert.equal(editor.pending,0);
});
test('failed local save cancels dependent queued writes and exposes recovery',async()=>{
 let session={id:'draft',canvas:base()},calls=0,failed=0;
 const editor=createDraftEditor({read:()=>session,write:s=>session=s,send:async()=>{calls++;throw new Error('offline');},onFailure:()=>{failed++;session={id:'draft',canvas:base()};}});
 const a=editor.edit({type:'remove',itemId:'shoes'}),b=editor.edit({type:'remove',itemId:'shirt'});await assert.rejects(a,/offline/);await b;assert.equal(calls,1);assert.equal(failed,1);assert.equal(session.canvas.items.length,3);
});

test('retry resends exact request IDs and preserves all local edits after an outage',async()=>{
 let session={id:'draft',canvas:base()},remote=structuredClone(session),online=false;
 const requests=[];
 const editor=createDraftEditor({read:()=>session,write:s=>session=s,send:async(id,body)=>{requests.push(body.requestId);if(!online)throw new Error('offline');remote.canvas=editCanvas(remote.canvas,body.revision,body.action);return structuredClone(remote);}});
 const a=editor.edit({type:'move',itemId:'shirt',x:.2,y:.3}),b=editor.edit({type:'move',itemId:'pants',x:.7,y:.6});await assert.rejects(a);await b;
 assert.equal(session.canvas.revision,2);assert.equal(editor.failed,true);assert.equal(editor.pending,2);await assert.rejects(editor.flush());online=true;await editor.retry();assert.equal(requests[0],requests[1]);assert.deepEqual(session.canvas,remote.canvas);assert.equal(editor.pending,0);
});

test('canonical wardrobe basics retain their declared colour and generated asset',()=>{
 const basic={id:'basic-kurta',name:'Ivory kurta',category:'Ethnic wear',type:'kurta',source:'Basics',art:{shape:'kurta',colour:'#eee4c7'},image:'data:image/svg+xml,fixture',owned:true};
 const mapped=wardrobeRecords([basic],{canonical:true})[0];assert.equal(mapped.source,'wardrobe');assert.equal(mapped.colour,'#eee4c7');assert.equal(mapped.image,basic.image);assert.equal(mapped.slot,'top');
});
