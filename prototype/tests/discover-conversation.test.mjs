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

test('the search bar carries a model choice, sends it with every request, and shows how results were retrieved',async()=>{
 const listeners={},calls=[];let latest='';
 const page={set outerHTML(value){latest=value;}};
 const replies={interpret:{attributes:{category:'shirt',colour:'black',fit:'relaxed',pattern:'',details:'linen',subtype:'',features:'',department:'menswear'},query:'black linen shirt',budget:2000,uncertainty:'',question:'',credits:{remaining:112,cost:8},turn:'n.1.o.sig'},
  search:{results:[{title:'Black linen shirt',url:'https://www.snitch.com/p',merchant:'Snitch',priceText:'₹1,499'}],warnings:[],trace:{queries:['black linen shirt men','black linen shirt men · Google Shopping India','black relaxed linen shirt (site:myntra.com OR site:snitch.com)'],retrieved:24,titleRejected:5,domesticRejected:3,visuallyAssessed:6,elapsedMs:4200,providerFailures:[]}}};
 const context={window:{},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:id=>id==='discover-conversation'?page:null},AbortController,FormData:class{constructor(){this.v={category:'shirt',colour:'black',fit:'relaxed',details:'linen',query:'black linen shirt',budget:'2000'};}get(k){return this.v[k];}},
  fetch:async(url,options)=>{const action=url.split('/').pop();calls.push({action,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>replies[action]};}};
 vm.runInNewContext(script,context);
 let html=context.window.DiscoverConversation.render();
 assert.match(html,/id="dc-model"/);assert.match(html,/Gemini 3 Flash · 15 credits/);assert.match(html,/GPT-5 nano · 8 credits/);
 listeners.change({target:{id:'dc-model',value:'gpt-5-nano'}});
 listeners.input({target:{id:'dc-text',value:'black linen shirt under 2000'}});
 listeners.submit({target:{id:'dc-compose'},preventDefault(){}});
 await new Promise(r=>setImmediate(r));
 assert.equal(calls[0].action,'interpret');assert.equal(calls[0].body.model,'gpt-5-nano');
 assert.match(latest,/GPT-5 nano · 8 credits · 112 left/);
 listeners.submit({target:{id:'dc-review'},preventDefault(){}});
 await new Promise(r=>setImmediate(r));
 assert.equal(calls[1].action,'search');assert.equal(calls[1].body.turn,'n.1.o.sig','the search ticket from the answer is sent back');assert.equal(calls[1].body.model,'gpt-5-nano');
 assert.match(latest,/How I searched · 3 searches · 4\.2s/);
 assert.equal((latest.match(/<code>black linen shirt men<\/code>/g)||[]).length,1,'a phrase sent to two routes is listed once');
 assert.match(latest,/<small>Google Shopping India<\/small>/);
 assert.match(latest,/black relaxed linen shirt \(site:myntra\.com OR site:snitch\.com\)/);
 assert.match(latest,/24 found · 8 off-topic or outside India removed · 6 compared against your piece · <b>1 shown<\/b>/);
 assert.match(latest,/under ₹2,000/);
});
