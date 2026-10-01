import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
// Code-level flow checks. These do not launch or automate a browser.
function app(discovery){
  const nodes=new Map(),listeners={};
  function node(key){if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',open:false,disabled:false,classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true},close(){this.open=false},addEventListener(){},focus(){},click(){},setSelectionRange(){}});return nodes.get(key);}
  const storage=new Map();
  const context=vm.createContext({console,crypto:webcrypto,Date,Intl,URL,Set,Map,Promise,setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''},history:{replaceState(){}},window:{Discovery:discovery,scrollY:0,scrollTo(){},addEventListener:(k,fn)=>listeners['window:'+k]=fn},document:{querySelector:node,activeElement:null,addEventListener:(k,fn)=>listeners[k]=fn},FormData:class{constructor(f){this.data=f.data}get(k){return this.data[k]??''}getAll(k){return Array.isArray(this.data[k])?this.data[k]:[this.data[k]].filter(Boolean)}}});
  vm.runInContext(source,context);
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
