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

// A tiny DOM-less harness: the script only needs document listeners and a node to paint into.
function harness(replies){
 const listeners={},calls=[];let latest='';
 const page={set outerHTML(value){latest=value;}};
 const context={window:{},document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:id=>id==='discover-conversation'?page:null},AbortController,
  FormData:class{constructor(form){this.v=form.values;}get(k){return this.v[k];}},
  fetch:async(url,options={})=>{const action=url.split('/').pop();const body=options.body?JSON.parse(options.body):{};calls.push({action,body});const reply=typeof replies[action]==='function'?replies[action](body):replies[action];return {ok:reply?.status?reply.status<400:true,status:reply?.status||200,json:async()=>reply};}};
 vm.runInNewContext(script,context);
 const settle=()=>new Promise(r=>setImmediate(r));
 const click=(action,data={})=>listeners.click({target:{closest:sel=>sel==='[data-conversation]'?{dataset:{conversation:action,...data}}:null}});
 return {context,listeners,calls,latest:()=>latest,settle,click,ask:async text=>{listeners.input({target:{id:'dc-text',value:text}});listeners.submit({target:{id:'dc-compose'},preventDefault(){}});for(let i=0;i<4;i++)await settle();}};
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
 assert.match(html,/Max · 15 credits · 105 left/);
 assert.match(html,/Searched for/);assert.match(html,/under ₹2,000/);
 assert.match(html,/Pieces that match/);assert.match(html,/Black linen shirt/);
 assert.match(html,/Search it on/);assert.match(html,/https:\/\/www\.myntra\.com\/black-linen-shirt/);
 assert.match(html,/How I searched · 3 searches · 4\.2s/);
 assert.equal((html.match(/<code>black linen shirt men<\/code>/g)||[]).length,1,'a phrase sent to two routes is listed once');
 assert.match(html,/24 found · 8 off-topic, wrong colour or outside India removed · 6 compared against your piece · <b>1 shown<\/b>/);
});

test('the in-app model dropdown offers Max and Lite and the choice travels with the request',async()=>{
 const h=harness({interpret:{attributes:shirt,query:'black linen shirt',budget:null,uncertainty:'',question:'',credits:{remaining:112,cost:8},turn:'t'},search:found});
 let html=h.context.window.DiscoverConversation.render();
 assert.match(html,/Max · 15 credits/);assert.doesNotMatch(html,/<select/,'no native select sheet on phones');
 h.click('model-menu');await h.settle();html=h.latest();
 assert.match(html,/role="listbox"/);assert.match(html,/<b>Max<\/b><small>Most accurate/);assert.match(html,/<b>Lite<\/b><small>More searches/);
 h.click('pick-model',{id:'gpt-5-nano'});await h.settle();
 assert.match(h.latest(),/Lite · 8 credits/);assert.doesNotMatch(h.latest(),/role="listbox"/);
 await h.ask('black linen shirt');
 assert.equal(h.calls[0].body.model,'gpt-5-nano');assert.equal(h.calls[1].body.model,'gpt-5-nano');
 assert.match(h.latest(),/Lite · 8 credits · 112 left/);
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
