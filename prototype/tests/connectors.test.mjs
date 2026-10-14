import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {connectors} from '../extension/connectors.js';
import {createConnectorStore} from '../lib/connectors.mjs';
import {createServer} from '../server.mjs';
import {normalizeSlikk,normalizeGeneric,connectorNormalizers} from '../dist/order-import.js';

const connector=id=>connectors.find(c=>c.id===id);
// Runs an extract() the way chrome.scripting does: from its source text, in the page's globals.
function inject(c,globals){
 const window={...globals};
 const context=vm.createContext({...globals,window,setTimeout:(f)=>setTimeout(f,0),URLSearchParams,URL,JSON,Promise,Object,Array,String,Number,Map,Error,Event:class{constructor(t){this.type=t;}}});
 window.__tbwCaptured=globals.__tbwCaptured;
 return vm.runInContext('('+c.extract.toString()+')()',context);
}
const html=obj=>`<html><script>window.__myx = ${JSON.stringify(obj)};</script></html>`;
const PII={address:'Flat 9, Secret Road',phone:'+91 99999 00000',pan:'ABCDE1234F'};
const plain=o=>JSON.parse(JSON.stringify(o));

test('every connector is injectable as a standalone function',()=>{
 for(const c of connectors){assert.equal(typeof c.extract,'function',c.id);assert.doesNotThrow(()=>new Function('return ('+c.extract.toString()+')'),c.id);}
 assert.deepEqual(connectors.map(c=>c.id),['myntra','flipkart','slikk','ajio','tatacliq','nykaafashion','amazon','meesho']);
});

test('Myntra extractor falls back to ?p=N pages and keeps only product fields',async()=>{
 const line=(id,extra={})=>({id,createdOn:'1781524960000',status:{code:'C'},...PII,unifiedAddressId:'431988586:4',chargesPaymentsData:{card:'4111'},product:{id,name:'Shirt '+id,brand:{name:'Roadster'},articleType:'Shirts',masterCategory:'Apparel',gender:'Men',skuId:7,sizes:[{skuId:7,label:'M'}],images:[{view:'default',secureSrc:'https://assets.myntassets.com/'+id+'.jpg'}]},...extra});
 const pages={1:{totalPages:2,totalOrders:3,items:[line(1),line(2,{return:{status:{code:'RRC'},address:PII.address}})]},2:{totalPages:2,items:[line(3)]}};
 const requested=[];
 const result=plain(await inject(connector('myntra'),{location:{pathname:'/my/orders'},fetch:async url=>{requested.push(url);const n=Number(new URL(url,'https://x').searchParams.get('p'));return {text:async()=>html({omsServiceResponse:{orderResponse:pages[n]}})};}}));
 assert.deepEqual(requested.filter(u=>u.startsWith('/my/orders')),['/my/orders?p=1','/my/orders?p=2'],'the orders API failed, so the rendered pages are read');
 assert.equal(result.lines.length,3);
 assert.deepEqual(result.lines[0].product,{id:1,name:'Shirt 1',brand:'Roadster',articleType:'Shirts',masterCategory:'Apparel',gender:'Men',images:[{view:'default',src:'https://assets.myntassets.com/1.jpg'}],size:'M'});
 assert.equal(result.lines[1].returned,true);
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|99999|ABCDE|4111|431988586/);
 assert.equal(connectorNormalizers.myntra(result).length,2,'returned line is dropped in the app');
});

test('Myntra extractor reads the site orders API 50 at a time, with cookies and no token',async()=>{
 const line=id=>({id,createdOn:'1781524960000',status:{code:'C'},...PII,product:{id,name:'Shirt '+id,brand:{name:'Roadster'},articleType:'Shirts',masterCategory:'Apparel',gender:'Men',images:[]}});
 const pages={1:{totalPages:3,items:Array.from({length:50},(_,i)=>line(i+1))},2:{totalPages:3,items:Array.from({length:50},(_,i)=>line(i+51))},3:{totalPages:3,items:[line(101)]}};
 const calls=[],streamed=[];
 const result=plain(await inject(connector('myntra'),{location:{pathname:'/my/orders'},__tbwEmit:(d,p)=>streamed.push(p.page),fetch:async(url,opts={})=>{
  calls.push({url,credentials:opts.credentials,headers:opts.headers});const body=JSON.parse(opts.body);assert.equal(body.size,50);
  return {ok:true,json:async()=>pages[body.page]};}}));
 assert.equal(result.lines.length,101);
 assert.ok(calls.every(c=>c.url==='/my/ss-api/fetchOrdersApi/getOrders'&&c.credentials==='include'));
 assert.ok(calls.every(c=>!Object.keys(c.headers).some(k=>/authorization|token|cookie/i.test(k))),'never sends a token of its own');
 assert.deepEqual(streamed.sort(),[1,2,3]);
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|99999|ABCDE/);
});

test('Myntra extractor stops when a page repeats lines instead of multiplying them',async()=>{
 // The mobile site serves page 1 again for every ?p=N: 10 orders came back 12 times on a Pixel.
 const line=id=>({id,createdOn:'1781524960000',status:{code:'C'},product:{id,name:'Shirt '+id,brand:{name:'Roadster'},articleType:'Shirts',masterCategory:'Apparel',gender:'Men',images:[]}});
 const same={totalPages:12,items:[line(1),line(2)]};
 const result=plain(await inject(connector('myntra'),{location:{pathname:'/my/orders'},fetch:async url=>url.startsWith('/my/orders')?{text:async()=>html({omsServiceResponse:{orderResponse:same}})}:{ok:false}}));
 assert.deepEqual(result.lines.map(l=>l.product.id),[1,2]);
});

test('Myntra extractor reports a login page instead of partial data',async()=>{
 const result=plain(await inject(connector('myntra'),{location:{pathname:'/login'},fetch:async()=>({text:async()=>'<html>login</html>'})}));
 assert.deepEqual(result,{error:'login'});
});

test('Flipkart extractor follows the rome cursor and drops the listing-id duplicate',async()=>{
 const order=(fsn,title,vertical)=>({orderMetaData:{orderDate:'2025-09-06T10:00:00Z'},addressGroupings:PII,orderMoneyDataBag:{card:'4111'},units:{u1:{metaData:{status:{key:fsn==='SAR1'?'Returned':'Delivered'}},reverseLegDataBag:{returnTracking:fsn==='SAR1'?[{returnType:'Refund'}]:[]}}},productDataBag:{['LST'+fsn]:{productBasicData:{title}},[fsn]:{productBasicData:{title,vertical,url:'/p/'+fsn,imageLocation:{'400x400':'http://rukminim1.flixcart.com/'+fsn+'.jpg'}},productAttribute:{brand:'Campus',color:'Black',size:'8'}}}});
 const calls=[];
 const pages=[{orders:[order('SHO1','Running Shoes','SpRunningShoes')],moreOrder:true,nextCallParams:[{key:'cursor',value:'abc'}]},{orders:[order('SAR1','Patola Saree','WomenSari')],moreOrder:false}];
 const result=plain(await inject(connector('flipkart'),{navigator:{userAgent:'UA'},fetch:async(url,opts)=>{calls.push({url,ua:opts.headers['X-User-Agent']});return {status:200,json:async()=>({RESPONSE:{multipleOrderDetailsView:pages[calls.length-1]}})};}}));
 assert.equal(calls.length,2);assert.match(calls[1].url,/page=2/);assert.match(calls[1].url,/cursor=abc/);assert.equal(calls[0].ua,'UA FKUA/website/42/website/Desktop');
 assert.equal(result.orders[0].products.length,1);assert.equal(result.orders[0].products[0].id,'SHO1');
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|99999|4111/);
 assert.deepEqual(result.orders.map(o=>o.returned),[false,true]);
 assert.deepEqual(connectorNormalizers.flipkart(result).map(i=>i.category),['Footwear'],'refunded saree is dropped');
});

test('Slikk extractor reads only responses the page captured itself, never tokens',async()=>{
 const results=[
  {uuid:'a',status:'ORDER DELIVERED',create_date:'2026-08-05T20:26:00Z',return_orders:[],invoice_id:'INV-1',...PII,order_items:[{name:'Leather Reversible Belt',image:'https://cdn.slikk.club/belt.jpg',final_price:'599.00',quantity:'1'}]},
  {uuid:'b',status:'ORDER DELIVERED',create_date:'2026-04-22T15:53:00Z',return_orders:[{id:1}],order_items:[{name:'Relaxed Chinos',image:'https://cdn.slikk.club/c.jpg',final_price:'1499.00'}]}
 ];
 const result=plain(await inject(connector('slikk'),{location:{pathname:'/orders'},document:{body:{scrollHeight:1}},scrollTo(){},__tbwCaptured:[{path:'/user/order',data:{data:{count:2,next:false,results}}}]}));
 assert.equal(result.orders.length,2);assert.equal(result.orders[1].returned,true);
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|99999|INV-1/);
 const items=normalizeSlikk(result.orders);
 const belt=items.find(i=>i.name==='Leather Reversible Belt'),chinos=items.find(i=>i.name==='Relaxed Chinos');
 assert.equal(belt.category,'Belts');assert.equal(belt.price,599);assert.equal(belt.orderedAt,'2026-08-05');assert.equal(belt.selected,true);
 assert.equal(chinos.selected,false,'an order with a return is kept but unticked');assert.match(chinos.warning,/return/);
});

test('AJIO extractor walks every period and page with the session cookie only',async()=>{
 const calls=[];
 const result=plain(await inject(connector('ajio'),{fetch:async(url,opts)=>{calls.push(url);assert.equal(opts.credentials,'include');assert.ok(!opts.headers.Authorization);const two=url.endsWith('/0/10/CURRENT_YEAR-1');return {status:200,json:async()=>({totalPages:two?2:0,orders:[]})};}}));
 assert.equal(result.pages.length,8,'7 periods, one of them with a second page');
 assert.ok(calls.includes('/api/my-account/get-user-orders/1/10/CURRENT_YEAR-1'));
});

test('shape-based reader finds products in unfamiliar order JSON and skips returns',()=>{
 const pages=[{orders:[
  {orderStatus:'Delivered',orderDate:'2025-12-01T10:00:00Z',shippingAddress:PII,products:[{productName:'Men Slim Fit Oxford Shirt',brandName:'Netplay',size:'40',price:'1,299',productCode:'469581',images:[{url:'https://assets.ajio.com/medias/469581.jpg'}]}]},
  {orderStatus:'Return Completed',orderDate:'2025-10-01T10:00:00Z',products:[{productName:'Denim Jacket',imageUrl:'https://assets.ajio.com/j.jpg'}]},
  {orderStatus:'Delivered',entries:[{product:{name:'Bluetooth Speaker',image:'https://x/s.jpg'}}]}
 ]}];
 const items=normalizeGeneric('ajio',pages);
 assert.equal(items.length,1);
 const [shirt]=items;
 assert.equal(shirt.id,'order-ajio-469581');assert.equal(shirt.brand,'Netplay');assert.equal(shirt.size,'40');assert.equal(shirt.price,1299);assert.equal(shirt.orderedAt,'2025-12-01');assert.equal(shirt.category,'Shirts');
 assert.equal(shirt.image,'https://assets.ajio.com/medias/469581.jpg');assert.match(shirt.warning,/new connector/);
 assert.doesNotMatch(JSON.stringify(items),/Secret Road/);
});

async function withServer(env,fn){
 const dir=await mkdtemp(tmpdir()+'/tbw-connectors-');
 const server=createServer({status:()=>({})},undefined,undefined,createConnectorStore({env,dir:pathToFileURL(dir+'/')}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
}
const post=(base,body,headers={})=>fetch(base+'/api/connectors/import',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('connector routes stay dark unless ORDER_CONNECTORS=true, and never on Vercel',async()=>{
 for(const env of [{},{ORDER_CONNECTORS:'true',VERCEL:'1'}])await withServer(env,async base=>{
  assert.equal((await fetch(base+'/api/connectors/status')).status,404);
  assert.equal((await post(base,{store:'myntra',data:{lines:[]}})).status,404);
 });
});

test('connector routes accept the extension, refuse web pages, and serve batches same-origin',async()=>{
 await withServer({ORDER_CONNECTORS:'true'},async base=>{
  assert.equal((await post(base,{store:'myntra',data:{lines:[]}},{Origin:'https://evil.example'})).status,403);
  assert.equal((await post(base,{store:'amazon',data:{}})).status,400);
  assert.equal((await post(base,{store:'myntra',data:[1]})).status,400);
  assert.equal((await post(base,{store:'myntra',data:{lines:[{product:{id:1}}]}},{Origin:'chrome-extension://abcdef'})).status,200);
  const status=await(await fetch(base+'/api/connectors/status')).json();assert.deepEqual(status.batches.map(b=>b.store),['myntra']);
  const batch=await(await fetch(base+'/api/connectors/batch/myntra')).json();assert.equal(batch.data.lines[0].product.id,1);
  assert.equal((await fetch(base+'/api/connectors/batch/myntra',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(base+'/api/connectors/batch/slikk')).status,404);
  assert.equal((await fetch(base+'/api/connectors/batch/myntra',{method:'DELETE'})).status,200);
  assert.equal((await fetch(base+'/api/connectors/batch/myntra')).status,404);
 });
});

// A small DOMParser over cheerio, enough for the Amazon extractor's selectors.
import * as cheerio from 'cheerio';
const wrap=($,el)=>({get textContent(){return $(el).text();},getAttribute:n=>$(el).attr(n)??null,get value(){return $(el).attr('value')||'';},
 querySelector:s=>{const f=$(el).find(s).first();return f.length?wrap($,f[0]):null;},querySelectorAll:s=>$(el).find(s).toArray().map(e=>wrap($,e))});
class DOMParser{parseFromString(html){const $=cheerio.load(html);return wrap($,$.root()[0]);}}

test('Amazon extractor walks each year of order history and keeps product links only',async()=>{
 const year=new Date().getFullYear();
 const card=(date,asin,title,status='Delivered')=>`<div class="order-card"><div class="order-header">ORDER PLACED ${date} TOTAL ₹999 SHIP TO Secret Road</div><div class="delivery-box">${status}</div><a href="/dp/${asin}?ref=x"><img src="https://m.media-amazon.com/images/I/${asin}._SS142_.jpg"></a><a href="/gp/product/${asin}/ref=y">${title}</a></div>`;
 const pages={[`year-${year}|0`]:`<select name="timeFilter"><option value="last30">x</option><option value="year-${year}">${year}</option><option value="year-${year-1}">${year-1}</option></select>`+card('3 March '+year,'B0AAAAAAAA','Levi\'s Men Slim Fit Jeans')+card('1 March '+year,'B0BBBBBBBB','Boat Wireless Earbuds'),
  [`year-${year-1}|0`]:card('9 June '+(year-1),'B0CCCCCCCC','Men Cotton Kurta','Return complete. Refund issued')+card('8 June '+(year-1),'B0DDDDDDDD','Campus Running Shoes')};
 const emitted=[];
 const result=plain(await inject(connector('amazon'),{DOMParser,location:{pathname:'/gp/css/order-history'},__tbwEmit:(d,p)=>emitted.push(p),fetch:async url=>{const u=new URL(url,'https://www.amazon.in');return {url:u.href,text:async()=>pages[u.searchParams.get('timeFilter')+'|'+u.searchParams.get('startIndex')]||''};}}));
 assert.equal(result.orders.length,4);assert.equal(emitted.length,2,'one message per page read');
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|999/);
 const items=connectorNormalizers.amazon(result);
 assert.deepEqual(items.map(i=>[i.id,i.category]),[['order-amazon-B0AAAAAAAA','Trousers'],['order-amazon-B0DDDDDDDD','Footwear']],'earbuds and the returned kurta are dropped');
 assert.equal(items[0].image,'https://m.media-amazon.com/images/I/B0AAAAAAAA._AC_UL480_.jpg');assert.equal(items[0].productUrl,'https://www.amazon.in/dp/B0AAAAAAAA');
});

test('Amazon extractor reads encrypted order cards from a frame, with the date as written',async()=>{
 // Amazon now ships each card encrypted; only the page's own script can decrypt it.
 const year=new Date().getFullYear();
 const encrypted=`<div class="order-card"><div class="csd-encrypted-sensitive">x9f…</div></div>`;
 const decrypted={[`year-${year}|0`]:`<select name="timeFilter"><option value="year-${year}">${year}</option></select><div class="order-card"><div class="order-header">Order placed 14 October ${year} Total ₹999</div><a href="/dp/B0EEEEEEEE?ref=x"><img src="https://m.media-amazon.com/images/I/e._SS284_.jpg"></a><a href="/dp/B0EEEEEEEE?ref=y">Men Regular Fit Shirt</a></div>`};
 const frames=[];
 const document={body:{appendChild:f=>{frames.push(f.src);setTimeout(()=>f.onload?.(),0);}},createElement:()=>{const f={style:{},setAttribute(){},remove(){},addEventListener:(_,cb)=>{f.onload=cb;}};
  Object.defineProperty(f,'contentDocument',{get:()=>{const u=new URL(f.src,'https://www.amazon.in');return {readyState:'complete',querySelector:()=>null,documentElement:{outerHTML:decrypted[u.searchParams.get('timeFilter')+'|'+u.searchParams.get('startIndex')]||''}};}});
  f.contentWindow={location:{pathname:'/gp/css/order-history'}};return f;}};
 const result=plain(await inject(connector('amazon'),{DOMParser,document,location:{pathname:'/gp/css/order-history'},fetch:async url=>({url:new URL(url,'https://www.amazon.in').href,text:async()=>encrypted})}));
 assert.equal(frames.length,1,'the first encrypted page is read from a frame');
 const items=connectorNormalizers.amazon(result);
 assert.deepEqual(items.map(i=>[i.id,i.category,i.orderedAt]),[['order-amazon-B0EEEEEEEE','Shirts',`${year}-10-14`]]);
 assert.equal(items[0].image,'https://m.media-amazon.com/images/I/e._AC_UL480_.jpg');
});

test('Amazon extractor reports the sign-in page instead of an empty import',async()=>{
 const result=plain(await inject(connector('amazon'),{DOMParser,location:{pathname:'/ap/signin'},fetch:async()=>({url:'https://www.amazon.in/ap/signin?x',text:async()=>''})}));
 assert.equal(result.error,'login');
});
