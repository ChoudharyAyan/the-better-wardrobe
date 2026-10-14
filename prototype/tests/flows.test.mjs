import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const intake=readFileSync(new URL('../dist/wardrobe-intake.js',import.meta.url),'utf8')+readFileSync(new URL('../dist/wardrobe-insights.js',import.meta.url),'utf8');
// Code-level flow checks. These do not launch or automate a browser.
function app(discovery,{sample=true}={}){
  const nodes=new Map(),listeners={};
  function node(key){if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',open:false,disabled:false,classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true},close(){this.open=false},addEventListener(){},focus(){},click(){},setSelectionRange(){}});return nodes.get(key);}
  const storage=new Map();
  const context=vm.createContext({console,crypto:webcrypto,Date,Intl,URL,Set,Map,Promise,setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''},history:{replaceState(){}},window:{Discovery:discovery,scrollY:0,scrollTo(){},addEventListener:(k,fn)=>listeners['window:'+k]=fn},document:{querySelector:node,activeElement:null,addEventListener:(k,fn)=>listeners[k]=fn},FormData:class{constructor(f){this.data=f.data}get(k){return this.data[k]??''}getAll(k){return Array.isArray(this.data[k])?this.data[k]:[this.data[k]].filter(Boolean)}}});
  vm.runInContext(intake,context);
  vm.runInContext(source,context);
  // New people start empty; these walkthrough checks run on the five-piece sample wardrobe.
  if(sample)vm.runInContext('state=seed()',context);
  return {run:c=>vm.runInContext(c,context),nodes,listeners,context,submit:(id,data,extra={})=>listeners.submit({preventDefault(){},target:{id,data,dataset:extra}}),action:(name,data={})=>vm.runInContext(`actions[${JSON.stringify(name)}]({dataset:${JSON.stringify(data)}})`,context),visit:r=>vm.runInContext(`route=${JSON.stringify(r)};render()`,context)};
}
test('all seven screens render with existing local media',()=>{
  const a=app();a.run('startDemoImport()');
  for(const route of ['discover','discover/select','discover/results','wardrobe','wardrobe/import','style','insights']){
    a.visit(route);const html=a.nodes.get('main').innerHTML;assert.ok(html.length>(route==='insights'?80:500),route);assert.ok(!html.includes('undefined'),route);
    for(const m of html.matchAll(/src="(assets\/[^\"]+)"/g))assert.ok(existsSync(path.resolve('dist',m[1])),m[1]);
  }
});
test('saving inspiration is distinct from confirming ownership',()=>{
  const a=app();a.action('save',{id:'cream'});assert.equal(a.run('state.saved.includes("cream")'),true);assert.equal(a.run('state.items.length'),5);
  a.action('add-owned',{id:'cream'});assert.equal(a.run('state.items.length'),6);a.action('add-owned',{id:'cream'});assert.equal(a.run('state.items.length'),6);
});
test('review import preserves edits and avoids duplicate identifiers',()=>{
  const a=app();a.run('startDemoImport();importDraft[0].name="My cream shirt"');a.action('save-import');assert.equal(a.run('state.items.find(p=>p.id==="cream").name'),'My cream shirt');
  a.run('startDemoImport();importDraft[1].selected=true');a.action('save-import');
  a.run('startDemoImport();importDraft[1].selected=true');a.action('save-import');
  assert.equal(a.run('state.items.length'),a.run('new Set(state.items.map(p=>p.id)).size'));
});
test('style swaps, keep, undo and saved looks retain correct states',()=>{
  const a=app();a.action('keep',{id:'cream'});assert.equal(a.run('kept.includes("cream")'),true);
  a.action('swap',{id:'cream'});assert.match(a.nodes.get('#dialog-content').innerHTML,/Unkeep/);
  a.action('keep',{id:'cream'});a.action('swap-to',{old:'cream',id:'tee'});assert.equal(a.run('styleIds.includes("tee")'),true);
  a.action('undo');assert.equal(a.run('styleIds.includes("cream")'),true);
  a.action('owned-only');assert.equal(a.run('styleIds.every(id=>state.items.some(p=>p.id===id))'),true);
  a.action('save-look');a.action('save-look');assert.equal(a.run('state.looks.length'),1);
});
test('wear logs, edited price and condition reviews feed Insights',()=>{
  const a=app();assert.equal(a.run('itemStats("black").logs.length'),20);assert.equal(a.run('itemStats("black").variety'),6);
  a.submit('wear-form',{date:'2026-09-14',occasion:'Work'},{ids:'black,tee'});assert.equal(a.run('itemStats("black").logs.length'),21);
  a.submit('edit-form',{name:'Favourite chinos',category:'Trousers',price:'4200',purchased:'2026-02-14'},{id:'black'});assert.equal(a.run('itemStats("black").cpw'),200);
  a.submit('review-form',{text:'Repair done; button feels secure.',rating:'4'},{id:'black'});assert.equal(a.run('item("black").reviews.length'),2);
  a.visit('insights');assert.match(a.run('insights()'),/Repair done/);
  a.submit('metrics-form',{metric:['cpw','reviews']});assert.equal(a.run('state.mode'),'Custom');assert.equal(a.run('state.metrics.length'),2);
});
test('empty wardrobe, escaped text, unknown routes, reset and storage failures are safe',()=>{
  const a=app();a.run('state.items[0].name="<img src=x onerror=alert(1)>"');a.visit('wardrobe');assert.ok(!a.nodes.get('main').innerHTML.includes('<img src=x'));
  a.run('state.items=[]');a.visit('insights');assert.match(a.nodes.get('main').innerHTML,/Coming soon/);
  a.visit('not-a-route');assert.equal(a.run('route'),'discover');a.action('reset');assert.equal(a.run('state.items.length'),5);
  a.run('localStorage.setItem=()=>{throw Error("quota")};persist()');assert.equal(a.run('storageWarning'),true);assert.match(a.run('notice()'),/Storage full/);
});

test('live Discover saves real inspiration separately from owned wardrobe',()=>{
 let save;const a=app({onSave:fn=>save=fn,selection:()=>'<p>Live crop selection</p>',results:()=>'<p>Live results</p>'});
 a.run('ref={image:"data:image/png;base64,example",sample:false}');a.visit('discover/select');assert.match(a.nodes.get('main').innerHTML,/Live crop/);
 save({id:'real123',title:'Blue linen shirt',category:'Shirt',image:'https://images.example.com/shirt.jpg',priceText:'₹1,499',merchant:'Retailer',url:'https://retailer.example.com/shirt',availability:'Check size',match:'Similar direction'});
 assert.equal(a.run('state.items.length'),5);assert.equal(a.run('state.saved.includes("live-real123")'),true);assert.equal(a.run('product("live-real123").name'),'Blue linen shirt');
 a.action('item',{id:'live-real123'});assert.match(a.nodes.get('#dialog-content').innerHTML,/retailer.example.com/);assert.ok(!a.nodes.get('#dialog-content').innerHTML.includes('sample price'));
});
test('long imports can be filtered by category and bulk-selected per filter',()=>{
  const a=app();
  a.run(`importDraft=Array.from({length:9},(_,i)=>({id:'o'+i,draftId:'d'+i,name:'Piece '+i,category:i<5?'Shirts':'Footwear',image:'assets/tee.jpg',selected:true,source:'Myntra orders'}));route='wardrobe/import';render()`);
  let html=a.nodes.get('main').innerHTML;assert.match(html,/All 9/);assert.match(html,/Shirts 5/);assert.match(html,/Footwear 4/);
  a.action('draft-filter',{value:'Footwear'});html=a.nodes.get('main').innerHTML;
  assert.equal((html.match(/class="import-card /g)||[]).length,4,'only footwear cards are shown');
  a.action('draft-select',{value:'none'});
  assert.equal(a.run('importDraft.filter(p=>p.selected).length'),5,'select none only touches the visible footwear');
  a.action('draft-filter',{value:'<script>'});assert.equal(a.run('importFilter'),'All','unknown filters fall back to All');
  a.action('draft-select',{value:'all'});assert.equal(a.run('importDraft.filter(p=>p.selected).length'),9);
});
test('Google Photos stays out of the import hub until the server has a client ID',()=>{
  const a=app();a.visit('wardrobe/add');assert.doesNotMatch(a.nodes.get('main').innerHTML,/import-google/);
  a.run('googlePhotosReady=true;render()');assert.match(a.nodes.get('main').innerHTML,/import-google/);
});
test('navigation follows the funnel: Discover, My Wardrobe, Style Me, then Profile, opening on Discover',()=>{
  const a=app();
  assert.equal(a.run('JSON.stringify(tabs.map(t=>t[1]))'),JSON.stringify(['Discover','My Wardrobe','Style Me','My Profile']));
  assert.equal(a.run('route'),'discover','a fresh visit with no hash lands on Discover');
});

test('My Wardrobe is open to everyone and a new person starts with an empty almirah',()=>{
  const a=app(undefined,{sample:false});
  assert.equal(a.run('state.items.length'),0);
  a.visit('wardrobe');const html=a.nodes.get('main').innerHTML;
  assert.doesNotMatch(html,/Coming soon/);assert.match(html,/Import your wardrobe/);assert.match(html,/data-action="basics"/);assert.match(html,/data-action="link-paste"/);
  assert.doesNotMatch(a.nodes.get('#desktop-nav').innerHTML,/My Wardrobe<em class="soon-tag"/);
  assert.match(html,/data-id="myntra"[^>]*>Myntra<\/button>[\s\S]*data-id="flipkart"/,'Myntra leads the store row');
  a.visit('style');assert.match(a.nodes.get('main').innerHTML,/Coming soon/,'Style Me stays behind its card');
});
test('earlier visitors lose only the untouched sample pieces',()=>{
  const a=app();
  const s=a.run('JSON.stringify(migrate({items:[{id:"black",source:"Sample wardrobe"},{id:"mine",source:"Your photo"}],wears:[{id:"seed-1",items:["black"]},{id:"w1",items:["mine"]}]}))');
  const m=JSON.parse(s);assert.deepEqual(m.items.map(p=>p.id),['mine']);assert.deepEqual(m.wears.map(w=>w.id),['w1']);assert.equal(m.v,2);assert.deepEqual(m.shops,[]);
});
test('the review queue hides innerwear and likely gifts until asked, and saves clean pieces',()=>{
  const a=app(undefined,{sample:false});
  a.run(`window.TBWAccount={profile:{gender:'male'}};addDraft([{id:'order-myntra-1',name:'Roadster kurta',category:'Ethnic wear',selected:true,gender:'Men',image:'https://assets.myntassets.com/1.jpg'},{id:'order-myntra-2',name:'Floral dress',category:'Dresses',selected:true,gender:'Women'},{id:'order-myntra-3',name:'Briefs',category:'Accessories',selected:true,innerwear:true}],'Myntra','Myntra orders')`);
  assert.equal(a.run('importDraft.filter(p=>p.selected).length'),1);
  a.visit('wardrobe/import');let html=a.nodes.get('main').innerHTML;
  assert.equal((html.match(/class="import-card /g)||[]).length,1);assert.match(html,/Show 2 hidden · looks like a gift, innerwear/);
  assert.match(a.nodes.get('#desktop-nav').innerHTML,/tab-badge[^>]*>1</,'the tab shows what is waiting');
  a.action('toggle-hidden');html=a.nodes.get('main').innerHTML;assert.equal((html.match(/class="import-card /g)||[]).length,3);assert.match(html,/Hidden: looks like a gift/);
  a.action('save-import');
  const saved=JSON.parse(a.run('JSON.stringify(state.items)'));
  assert.deepEqual(saved.map(p=>p.id),['order-myntra-1']);
  for(const k of ['draftId','selected','hidden','warning','cutting','needsCutout'])assert.equal(k in saved[0],false,k);
  assert.match(saved[0].addedAt,/^\d{4}-/);assert.equal(a.run('importDraft.length'),0);
});
test('basics are drawn, added in one tap, and hang on the rail with Ethnic wear',()=>{
  const a=app(undefined,{sample:false});
  a.run(`addBasics(window.WardrobeIntake.BASICS.filter(b=>['basic-white-kurta','basic-white-sneakers'].includes(b.id)))`);
  assert.equal(a.run('state.items.length'),2);assert.equal(a.run('state.items[0].art.shape'),'kurta');
  a.visit('wardrobe/open');const html=a.nodes.get('main').innerHTML;
  assert.match(html,/On the rail[\s\S]*White kurta[\s\S]*Folded shelf[\s\S]*White sneakers/);assert.match(html,/Ethnic wear 1/);
});
test('the open almirah can be searched by name, brand or colour',()=>{
  const a=app();
  a.run(`state.items[0].brand='Roadster';query='roadster';route='wardrobe/open';render()`);
  let html=a.nodes.get('main').innerHTML;assert.equal((html.match(/data-action="wardrobe-look"/g)||[]).length,1);
  a.run(`query='nothing like this';render()`);html=a.nodes.get('main').innerHTML;assert.match(html,/Nothing matches/);
  a.action('clear-search');assert.equal(a.run('query'),'');
});
test('levels, XP and streaks come from what was recorded',()=>{
  const a=app(undefined,{sample:false});
  a.run(`addBasics(window.WardrobeIntake.BASICS.slice(0,6));const t=new Date().toISOString().slice(0,10);state.wears.push({id:'w',date:t,items:[state.items[0].id]});route='wardrobe';render()`);
  const html=a.nodes.get('main').innerHTML;
  assert.match(html,/Level 1 · Collector/);assert.match(html,/1-day streak/);assert.match(html,/75 XP/);assert.match(html,/6 pieces/);
});
test('the item page shows wears, cost per wear and completes a look from the wardrobe',()=>{
  const a=app();
  a.action('item',{id:'black'});assert.equal(a.run('location.hash'),'wardrobe/item/black','owned pieces open their own page');
  a.visit('wardrobe/item/black');let html=a.nodes.get('main').innerHTML;
  assert.match(html,/Complete this look/);assert.match(html,/20<\/strong><span>wears/);assert.match(html,/Mark as worn today/);assert.match(html,/id="item-form"/);
  a.action('worn-today',{id:'black'});assert.equal(a.run('itemStats("black").logs.length'),21);
  a.visit('wardrobe/item/black');assert.match(a.nodes.get('main').innerHTML,/Worn today ✓/);
  a.action('worn-today',{id:'black'});assert.equal(a.run('itemStats("black").logs.length'),21,'the same wear is not logged twice in a day');
  a.submit('item-form',{name:'Black chinos',category:'Trousers',brand:'Uniqlo',colour:'black',size:'32',price:'2500',purchased:'2026-02-14',status:'laundry'},{id:'black'});
  assert.equal(a.run('item("black").brand'),'Uniqlo');assert.equal(a.run('item("black").status'),'laundry');assert.equal(a.run('item("black").price'),2500);
  a.action('archive-item',{id:'tee'});a.visit('wardrobe/open');html=a.nodes.get('main').innerHTML;assert.match(html,/Archived 1/);assert.doesNotMatch(html,/aria-label="Open White tee"/);
  a.action('duplicate-item',{id:'shoes'});assert.equal(a.run('state.items.filter(p=>p.id.startsWith("shoes-copy-")).length'),1);
  a.visit('wardrobe/item/missing');assert.match(a.nodes.get('main').innerHTML,/not in your wardrobe/);
});
test('the snapshot is never empty, keeps gaps for 20 pieces, and recaps the season',()=>{
  const a=app();
  a.visit('wardrobe/snapshot');let html=a.nodes.get('main').innerHTML;
  assert.match(html,/Your colours/);assert.match(html,/What it is made of/);assert.match(html,/Add 15 more pieces/);assert.match(html,/recap/);
  a.run(`addBasics(window.WardrobeIntake.BASICS.slice(0,16));render()`);html=a.nodes.get('main').innerHTML;
  assert.match(html,/Nothing for a wedding|No formal shoes/);assert.match(html,/data-action="discover-search"/);
});
test('the same piece from an email and a store import is listed once',()=>{
  const a=app(undefined,{sample:false});
  a.run(`addDraft([{id:'order-myntra-9',name:'Roadster Men Navy Checked Casual Shirt',retailer:'myntra',orderedAt:'2026-10-01',category:'Shirts',selected:true}],'Myntra','Myntra orders')`);
  a.run(`addDraft([{id:'email-abc',name:'Roadster Men Navy Checked Casual Shirt',retailer:'Myntra',orderedAt:'2026-10-02',category:'Shirts',selected:true}],'Email','Email receipts')`);
  assert.equal(a.run('importDraft.length'),1);
  a.action('save-import');
  a.run(`addDraft([{id:'shot-1',name:'Roadster Navy Checked Casual Shirt',retailer:'myntra',orderedAt:'2026-10-03',category:'Shirts',selected:true}],'screenshots','Order screenshot')`);
  assert.equal(a.run('importDraft[0].duplicate'),'order-myntra-9');assert.equal(a.run('importDraft[0].selected'),false);
});
test('store imports remember when they ran and suggest the next store',()=>{
  const a=app(undefined,{sample:false});
  a.run(`noteSync('myntra',42);route='wardrobe/add';render()`);
  const html=a.nodes.get('main').innerHTML;assert.match(html,/42 pieces found · today/);assert.match(html,/Import again/);
  assert.equal(a.run('nextStore()'),'Amazon','on the web the next importable store is Amazon\'s order file');
});
