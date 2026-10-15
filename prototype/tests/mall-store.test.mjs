import test from 'node:test';
import assert from 'node:assert/strict';
import {createMallStore,todayInMall} from '../lib/mall-store.mjs';

test('Today in the Mall: newest arrivals and biggest offers, one per store, only with photos',()=>{
 const item=(n,extra={})=>({url:'https://s.example/'+n,image:'https://s.example/'+n+'.jpg',title:'Piece '+n,...extra});
 const feed={generatedAt:'2026-10-15T00:00:00Z',brands:{
  1:{status:'ok',designs:[item('a',{isNew:true,firstSeenAt:'2026-10-14'}),item('b',{isNew:true,firstSeenAt:'2026-10-15'})],offers:[item('o1',{discountPercent:30})]},
  2:{status:'ok',designs:[item('c',{firstSeenAt:'2026-10-15'})],offers:[item('o2',{discountPercent:70}),item('o3',{discountPercent:10})]},
  3:{status:'empty',designs:[item('d',{isNew:true})],offers:[]},
  4:{status:'ok',designs:[{url:'https://s.example/e',title:'No photo'}],offers:[]}}};
 const today=todayInMall(feed,[{id:1,name:'Libas',url:'https://libas.in'},{id:2,name:'CAVA',url:'https://cava.in'}]);
 assert.deepEqual(today.offers.map(i=>[i.store,i.discountPercent]),[['CAVA',70],['Libas',30]],'biggest first, one per store');
 assert.deepEqual(today.arrivals.map(i=>i.title),['Piece b','Piece c'],'new first, newest first, one per store, empty stores and photo-less items skipped');
 assert.equal(today.generatedAt,'2026-10-15T00:00:00Z');
});

test('the Mall feed store saves and reads back the latest crawl',async()=>{
 const s=createMallStore({env:{}});assert.equal(await s.latest(),null);
 await s.save({generatedAt:'2026-10-15T00:00:00Z',brands:{}});assert.equal((await s.latest()).generatedAt,'2026-10-15T00:00:00Z');
});

test('the Mall board pages endlessly by kind and audience, mixing stores',async()=>{
 const {mallBoard,audienceOf}=await import('../lib/mall-store.mjs');
 assert.equal(audienceOf({title:'Rose silk saree'},{}),'womenswear');assert.equal(audienceOf({title:"Men's linen shirt"},{}),'menswear');
 assert.equal(audienceOf({title:'Oversized tee'},{category:'Menswear and smart casual'}),'menswear');assert.equal(audienceOf({title:'Oversized tee'},{category:'Streetwear and denim'}),'unisex');
 const mk=(n,title)=>({url:'https://s.example/'+n,image:'https://s.example/'+n+'.jpg',title});
 const feed={brands:{1:{status:'ok',designs:Array.from({length:30},(_,i)=>mk('a'+i,'Oversized tee '+i)),offers:[{...mk('o','Saree'),discountPercent:40}]},2:{status:'ok',designs:Array.from({length:30},(_,i)=>mk('b'+i,"Men's shirt "+i)),offers:[]}}};
 const p0=mallBoard(feed,[],{page:0});assert.equal(p0.total,61);assert.equal(p0.items.length,24);assert.equal(p0.next,1);
 assert.notEqual(p0.items[0].brandId,p0.items[1].brandId,'stores alternate');
 assert.equal(mallBoard(feed,[],{page:2}).next,null);
 assert.equal(mallBoard(feed,[],{audience:'womenswear'}).total,31,"men's pieces drop out for Women; unisex stays");
 assert.deepEqual(mallBoard(feed,[],{kind:'offers'}).items.map(i=>i.discountPercent),[40]);
});
