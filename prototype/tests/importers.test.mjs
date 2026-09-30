import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {resolveObjectURL} from 'node:buffer';
import {createDiscovery} from '../lib/discovery.mjs';
import {createPhotos} from '../lib/photos.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXmQAAAAASUVORK5CYII=';
const gemini=data=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]})});

test('order screenshot extraction keeps visible facts, crops thumbnails and never trusts bad values',async()=>{
 let prompt='';
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async(url,opts)=>{prompt=JSON.parse(opts.body).contents[0].parts[0].text;return gemini({retailer:'Slikk',items:[
  {name:'Black Leather Belt',brand:'',size:'',colour:'Black',price:599,status:'delivered',date:'2026-08-05',box:[800,100,950,250]},
  {name:'Relaxed Linen Shirt',brand:'Snitch',size:'M',colour:'',price:-5,status:'shipped?',date:'05 Aug',box:[1,1]},
  {name:'',brand:'',size:'',colour:'',price:null,status:'delivered',date:'',box:[0,0,500,500]}
 ]});}});
 const out=await d.orders({image});
 assert.match(prompt,/untrusted data/);assert.match(prompt,/never guess a brand/);
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
function loadImporters(){const window={};vm.runInNewContext(readFileSync(new URL('../dist/importers.js',import.meta.url),'utf8'),{window,Blob,Response,URL,TextDecoder,DecompressionStream,crypto,fetch,document:{}});return window.Importers;}

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
