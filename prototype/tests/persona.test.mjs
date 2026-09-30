import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createPhotos} from '../lib/photos.mjs';
const sandbox={module:{exports:{}}};vm.runInNewContext(readFileSync(new URL('../dist/persona.js',import.meta.url),'utf8'),sandbox);
const {clean,summary}=sandbox.module.exports;
test('persona requires all four explicit choices and rejects unknown stored values',()=>{
 assert.equal(summary({current:'street'}).complete,false);
 const p={current:'street',occasion:'work',priority:'comfort',target:'minimal'};
 assert.equal(summary(p).complete,true);assert.equal(summary(p).target,'Clean & minimal');
 assert.equal(clean({current:'fake',token:'secret'}).token,undefined);assert.equal(clean({current:'fake'}).current,undefined);
 assert.equal(clean({note:'a'.repeat(300)}).note.length,240);
});
test('Google Photos disabled configuration and missing auth make no provider calls',async()=>{
 const service=createPhotos({env:{},fetchImpl:()=>{throw Error('must not call')}});
 await assert.rejects(service.run('create',{},'token'),{status:503});
 await assert.rejects(createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'}}).run('create',{},''),{status:401});
});
test('picker collection waits for explicit selection, only fetches selected safe images',async()=>{
 const calls=[];const service=createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'},fetchImpl:async(url,options)=>{
 calls.push(url);assert.equal(options.headers.Authorization,'Bearer test-token');
 if(url.includes('/sessions/'))return Response.json({mediaItemsSet:true});
 if(url.includes('/mediaItems'))return Response.json({mediaItems:[{type:'PHOTO',mediaFile:{baseUrl:'https://lh3.googleusercontent.com/photo'}},{type:'PHOTO',mediaFile:{baseUrl:'https://evil.example/photo'}},{type:'VIDEO',mediaFile:{baseUrl:'https://lh3.googleusercontent.com/video'}}]});
 return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
 }});
 const result=await service.run('collect',{sessionId:'abc'},'test-token');assert.equal(result.images.length,1);assert.equal(calls.length,3);assert.ok(!JSON.stringify(calls).includes('evil'));
 await assert.rejects(service.run('collect',{sessionId:'../other'},'test-token'),{status:400});
});
test('picker pending, upstream expiry and cleanup are explicit',async()=>{
 const pending=createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'},fetchImpl:async()=>Response.json({mediaItemsSet:false,pollingConfig:{pollInterval:'5s'}})});
 assert.equal((await pending.run('collect',{sessionId:'abc'},'token')).ready,false);
 const expired=createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'},fetchImpl:async()=>new Response('',{status:401})});
 await assert.rejects(expired.run('collect',{sessionId:'abc'},'token'),{status:401});
 let method;const cleanup=createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'},fetchImpl:async(u,o)=>{method=o.method;return new Response(null,{status:204})}});
 assert.equal((await cleanup.run('delete',{sessionId:'abc'},'token')).ok,true);assert.equal(method,'DELETE');
});

test('chat actions complete, edit and persist an explicit target persona',async()=>{
 const handlers={},stored={};let updates=0;
 const document={addEventListener:(name,fn)=>handlers[name]=fn};
 const window={document,dispatchEvent:()=>updates++};
 const context={window,document,localStorage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v},Event:class{},fetch:async()=>({json:async()=>({})}),URL};
 vm.runInNewContext(readFileSync(new URL('../dist/persona.js',import.meta.url),'utf8'),context);
 const click=async(action,value)=>handlers.click({target:{closest:()=>({dataset:{persona:action,value}})}});
 for(const value of ['street','work','comfort','minimal'])await click('answer',value);
 assert.equal(window.Persona.summary().complete,true);
 assert.match(window.Persona.render(),/TARGET PERSONA/);
 assert.equal(JSON.parse(stored['tbw-persona-v1']).target,'minimal');
 await click('edit');assert.match(window.Persona.render(),/What feels closest/);
 assert.equal(updates,5);
});
