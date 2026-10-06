import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('../dist/discover-conversation.js',import.meta.url),'utf8');

test('Discover opens as a prompt-first conversation, not an image-only upload',()=>{
 const listeners={};const context={window:{},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:()=>null}};
 vm.runInNewContext(script,context);
 const html=context.window.DiscoverConversation.render();
 assert.match(html,/Tell me what you’re looking for/);
 assert.match(html,/Describe a piece, add a screenshot, or use both/);
 assert.match(html,/dc-image-input/);
 assert.match(html,/dc-text/);
 assert.ok(listeners.submit&&listeners.change&&listeners.click);
 assert.doesNotMatch(html,/natural-language discovery are next/i);
});

test('a text prompt is interpreted and reviewed before any shopping search',async()=>{
 const listeners={},calls=[];let latest='';
 const page={set outerHTML(value){latest=value;}};
 const context={window:{},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:id=>id==='discover-conversation'?page:null},AbortController,fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({attributes:{category:'Blazer',colour:'brown',fit:'relaxed',pattern:'',details:'',subtype:'',features:'',department:'womenswear'},query:'relaxed brown blazer',budget:4000,uncertainty:'Fabric unclear',question:''})};}};
 vm.runInNewContext(script,context);
 listeners.input({target:{id:'dc-text',value:'Find a relaxed brown blazer under ₹4,000'}});
 listeners.submit({target:{id:'dc-compose'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/discover/interpret');
 assert.equal(calls[0].body.text,'Find a relaxed brown blazer under ₹4,000');
 assert.match(latest,/Is this the right piece/);
 assert.match(latest,/Search phrase/);
 assert.match(latest,/Find matches/);
 assert.doesNotMatch(latest,/Search results/);
});
