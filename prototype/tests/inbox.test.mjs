import test from 'node:test';
import assert from 'node:assert/strict';
import {createInbox,emailDigest} from '../lib/inbox.mjs';
import {createAccounts} from '../lib/accounts.mjs';
import {createWardrobe} from '../lib/wardrobe.mjs';
import {createServer} from '../server.mjs';

const env={WARDROBE_INBOUND_DOMAIN:'in.thewardrobeos.com',WARDROBE_INBOUND_SECRET:'s'.repeat(24),GEMINI_API_KEY:'g'};
const html=`<html><head><style>.x{}</style></head><body><img src="https://cdn.zara.net/logo.png" alt="ZARA logo"><p>Hi Ayan, thanks for your order at 9 Secret Road.</p>
<table><tr><td><img src="https://static.zara.net/photos/linen-shirt.jpg" alt="Linen shirt"></td><td>Linen shirt · Size M · ₹2,990</td></tr>
<tr><td><img src="https://static.zara.net/photos/candle.jpg"></td><td>Scented candle · ₹990</td></tr></table><img src="https://t.zara.net/open.gif?u=1" width=1></body></html>`;
const model=reply=>async(url,init)=>{const body=JSON.parse(init.body);assert.match(body.contents[0].parts[0].text,/untrusted data/);return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(reply(body))}]}}]})};};

test('email digest keeps the text and product pictures, not logos or tracking pixels',()=>{
 const d=emailDigest({subject:'Your Zara order',html});
 assert.deepEqual(d.images,['https://static.zara.net/photos/linen-shirt.jpg','https://static.zara.net/photos/candle.jpg']);
 assert.match(d.body,/Linen shirt · Size M/);assert.doesNotMatch(d.body,/<|\.x\{\}/);
});

test('forwarded order emails become pending clothing pieces for the right person only',async()=>{
 const inbox=createInbox({env,fetcher:model(()=>({store:'Zara',orderDate:'2026-10-10',items:[{name:'Linen shirt',size:'M',colour:'white',price:2990,image:1},{name:'Scented candle',price:990,image:2},{name:'Silk scarf',image:9}]}))});
 assert.equal(inbox.configured(),true);
 const address=await inbox.address('acct-1');assert.match(address,/^orders\+[a-f0-9]{12}@in\.thewardrobeos\.com$/);
 assert.equal(await inbox.address('acct-1'),address,'the address never changes');
 assert.notEqual(await inbox.address('acct-2'),address);
 assert.deepEqual(await inbox.receive({ToFull:[{Email:'orders+000000000000@in.thewardrobeos.com'}],HtmlBody:html}),{accepted:0,reason:'unknown address'});
 assert.deepEqual(await inbox.receive({ToFull:[{Email:address.toUpperCase()}],Subject:'Your Zara order',HtmlBody:html}),{accepted:2});
 const items=await inbox.pending('acct-1');
 assert.deepEqual(items.map(i=>[i.name,i.category,i.image]),[['Linen shirt','Shirts','https://static.zara.net/photos/linen-shirt.jpg'],['Silk scarf','Accessories','']],'the candle never reaches the queue; a made-up picture number is dropped');
 assert.equal(items[0].retailer,'Zara');assert.equal(items[0].orderedAt,'2026-10-10');assert.equal(items[0].price,2990);
 assert.doesNotMatch(JSON.stringify(items),/Secret Road|Ayan/);
 assert.equal((await inbox.pending('acct-2')).length,0);
 assert.equal(await inbox.ack('acct-1',[items[0].id,'../x']),1);assert.equal((await inbox.pending('acct-1')).length,1);
});

test('the webhook needs the shared secret, and stays off until configured',async()=>{
 const inbox=createInbox({env,fetcher:model(()=>({items:[]}))});
 const basic='Basic '+Buffer.from('postmark:'+env.WARDROBE_INBOUND_SECRET).toString('base64');
 assert.equal(inbox.authorized(basic),true);assert.equal(inbox.authorized('Basic '+Buffer.from('postmark:wrong').toString('base64')),false);
 assert.equal(inbox.authorized('',env.WARDROBE_INBOUND_SECRET),true);assert.equal(inbox.authorized(''),false);
 const off=createInbox({env:{}});assert.equal(off.configured(),false);assert.equal(await off.address('a'),null);assert.equal(off.authorized('',''),false);
 assert.equal(createInbox({env:{...env,WARDROBE_INBOUND_SECRET:'short'}}).configured(),false,'a short secret is not accepted');
});

test('inbox routes: webhook from the mail service, pending pieces for the signed-in person',async()=>{
 const inbox=createInbox({env,fetcher:model(()=>({store:'H&M',items:[{name:'Relaxed fit jeans',image:0}]}))});
 const server=createServer({status:()=>({})},undefined,undefined,undefined,undefined,undefined,undefined,createAccounts({env:{}}),createWardrobe({env:{}}),undefined,undefined,inbox);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  let cookie=(await fetch(base+'/api/me')).headers.get('set-cookie').split(';')[0];
  const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body&&JSON.stringify(body)});
  assert.equal((await call('/api/wardrobe/inbox')).status,401);
  cookie+='; '+(await call('/api/auth/preview','POST',{})).headers.get('set-cookie').split(';')[0];
  const {address,items}=await (await call('/api/wardrobe/inbox')).json();assert.match(address,/^orders\+/);assert.equal(items.length,0);
  const mail={ToFull:[{Email:address}],Subject:'Order',HtmlBody:'<p>Relaxed fit jeans</p>'};
  assert.equal((await fetch(base+'/api/wardrobe/inbound',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mail)})).status,401);
  const ok=await fetch(base+'/api/wardrobe/inbound',{method:'POST',headers:{'Content-Type':'application/json','X-Inbound-Secret':env.WARDROBE_INBOUND_SECRET,Origin:'https://api.postmarkapp.com'},body:JSON.stringify(mail)});
  assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{accepted:1});
  const pending=(await (await call('/api/wardrobe/inbox')).json()).items;assert.equal(pending[0].category,'Trousers');
  await call('/api/wardrobe/inbox/ack','POST',{ids:[pending[0].id]});
  assert.equal((await (await call('/api/wardrobe/inbox')).json()).items.length,0);
  assert.equal((await (await call('/api/wardrobe/status')).json()).email,true);
 }finally{await new Promise(r=>server.close(r));}
});
