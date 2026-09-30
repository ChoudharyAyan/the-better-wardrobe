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
 assert.deepEqual(connectors.map(c=>c.id),['myntra','flipkart','slikk','ajio','tatacliq','nykaafashion']);
});

test('Myntra extractor pages with ?p=N and keeps only product fields',async()=>{
 const line=(id,extra={})=>({id,createdOn:'1781524960000',status:{code:'C'},...PII,unifiedAddressId:'431988586:4',chargesPaymentsData:{card:'4111'},product:{id,name:'Shirt '+id,brand:{name:'Roadster'},articleType:'Shirts',masterCategory:'Apparel',gender:'Men',skuId:7,sizes:[{skuId:7,label:'M'}],images:[{view:'default',secureSrc:'https://assets.myntassets.com/'+id+'.jpg'}]},...extra});
 const pages={1:{totalPages:2,totalOrders:3,items:[line(1),line(2,{return:{status:{code:'RRC'},address:PII.address}})]},2:{totalPages:2,items:[line(3)]}};
 const requested=[];
 const result=plain(await inject(connector('myntra'),{location:{pathname:'/my/orders'},fetch:async url=>{requested.push(url);const n=Number(new URL(url,'https://x').searchParams.get('p'));return {text:async()=>html({omsServiceResponse:{orderResponse:pages[n]}})};}}));
 assert.deepEqual(requested,['/my/orders?p=1','/my/orders?p=2']);
 assert.equal(result.lines.length,3);
 assert.deepEqual(result.lines[0].product,{id:1,name:'Shirt 1',brand:'Roadster',articleType:'Shirts',masterCategory:'Apparel',gender:'Men',images:[{view:'default',src:'https://assets.myntassets.com/1.jpg'}],size:'M'});
 assert.equal(result.lines[1].returned,true);
 assert.doesNotMatch(JSON.stringify(result),/Secret Road|99999|ABCDE|4111|431988586/);
 assert.equal(connectorNormalizers.myntra(result).length,2,'returned line is dropped in the app');
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
