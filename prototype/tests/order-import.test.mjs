import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,parseCsv,normalizeAmazon,normalizeMyntra,normalizeFlipkart,CATEGORIES} from '../dist/order-import.js';

test('classifier maps Indian and Western retail types onto almirah categories',()=>{
 const cases={Shirts:['Shirts','Tshirts','Kurtas'],Suits:['Kurta Sets','Suits'],Dresses:['Sarees','WomenSari','Lehenga Choli'],Outerwear:['Sweatshirts','Blazers'],Trousers:['Jeans','Lounge Shorts','Track Pants','MensShortUnbranded'],Footwear:['Casual Shoes','Flip Flops','SpRunningShoes'],Belts:['Belts'],Jewellery:['Bracelet','Brooch'],Accessories:['Pocket Squares','Backpacks','Caps']};
 for(const [category,types] of Object.entries(cases))for(const t of types)assert.equal(classify(t),category,t);
 for(const t of ['Deodorant','Hair Serum','Free Gifts','Blankets Quilts and Dohars','Handset','OtherBooks','Suitcase','DamageProtectionPlan'])assert.equal(classify(t),null,t);
 assert.equal(classify('Trunk'),'innerwear');assert.equal(classify('Socks'),'innerwear');
 // The retailer's type field outranks words in a product title.
 assert.equal(classify('Shirts','Roadster Shirt with Mobile Pocket'),'Shirts');
 assert.equal(classify('Widget'),'unknown');
 for(const c of ['Suits','Outerwear','Jewellery'])assert.ok(CATEGORIES.includes(c));
});

test('CSV parser handles quoted commas, escaped quotes, CRLF and multi-line fields',()=>{
 const rows=parseCsv('﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\n1,2,3');
 assert.deepEqual(rows,[['a','b','c'],['x, y','say "hi"','line1\nline2'],['1','2','3']]);
});

const AMAZON_HEADER='"Website","Order ID","Order Date","Currency","Unit Price","ASIN","Quantity","Order Status","Shipping Address","Billing Address","Product Name"';
const row=(asin,name,{date='2025-11-02T10:15:00Z',status='Closed',price='1299.00',site='Amazon.in'}={})=>`"${site}","407-1","${date}","INR","${price}","${asin}","1","${status}","Flat 1, Some Road\nCity","Card ending 1234","${name}"`;

test('Amazon export keeps clothing only, drops cancelled rows and never reads address columns',()=>{
 const csv=[AMAZON_HEADER,
  row('B0SHIRT01','Allen Solly Men\'s Regular Fit Cotton Shirt'),
  row('B0SHIRT01','Allen Solly Men\'s Regular Fit Cotton Shirt',{date:'2026-01-05T09:00:00Z'}),
  row('B0KETTLE1','Pigeon Electric Kettle 1.5 Litre'),
  row('B0SNEAK01','Campus Men\'s Running Shoes',{status:'Cancelled'}),
  row('B0KURTA01','Libas Women\'s Cotton Kurta Set with Dupatta',{price:'2,149.00'})
 ].join('\n');
 const items=normalizeAmazon(csv);
 assert.deepEqual(items.map(i=>i.productId),['B0SHIRT01','B0KURTA01']);
 const [shirt,kurta]=items;
 assert.equal(shirt.orderedAt,'2026-01-05','re-orders collapse to the latest line');
 assert.equal(shirt.category,'Shirts');assert.equal(kurta.category,'Suits');
 assert.equal(kurta.price,2149);assert.equal(shirt.productUrl,'https://www.amazon.in/dp/B0SHIRT01');
 assert.equal(shirt.image,'');assert.equal(shirt.selected,true);
 const serialized=JSON.stringify(items);assert.doesNotMatch(serialized,/Some Road|Card ending/);
});

test('Amazon import rejects a file that is not an order history export',()=>{
 assert.throws(()=>normalizeAmazon('Name,Email\nA,b@example.com'),/Amazon order history/);
});

test('Myntra lines skip returns, cancellations and non-clothing, and keep studio images and size',()=>{
 const line=(id,articleType,extra={},product={})=>({createdOn:'1781524960000',statusCode:'C',returned:false,cancelled:false,...extra,product:{id,name:`Brand ${articleType}`,brand:'Roadster',articleType,masterCategory:'Apparel',gender:'Men',images:[{view:'front',src:'https://assets.myntassets.com/f.jpg'},{view:'default',src:'http://assets.myntassets.com/d.jpg'}],size:'M',...product}});
 const items=normalizeMyntra([line(1,'Shirts'),line(2,'Tshirts',{returned:true}),line(3,'Kurtas',{cancelled:true}),line(4,'Casual Shoes',{statusCode:'IC'}),line(5,'Deodorant',{},{masterCategory:'Personal Care'}),line(6,'Trunk'),line(7,'Bracelet',{},{size:'Onesize'})]);
 assert.deepEqual(items.map(i=>i.productId).sort(),['1','6','7']);
 const shirt=items.find(i=>i.productId==='1');
 assert.equal(shirt.image,'https://assets.myntassets.com/d.jpg','default view, upgraded to https');
 assert.equal(shirt.size,'M');assert.equal(shirt.productUrl,'https://www.myntra.com/1');assert.equal(shirt.id,'order-myntra-1');
 assert.equal(items.find(i=>i.productId==='6').selected,false,'innerwear is kept but unselected');
 assert.equal(items.find(i=>i.productId==='7').size,'','Onesize is not a real size');
});

test('Flipkart orders keep one copy per product and flag orders with a return',()=>{
 const p=(id,title,vertical)=>({id,title,vertical,category:'',url:'/p/itm'+id,brand:'Campus',color:'Black',size:'8',image:'http://rukminim1.flixcart.com/x.jpeg'});
 const items=normalizeFlipkart([
  {orderDate:'2025-09-06T10:00:00Z',returnHint:false,products:[p('SHOABC','Campus Running Shoes','SpRunningShoes'),p('MOBXYZ','Moto G71','Handset')]},
  {orderDate:'2023-10-20T10:00:00Z',returnHint:true,products:[p('SARXYZ','Woven Patola Saree','WomenSari')]}
 ]);
 assert.deepEqual(items.map(i=>i.category),['Footwear','Dresses']);
 assert.equal(items[0].productUrl,'https://www.flipkart.com/p/itmSHOABC');assert.equal(items[0].image,'https://rukminim1.flixcart.com/x.jpeg');
 assert.equal(items[1].selected,false);assert.match(items[1].warning,/return/i);
});
