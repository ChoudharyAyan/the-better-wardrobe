import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('../dist/discover-conversation.js',import.meta.url),'utf8');

test('Discover opens as a prompt-first conversation, not an image-only upload',()=>{
 const listeners={};const context={window:{},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:()=>null}};
 vm.runInNewContext(script,context);
 const html=context.window.DiscoverConversation.render();
 assert.match(html,/Describe a garment you want to find/);
 assert.match(html,/Add details, a screenshot, or both/);
 assert.match(html,/dc-image-input/);
 assert.match(html,/dc-text/);
 assert.ok(listeners.submit&&listeners.change&&listeners.click);
 assert.doesNotMatch(html,/natural-language discovery are next/i);
});

// A tiny DOM-less harness: the script only needs document listeners and a node to paint into.
function harness(replies){
 const listeners={},calls=[],renders=[],windowListeners={};let latest='';
 const page={set outerHTML(value){latest=value;renders.push(value);}};
 const context={window:{addEventListener:(event,fn)=>{(windowListeners[event]??=[]).push(fn);}},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:id=>id==='discover-conversation'?page:null},AbortController,clearTimeout,clearInterval,TextDecoder,Uint8Array,
  FormData:class{constructor(form){this.v=form.values;}get(k){return this.v[k];}},
  fetch:async(url,options={})=>{const action=url.split('/').pop();const body=options.body?JSON.parse(options.body):{};calls.push({action,body,headers:options.headers});const reply=typeof replies[action]==='function'?replies[action](body):replies[action];if(reply?.events){const chunks=reply.events.map(event=>new TextEncoder().encode(JSON.stringify(event)+'\n'));let i=0;return {ok:true,status:200,headers:{get:()=> 'application/x-ndjson'},body:{getReader:()=>({read:async()=>i<chunks.length?{done:false,value:chunks[i++]}:{done:true}})}};}return {ok:reply?.status?reply.status<400:true,status:reply?.status||200,json:async()=>reply};}};
 context.TextEncoder=TextEncoder;
 vm.runInNewContext(script,context);
 const settle=()=>new Promise(r=>setImmediate(r));
 const click=(action,data={})=>listeners.click({target:{closest:sel=>sel==='[data-conversation]'?{dataset:{conversation:action,...data}}:null}});
 return {context,listeners,calls,renders,windowListeners,latest:()=>latest,settle,click,ask:async text=>{listeners.input({target:{id:'dc-text',value:text}});listeners.submit({target:{id:'dc-compose'},preventDefault(){}});for(let i=0;i<4;i++)await settle();}};
}
const shirt={category:'shirt',colour:'black',fit:'relaxed',pattern:'',details:'linen',subtype:'',features:'',department:'menswear'};
const found={results:[{title:'Black linen shirt',url:'https://www.snitch.com/p',merchant:'Snitch',priceText:'₹1,499',image:'https://img.example/p.jpg'}],warnings:[],
 storeSearches:[{store:'Myntra',url:'https://www.myntra.com/black-linen-shirt'},{store:'AJIO',url:'https://www.ajio.com/search/?text=black%20linen%20shirt'}],
 trace:{queries:['black linen shirt men','black linen shirt men · Google Shopping India','black relaxed linen shirt (site:myntra.com OR site:snitch.com)'],retrieved:24,titleRejected:5,domesticRejected:3,visuallyAssessed:6,elapsedMs:4200,providerFailures:[]}};

test('asking goes straight to results: one interpret, one search, no confirmation step',async()=>{
 const h=harness({interpret:{attributes:shirt,query:'black linen shirt',budget:2000,uncertainty:'',question:'',credits:{remaining:105,cost:15},turn:'n.1.o.sig'},search:found});
 h.context.window.DiscoverConversation.render();
 await h.ask('Find a black linen shirt under ₹2,000');
 assert.deepEqual(h.calls.map(c=>c.action),['interpret','search']);
 assert.equal(h.calls[1].body.turn,'n.1.o.sig');
 const html=h.latest();
 assert.doesNotMatch(html,/Is this the right piece/);
 assert.match(html,/Balanced · 15 credits · 105 left/);
 assert.match(html,/Searched for/);assert.match(html,/under ₹2,000/);
 assert.match(html,/Pieces that match/);assert.match(html,/Black linen shirt/);
 assert.match(html,/Search it on/);assert.match(html,/https:\/\/www\.myntra\.com\/black-linen-shirt/);
 assert.doesNotMatch(html,/How I searched/,'the search trace is not shown to people');
});

test('Discover uses server progress instead of cycling through pretend search stages',async()=>{
 const h=harness({interpret:{events:[{type:'progress',percent:10,label:'Understanding your request'},{type:'progress',percent:100,label:'Search details ready'},{type:'result',data:{attributes:shirt,query:'black linen shirt',budget:null,credits:{remaining:105,cost:15},turn:'t'}}]},search:{events:[{type:'progress',percent:35,label:'1 of 2 search routes completed'},{type:'progress',percent:100,label:'Your matches are ready'},{type:'result',data:found}]}});
 await h.ask('black linen shirt');
 assert.ok(h.calls.every(call=>call.headers?.Accept==='application/x-ndjson'));
 assert.ok(h.renders.some(html=>html.includes('Understanding your request')&&html.includes('aria-valuenow="10"')));
 assert.ok(h.renders.some(html=>html.includes('1 of 2 search routes completed')&&html.includes('aria-valuenow="35"')));
 assert.match(h.latest(),/Black linen shirt/);
});

test('the in-app mode picker offers Fast, Balanced and Thinking and the choice travels with the request',async()=>{
 const h=harness({interpret:{attributes:shirt,query:'black linen shirt',budget:null,uncertainty:'',question:'',credits:{remaining:112,cost:8},turn:'t'},search:found});
 let html=h.context.window.DiscoverConversation.render();
 assert.match(html,/Balanced · 12 credits/);assert.doesNotMatch(html,/<select/,'no native select sheet on phones');
 h.click('model-menu');await h.settle();html=h.latest();
 assert.match(html,/role="listbox"/);assert.match(html,/<b>Fast<\/b><small>Quick answers/);assert.match(html,/<b>Balanced<\/b><small>Best for most searches/);assert.match(html,/<b>Thinking<\/b><small>Slower, reads more detail/);
 h.click('pick-model',{id:'fast'});await h.settle();
 assert.match(h.latest(),/Fast · 8 credits/);assert.doesNotMatch(h.latest(),/role="listbox"/);
 await h.ask('black linen shirt');
 assert.equal(h.calls[0].body.model,'fast');assert.equal(h.calls[1].body.model,'fast');
 assert.match(h.latest(),/Fast · 8 credits · 112 left/);
});

test('editing what was understood re-runs the search for free with the same ticket',async()=>{
 const h=harness({interpret:{attributes:shirt,query:'black linen shirt',budget:null,uncertainty:'',question:'',credits:{remaining:105,cost:15},turn:'ticket'},search:found});
 h.context.window.DiscoverConversation.render();await h.ask('black linen shirt');
 h.click('edit');await h.settle();assert.match(h.latest(),/Update results/);
 h.listeners.submit({target:{id:'dc-refine',values:{category:'shirt',colour:'navy',fit:'slim',details:'linen',budget:'1500'}},preventDefault(){}});
 for(let i=0;i<4;i++)await h.settle();
 assert.deepEqual(h.calls.map(c=>c.action),['interpret','search','search'],'no second interpret, so no second charge');
 assert.equal(h.calls[2].body.turn,'ticket');assert.equal(h.calls[2].body.attributes.colour,'navy');assert.equal(h.calls[2].body.budget,1500);
});

test('an off-topic question asks back without charging and runs no search',async()=>{
 const h=harness({interpret:{attributes:null,question:'What type of garment are you looking for?',credits:{remaining:120,cost:0}}});
 h.context.window.DiscoverConversation.render();await h.ask("Let's solve a differential equation");
 assert.deepEqual(h.calls.map(c=>c.action),['interpret']);
 assert.match(h.latest(),/What type of garment are you looking for\?/);assert.match(h.latest(),/free, nothing to search yet/);
});

test('size variants of one product collapse into a single match',async()=>{
 const v=n=>({title:`Jack & Jones Men Mid-Rise Cargos (${n}) by Myntra`,url:'https://www.google.com/shopping/product/'+n,merchant:'Myntra',priceText:'₹2,205'});
 const h=harness({interpret:{attributes:{...shirt,category:'cargo pants'},query:'olive cargo pants',budget:null,uncertainty:'',question:'',credits:{remaining:105,cost:15},turn:'t'},search:{...found,results:[v(36),v(34),v(32),{title:'Snitch Olive Cargo Pants',url:'https://www.snitch.com/c',merchant:'Snitch',priceText:'₹1,399'}]}});
 h.context.window.DiscoverConversation.render();await h.ask('olive cargo pants');
 const html=h.latest();
 assert.equal((html.match(/class="dc-result"/g)||[]).length,2);assert.match(html,/Found 2 matches/);
});

test('the reply says whose styles are shown: both when unknown, one when asked',async()=>{
 const both=harness({interpret:{attributes:{...shirt,department:''},query:'black linen shirt',budget:null,credits:{remaining:105,cost:15},turn:'t'},search:found});
 await both.ask('black linen shirt');
 assert.match(both.latest(),/I’ll show both men’s and women’s styles\. Say “men’s” or “women’s” to narrow it\./);
 assert.match(both.latest(),/<span>men’s &amp; women’s<\/span>/);
 const womens=harness({interpret:{attributes:{...shirt,department:'womenswear'},query:'black linen shirt',budget:null,credits:{remaining:105,cost:15},turn:'t'},search:found});
 await womens.ask("black linen shirt for women");
 assert.match(womens.latest(),/Showing women&#39;s styles\. Say “men&#39;s” if you want the other\./);
});
test('saved chats stay visible as tabs for people with a profile; guests are invited to set one up',async()=>{
 const h=harness({});
 assert.match(h.context.window.DiscoverConversation.render(),/Set up a profile to save and revisit chats.*data-ob="sign-in"/s);
 h.context.window.TBWAccount={signedIn:true,profile:null};
 assert.match(h.context.window.DiscoverConversation.render(),/Your chats <em>0\/3<\/em>.*Your searches are saved here.*＋ New chat/s);
});
test('trending looks: three shown, shuffled, leaning to the profile, and a tap searches the look by id',async()=>{
 const looks=[...Array(8)].map((_,i)=>({id:'l'+i,who:'Who '+i,label:'Look '+i,department:i<4?'menswear':'womenswear'}));
 const h=harness({looks:{looks},interpret:body=>({attributes:{...shirt},query:'q',budget:null,credits:{remaining:105,cost:15},turn:'t',echo:body}),search:found});
 h.context.window.TBWAccount={signedIn:true,profile:{gender:'female'}};h.context.window.fetch=(...a)=>h.context.fetch(...a);
 h.context.window.DiscoverConversation.render();await h.settle();
 const html=h.latest();const ids=[...html.matchAll(/data-conversation="look" data-index="\d">.*?Look (\d)/g)].map(m=>Number(m[1]));
 assert.equal(ids.length,3);assert.ok(ids.filter(i=>i>=4).length>=2,'two of three are womenswear for a female profile');
 assert.match(html,/Shuffle ↻/);
 h.click('look',{index:'0'});for(let i=0;i<4;i++)await h.settle();
 const asked=h.calls.find(c=>c.action==='interpret');assert.equal(asked.body.look,'l'+ids[0]);assert.equal(asked.body.image,undefined);
 assert.equal(h.calls.filter(c=>c.action==='search').length,1);
});

test('QA v5: loading never names stores, a look note is said out loud, and no browser permission is asked',async()=>{
 const src=script;
 assert.doesNotMatch(src,/Searching Myntra|Checking Flipkart|requestPermission|new Notification/);
 const h=harness({interpret:{attributes:{...shirt,category:'Coat',subtype:'shearling collar leather coat',colour:''},query:'shearling collar leather coat men',budget:null,credits:{remaining:105,cost:15},turn:'t',look:{id:'blade-runner-k-coat',who:'Ryan Gosling · Blade Runner 2049',note:'In Blade Runner 2049, Ryan Gosling’s signature piece is a dark leather coat with a big shearling collar, not a suit.'}},search:found});
 h.context.window.TBWAccount={signedIn:true,profile:{name:'Ayan Choudhary'}};
 await h.ask('ryan gosling suit from blade runner');
 assert.match(h.latest(),/signature piece is a dark leather coat with a big shearling collar, not a suit\. Looking for/);
 const search=h.calls.find(c=>c.action==='search');assert.equal(search.body.look,'blade-runner-k-coat');
});

test('a mascot keeps the person company while a search loads, and Profile can show the credits card',async()=>{
 const h=harness({interpret:()=>new Promise(()=>{})});
 h.listeners.input({target:{id:'dc-text',value:'white shirt'}});h.listeners.submit({target:{id:'dc-compose'},preventDefault(){}});await h.settle();
 assert.match(h.latest(),/class="dc-mascot" aria-label="(Bao the panda|Momo the pug|Miso the cat|Kitsu the fox) is searching with you"/);
 assert.equal(typeof h.context.window.DiscoverConversation.creditsCard,'function');
});

test('design QA #20: an empty Discover greets with a mascot instead of the star, and a tap swaps the friend',async()=>{
 const h=harness({});const html=h.context.window.DiscoverConversation.render();
 assert.doesNotMatch(html,/dc-spark|✳/);
 const who=html.match(/aria-label="(\w+) the \w+ says hi/)[1];
 h.click('mascot');assert.notEqual(h.latest().match(/aria-label="(\w+) the \w+ says hi/)[1],who,'tapping meets a different friend');
});

test('tapping a trending look searches straight away, keeping its researched identity',async()=>{
 const look={id:'don-draper-aviators',who:'Don Draper · Mad Men',label:'Don Draper’s gold aviators',department:'menswear'};
 const h=harness({credits:{remaining:120},looks:{looks:[look]},interpret:{attributes:shirt,query:'gold aviator sunglasses',turn:'look-ticket'},search:found});
 h.context.window.fetch=h.context.fetch;
 h.context.window.dispatchEvent=()=>{};h.context.Event=class {};
 h.context.window.StickerStudio={guide:()=>'',lookArt:()=>'',modelModes:()=>'',promptChips:()=>'',modelModes:()=>'',skeletons:()=>'',lookSource:()=>'',skeletons:()=>''};
 h.context.window.DiscoverConversation.render();for(let i=0;i<4;i++)await h.settle();
 await h.click('look',{index:'0'});for(let i=0;i<6;i++)await h.settle();
 const interpret=h.calls.find(c=>c.action==='interpret');assert.equal(interpret.body.look,look.id,'researched look identity is preserved');
 assert.equal(h.calls.filter(c=>c.action==='search').length,1);
});


test('Mall invitation appears immediately and browsing keeps the search running',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});
 const h=harness({interpret:pending,search:found});
 h.context.window.StickerStudio={guide:()=>'',subnav:()=>'',promptChips:()=>'',modelModes:()=>'',skeletons:()=>'',lookSource:()=>''};
 h.context.location={hash:'#discover/ask'};h.context.Event=Event;h.context.window.dispatchEvent=()=>{};
 h.context.window.DiscoverConversation.render();
 await h.ask('black linen shirt');
 assert.match(h.latest(),/Explore The Mall while I search for you/);
 assert.match(h.latest(),/data-conversation="explore-mall"/);
 assert.match(h.latest(),/We’ll let you know when your results are ready/);
 h.click('explore-mall');await h.settle();
 assert.equal(h.context.location.hash,'discover/mall');
 assert.deepEqual(h.calls.map(c=>c.action),['interpret']);
 finish({attributes:shirt,query:'black linen shirt',question:'',turn:'ticket'});
 for(let i=0;i<6;i++)await h.settle();
 assert.deepEqual(h.calls.map(c=>c.action),['interpret','search']);
 assert.match(h.context.window.DiscoverConversation.render(),/Black linen shirt/);
 assert.doesNotMatch(h.context.window.DiscoverConversation.render(),/data-conversation="explore-mall"/);
});


test('unmounted mobile search retains its ticket, prompt, progress and ready notification',async()=>{
 let interpretDone,searchDone;const interpret=new Promise(r=>interpretDone=r),search=new Promise(r=>searchDone=r);
 const h=harness({interpret,search});
 h.context.window.StickerStudio={guide:()=>'',promptChips:()=>'',modelModes:()=>'',skeletons:()=>''};
 h.context.Event=Event;h.context.window.dispatchEvent=()=>{};h.context.setTimeout=fn=>fn();
 h.context.location={hash:'#discover/ask'};
 let mounted=true,pill=null;const original=h.context.document.getElementById;
 h.context.document.getElementById=id=>id==='dc-ready-pill'?pill:mounted?original(id):null;
 h.context.document.createElement=()=>({innerHTML:'',setAttribute(){},remove(){pill=null;}});
 h.context.document.body={append(node){pill=node;}};
 h.context.document.querySelector=()=>null;
 await h.ask('black linen shirt');
 h.click('explore-mall');h.context.location.hash='#discover/mall';mounted=false;
 for(const fn of h.windowListeners.hashchange||[])fn();
 assert.match(pill.innerHTML,/Search continues/);assert.match(pill.innerHTML,/black linen shirt/);
 interpretDone({attributes:shirt,query:'black linen shirt',turn:'same-ticket'});
 for(let i=0;i<4;i++)await h.settle();
 assert.equal(h.calls.find(c=>c.action==='search').body.turn,'same-ticket');
 assert.match(pill.innerHTML,/Back to my search/);
 h.click('show-results');mounted=true;h.context.location.hash='#discover/ask';
 for(const fn of h.windowListeners.hashchange||[])fn();
 assert.equal(pill,null);assert.match(h.context.window.DiscoverConversation.render(),/dc-loading/);
 h.click('explore-mall');mounted=false;h.context.location.hash='#discover/mall';
 for(const fn of h.windowListeners.hashchange||[])fn();
 searchDone(found);for(let i=0;i<6;i++)await h.settle();
 assert.match(pill.innerHTML,/Your picks are ready/);assert.match(pill.innerHTML,/See results/);
 h.click('show-results');assert.equal(h.context.location.hash,'discover/ask');mounted=true;
 const html=h.context.window.DiscoverConversation.render();assert.match(html,/Black linen shirt/);assert.match(html,/black linen shirt/);
 assert.equal(h.calls.filter(c=>c.action==='interpret').length,1);assert.equal(h.calls.filter(c=>c.action==='search').length,1);
});

test('screenshot choices render with Sticker Studio and browser timers',async()=>{
 const h=harness({detect:{items:[{label:'Jacket'},{label:'Trousers'}]}});
 h.context.window.StickerStudio={guide:()=>'',promptChips:()=>'',modelModes:()=>'',skeletons:()=>''};
 h.context.Event=Event;h.context.window.dispatchEvent=()=>{};
 h.context.createImageBitmap=async()=>({width:20,height:20,close(){}});
 h.context.document.createElement=()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,test'});
 await h.listeners.change({target:{id:'dc-image-input',files:[{type:'image/jpeg',size:10}]}});
 h.listeners.submit({target:{id:'dc-compose'},preventDefault(){}});for(let i=0;i<4;i++)await h.settle();
 assert.match(h.latest(),/Which piece should I look for/);assert.match(h.latest(),/Jacket/);assert.match(h.latest(),/Trousers/);
});

test('Ask Bao in the app: one bounded panel, a growing composer, three modes and a cue instead of speech bubbles',async()=>{
 const h=harness({credits:{remaining:120,models:[{id:'fast',label:'Fast',note:'Quick answers',credits:8},{id:'balanced',label:'Balanced',note:'Best for most searches',credits:12},{id:'thinking',label:'Thinking',note:'Slower, reads more detail',credits:15}],defaultModel:'balanced'},interpret:{attributes:shirt,query:'black linen shirt',question:'',credits:{remaining:105,cost:15},turn:'t'},search:found});
 h.context.window.fetch=h.context.fetch;h.context.window.dispatchEvent=()=>{};h.context.Event=class {};
 h.context.window.StickerStudio={friend:who=>`<span class="ss-bao" data-friend="${who}"></span>`,icon:name=>`<svg data-icon="${name}"></svg>`,guide:()=>'<div class="ss-guide">bubble</div>',lookArt:()=>'',skeletons:()=>''};
 h.context.window.DiscoverConversation.render();for(let i=0;i<4;i++)await h.settle();
 let html=h.latest();
 assert.match(html,/class="dc-shell dc-pro"/);assert.match(html,/class="dc-pro-panel"/);assert.match(html,/<strong>Ask Bao<\/strong>/);
 assert.doesNotMatch(html,/ss-guide/,'no comic speech bubble');
 assert.match(html,/class="dc-pro-cue dc-pro-cue-(compliment|quote|tip)"/,'a cue: a compliment, a fashion quote or a tip');
 assert.match(html,/data-conversation="explore-mall"/,'the Mall is one of the suggestions');
 assert.match(html,/<textarea id="dc-text" rows="1"[^>]*enterkeyhint="send"/,'starts one line high and grows');
 assert.match(html,/10 searches left/);
 assert.doesNotMatch(html,/class="dc-pro-modebar"/,'modes stay folded until asked for');assert.match(html,/data-conversation="modes-toggle"[^>]*>Balanced/);
 h.click('modes-toggle');await h.settle();html=h.latest();assert.match(html,/class="dc-pro-modebar" role="radiogroup"/);assert.equal((html.match(/data-conversation="pick-model"/g)||[]).length,3);
 assert.match(html,/aria-checked="true" data-conversation="pick-model" data-id="balanced"/);
 h.click('pick-model',{id:'thinking'});await h.settle();assert.doesNotMatch(h.latest(),/class="dc-pro-modebar"/,'picking a mode folds the switch');assert.match(h.latest(),/data-conversation="modes-toggle"[^>]*>Thinking/);assert.match(h.latest(),/8 searches left/);
 assert.match(h.latest(),/class="dc-pro-audience"/);h.click('audience',{value:'womenswear'});await h.settle();
 await h.ask('black linen shirt');
 const asked=h.calls.find(c=>c.action==='interpret').body;assert.equal(asked.model,'thinking');assert.equal(asked.audience,'womenswear','the For filter travels with the question');
 assert.doesNotMatch(h.latest(),/How I searched/);assert.match(h.latest(),/class="dc-shell dc-pro dc-flow"/,'after a question the page scrolls like a chat');
 assert.match(h.latest(),/dc-pro-loader|Pieces that match/);
});
