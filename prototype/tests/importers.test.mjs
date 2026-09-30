import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {resolveObjectURL} from 'node:buffer';
import {createDiscovery} from '../lib/discovery.mjs';
import {createPhotos} from '../lib/photos.mjs';
import {classify} from '../dist/order-import.js';
globalThis.__orderImport={classify};

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXmQAAAAASUVORK5CYII=';
const gemini=data=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]})});

test('order screenshot extraction keeps visible facts, crops thumbnails and never trusts bad values',async()=>{
 let prompt='';
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async(url,opts)=>{prompt=JSON.parse(opts.body).contents[0].parts[0].text;return gemini({retailer:'Slikk',items:[
  {name:'Black Leather Belt',type:'belt',brand:'',size:'',colour:'Black',price:599,status:'delivered',date:'2026-08-05',box:[800,100,950,250]},
  {name:'Relaxed Linen Shirt',brand:'Snitch',size:'M',colour:'',price:-5,status:'shipped?',date:'05 Aug',box:[1,1]},
  {name:'',brand:'',size:'',colour:'',price:null,status:'delivered',date:'',box:[0,0,500,500]}
 ]});}});
 const out=await d.orders({image});
 assert.match(prompt,/untrusted data/);assert.match(prompt,/never guess a brand/);assert.match(prompt,/do not guess from the layout/);
 assert.equal(out.items[0].type,'belt');
 assert.equal(out.retailer,'Slikk');assert.equal(out.items.length,2,'nameless rows are dropped');
 assert.deepEqual(out.items[0].crop,{left:80,top:10,width:15,height:15});
 assert.equal(out.items[0].price,599);assert.equal(out.items[0].date,'2026-08-05');
 const shirt=out.items[1];
 assert.equal(shirt.crop,null,'degenerate box gives no crop');assert.equal(shirt.price,null);assert.equal(shirt.status,'unknown');assert.equal(shirt.date,'');
});

test('order screenshots are served on the discover route like detect',async()=>{
 const {createServer}=await import('../server.mjs');
 const server=createServer({orders:async body=>({retailer:'',items:[],echo:!!body.image})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/discover/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});assert.equal(r.status,200);assert.equal((await r.json()).echo,true);}
 finally{await new Promise(r=>server.close(r));}
});

test('Google Photos wardrobe picks may ask for up to twenty smaller images; style references stay at six',async()=>{
 const sessions=[],images=[];
 const service=createPhotos({env:{GOOGLE_PHOTOS_CLIENT_ID:'id'},fetchImpl:async(url,options)=>{
  if(url.endsWith('/sessions')){sessions.push(JSON.parse(options.body).pickingConfig.maxItemCount);return Response.json({id:'s1',pickerUri:'https://photos.google.com/picker/s1'});}
  if(url.includes('/sessions/'))return Response.json({mediaItemsSet:true});
  if(url.includes('/mediaItems'))return Response.json({mediaItems:Array.from({length:30},(_,i)=>({type:'PHOTO',mediaFile:{baseUrl:'https://lh3.googleusercontent.com/p'+i}}))});
  images.push(url);return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
 }});
 await service.run('create',{},'t');await service.run('create',{max:20},'t');await service.run('create',{max:500},'t');
 assert.deepEqual(sessions,['6','20','20']);
 assert.equal((await service.run('collect',{sessionId:'s1'},'t')).images.length,6);
 assert.equal((await service.run('collect',{sessionId:'s1',max:20},'t')).images.length,20);
 assert.ok(images.slice(0,6).every(u=>u.endsWith('=w1200-h1200')));assert.ok(images.slice(6).every(u=>u.endsWith('=w640-h640')));
});

// Minimal ZIP writer (local headers + central directory) for the in-browser reader.
function zip(entries){
 const locals=[],central=[];let offset=0;
 for(const {name,data,store} of entries){
  const raw=Buffer.from(data),body=store?raw:deflateRawSync(raw),n=Buffer.from(name),method=store?0:8;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(method,8);local.writeUInt32LE(body.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(n.length,26);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(method,10);cd.writeUInt32LE(body.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(n.length,28);cd.writeUInt32LE(offset,42);
  locals.push(local,n,body);central.push(cd,n);offset+=30+n.length+body.length;
 }
 const cdBuf=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cdBuf.length,12);end.writeUInt32LE(offset,16);
 return new Blob([...locals,cdBuf,end]);
}
async function orderImport(){return import('../dist/order-import.js');}
function loadImporters(){const window={};vm.runInNewContext(readFileSync(new URL('../dist/importers.js',import.meta.url),'utf8'),{window,Blob,Response,URL,TextDecoder,DecompressionStream,crypto,fetch,document:{}});window.OrderImport=globalThis.__orderImport;return window.Importers;}

test('Instagram export reader finds post photos newest first and inflates them in place',async()=>{
 const {instagramPhotos}=loadImporters();
 const file=zip([
  {name:'your_instagram_activity/content/posts_1.json',data:'[]'},
  {name:'media/posts/202401/old.jpg',data:'OLD-PHOTO'.repeat(20)},
  {name:'media/posts/202508/new.jpg',data:'NEW-PHOTO'.repeat(20),store:true},
  {name:'media/profile/202001/me.jpg',data:'PROFILE'},
  {name:'media/posts/202508/clip.mp4',data:'VIDEO'}
 ]);
 const photos=await instagramPhotos(file);
 assert.deepEqual([...photos].map(p=>p.name),['media/posts/202508/new.jpg','media/posts/202401/old.jpg']);
 for(const [p,expected] of [[photos[0],'NEW-PHOTO'],[photos[1],'OLD-PHOTO']]){const blob=resolveObjectURL(await p.load());assert.equal(blob.type,'image/jpeg');assert.equal(await blob.text(),expected.repeat(20));}
});

test('Instagram export reader explains files it cannot use',async()=>{
 const {instagramPhotos}=loadImporters();
 await assert.rejects(instagramPhotos(new Blob(['not a zip at all'])),/not a ZIP/);
 await assert.rejects(instagramPhotos(zip([{name:'messages/inbox/a.json',data:'{}'}])),/No photos found/);
});

test('overlapping screenshots merge repeated orders but keep two identical pieces from one order',()=>{
 const {mergeScreenshots,classifyOk=true}=loadImporters();
 const it=(name,extra={})=>({name,type:'',brand:'Peter England',size:'',colour:'',price:null,status:'delivered',date:'2026-04-03',crop:{left:1,top:1,width:10,height:10},...extra});
 // Screenshot 1 cuts off the price; screenshot 2 overlaps and shows it.
 const pages=[
  {image:'a',retailer:'',items:[it('Party Wear Formal Satin Shirt',{brand:'Dennison',type:'shirt',date:'2026-08-05'}),it('Peter England Casualss Men Ski...',{type:'trousers'}),it('Peter England Casualss Men Ski...',{type:'trousers'})]},
  {image:'b',retailer:'',items:[it('Party Wear Formal Satin Shirt',{brand:'Dennison',type:'shirt',date:'2026-08-05',price:1499}),it('Peter England Casualss Men Ski...',{type:'trousers',price:2798}),it('New Balance 880 Running Shoes',{brand:'New Balance',status:'returned'}),it('Hair Growth Serum',{brand:'WishCare',type:''})]}
 ];
 const {entries,skipped}=mergeScreenshots(pages);
 assert.equal(entries.length,3,'one shirt, two trousers');
 const shirt=entries.find(e=>e.brand==='Dennison');assert.equal(shirt.price,1499,'price filled from the overlapping screenshot');assert.equal(shirt.category,'Shirts');
 assert.deepEqual([...entries].filter(e=>e.brand==='Peter England').map(e=>e.category),['Trousers','Trousers'],'truncated names classified from the thumbnail type');
 assert.equal(skipped,2,'the return and the serum');
});

test('a truncated, undated copy of the same order from an overlapping screenshot is merged',()=>{
 const {mergeScreenshots}=loadImporters();
 const shirt=(name,date)=>({name,type:'shirt',brand:'Peregrine by Pantaloons',size:'38',colour:'',price:null,status:'delivered',date,crop:{left:1,top:1,width:10,height:10}});
 const {entries}=mergeScreenshots([{image:'a',items:[shirt('Men Striped Casual Shirt','2026-03-24')]},{image:'b',items:[shirt('Men Strip...',''),shirt('Men Striped Linen Kurta','2026-03-24')]}]);
 assert.deepEqual([...entries].map(e=>e.name),['Men Striped Casual Shirt','Men Striped Linen Kurta']);
 assert.equal(entries[0].date,'2026-03-24');
 // Different brands or different dates never merge.
 const other=mergeScreenshots([{image:'a',items:[shirt('Men Striped Casual Shirt','2026-03-24')]},{image:'b',items:[{...shirt('Men Striped Casual Shirt','2025-01-01')}]}]);
 assert.equal(other.entries.length,2);
});

test('Instagram reader orders by post date from the export index and never lists DMs',async()=>{
 const {instagramPhotos}=loadImporters();
 const file=zip([
  {name:'your_instagram_activity/media/posts_1.json',data:JSON.stringify({media:[{uri:'media/posts/111.webp',creation_timestamp:1700000000},{uri:'media/posts/222.webp',creation_timestamp:1760000000}]})},
  {name:'your_instagram_activity/media/stories.json',data:JSON.stringify({ig_stories:[{uri:'media/stories/202512/333.jpg',creation_timestamp:1765000000}]})},
  {name:'media/posts/111.webp',data:'OLD'},{name:'media/posts/222.webp',data:'NEWER'},{name:'media/stories/202512/333.jpg',data:'NEWEST'},
  {name:'your_instagram_activity/messages/inbox/friend_123/photos/444.jpg',data:'SOMEONE ELSE'}
 ]);
 const photos=await instagramPhotos(file);
 assert.deepEqual([...photos].map(p=>p.name),['media/stories/202512/333.jpg','media/posts/222.webp','media/posts/111.webp']);
 assert.equal(resolveObjectURL(await photos[1].load()).type,'image/webp');
});

test('detect narrows a group photo to the person the user tapped, and ignores bad taps',async()=>{
 const prompts=[];
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async(url,opts)=>{prompts.push(JSON.parse(opts.body).contents[0].parts[0].text);return gemini({items:[]});}});
 await d.detect({image,focus:{x:18.4,y:52}});
 await d.detect({image,focus:{x:'<b>',y:900}});
 await d.detect({image});
 assert.match(prompts[0],/^Only include items worn or carried by the one person at about 18% from the left and 52% from the top/);
 assert.doesNotMatch(prompts[1],/Only include/);assert.doesNotMatch(prompts[2],/Only include/);
});
