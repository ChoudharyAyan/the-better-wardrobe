import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccounts,cleanProfile,departmentFor} from '../lib/accounts.mjs';
import {createDiscovery} from '../lib/discovery.mjs';
import {LOOKS,lookCards} from '../lib/looks.mjs';
import {createServer} from '../server.mjs';

const answers={name:' Ayan ',age:24,gender:'male',explore:['discover','custom'],custom:'Outfits for a wedding',vibe:'trend',interests:['mens-formal','sneakers','not-real']};

test('onboarding answers: step one is required, step two is optional and cleaned',()=>{
 const p=cleanProfile(answers);
 assert.equal(p.name,'Ayan');assert.deepEqual(p.interests,['mens-formal','sneakers']);assert.equal(p.custom,'Outfits for a wedding');
 assert.equal(cleanProfile({...answers,vibe:'',interests:[]}).vibe,'','skipping step two is fine');
 for(const bad of [{name:''},{age:9},{age:'abc'},{gender:'robot'},{explore:[]},{explore:['custom'],custom:''}])assert.throws(()=>cleanProfile({...answers,...bad}),e=>e.status===400,JSON.stringify(bad));
 assert.equal(departmentFor({gender:'male'}),'menswear');assert.equal(departmentFor({gender:'female'}),'womenswear');assert.equal(departmentFor({gender:'other'}),'');
});

test('Google sign-in: PKCE + state, verified account, and a tamper-proof session',async()=>{
 let tokenBody;const fetcher=async(url,opts)=>{if(url.includes('/token')){tokenBody=new URLSearchParams(opts.body);return {ok:true,json:async()=>({access_token:'at'})};}assert.equal(opts.headers.Authorization,'Bearer at');return {ok:true,json:async()=>({sub:'123',email:'a@example.com',email_verified:true,name:'Ayan C',picture:'https://lh3.example/p.jpg'})};};
 const accounts=createAccounts({env:{GOOGLE_CLIENT_ID:'cid',GOOGLE_CLIENT_SECRET:'sec',AUTH_SECRET:'s'},fetcher});
 const start=accounts.authStart('https://app.example/api/auth/google/callback');const url=new URL(start.url);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid email profile');
 const state=url.searchParams.get('state');
 await assert.rejects(accounts.authFinish({code:'c',state:'wrong',cookie:start.cookie,redirectUri:'x'}),e=>e.status===400,'state must match');
 await assert.rejects(accounts.authFinish({code:'c',state,cookie:start.cookie.replace(/.$/,'x'),redirectUri:'x'}),e=>e.status===400,'flow cookie is signed');
 const done=await accounts.authFinish({code:'c',state,cookie:start.cookie,redirectUri:'https://app.example/api/auth/google/callback'});
 assert.deepEqual(done,{id:'g:123',onboarded:false});assert.ok(tokenBody.get('code_verifier'));assert.equal(tokenBody.get('client_secret'),'sec');
 const session=accounts.session(done.id);assert.equal(accounts.readSession(session),'g:123');
 assert.equal(accounts.readSession(session.replace(/^[^.]+/,Buffer.from('g:999').toString('base64url'))),null,'changing the id breaks the signature');
 const me=await accounts.me('g:123');assert.equal(me.account.email,'a@example.com');assert.equal(me.onboarded,false);
 await accounts.saveProfile('g:123',answers);assert.equal((await accounts.me('g:123')).onboarded,true);
 await assert.rejects(accounts.preview('guest'),e=>e.status===404,'no preview profiles once Google is configured');
 const unverified=createAccounts({env:{GOOGLE_CLIENT_ID:'cid',GOOGLE_CLIENT_SECRET:'sec'},fetcher:async url=>url.includes('/token')?{ok:true,json:async()=>({access_token:'at'})}:{ok:true,json:async()=>({sub:'9',email_verified:false})}});
 const s2=unverified.authStart('x');await assert.rejects(unverified.authFinish({code:'c',state:new URL(s2.url).searchParams.get('state'),cookie:s2.cookie,redirectUri:'x'}),e=>e.status===403);
});

test('server: onboarding over HTTP, and the profile sets Discover’s default department',async()=>{
 const seen=[];const discovery={status:()=>({shopping:false,models:[],defaultModel:'gemini-3-flash'}),interpret:async body=>{seen.push(body.department);return {attributes:null,question:'?'};}};
 const server=createServer(discovery,undefined,undefined,undefined,undefined,undefined,undefined,createAccounts({env:{}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const me=await fetch(base+'/api/me');let cookie=me.headers.get('set-cookie').split(';')[0];
  const json=(path,method,body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  assert.equal((await json('/api/me/profile','PUT',answers)).status,401,'a guest has no profile to save');
  assert.equal((await fetch(base+'/api/auth/google')).status,404,'Google stays dark until configured');
  const preview=await json('/api/auth/preview','POST',{});cookie+='; '+preview.headers.get('set-cookie').split(';')[0];
  assert.equal((await json('/api/me/profile','PUT',{...answers,age:5})).status,400);
  const saved=await (await json('/api/me/profile','PUT',answers)).json();assert.equal(saved.profile.gender,'male');
  assert.equal((await (await fetch(base+'/api/me',{headers:{Cookie:cookie}})).json()).onboarded,true);
  await json('/api/discover/interpret','POST',{text:'shirt',department:'womenswear'});
  assert.deepEqual(seen,['menswear'],'the profile decides, not the request body');
  assert.equal((await fetch(base+'/api/me/profile',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie,'Sec-Fetch-Site':'cross-site'},body:JSON.stringify(answers)})).status,403);
  const out=await json('/api/auth/logout','POST',{});assert.match(out.headers.get('set-cookie'),/tbw_session=;.*Max-Age=0/);
  const looks=await (await fetch(base+'/api/discover/looks')).json();assert.equal(looks.looks.length,LOOKS.length);assert.equal(looks.looks[0].attributes,undefined,'the search spec stays on the server');
 }finally{await new Promise(r=>server.close(r));}
});

test('trending looks search from their researched spec with no model call, and never by the person’s name',async()=>{
 const d=createDiscovery({env:{OPENROUTER_API_KEY:'k',VISION_PROVIDER:'openrouter'},fetcher:async()=>assert.fail('no model call for a look')});
 for(const look of LOOKS){
  const r=await d.interpret({look:look.id,text:look.label});
  assert.equal(r.query,look.query);assert.equal(r.attributes.department,look.department);
  const name=look.who.split(' · ')[0].toLowerCase().split(' ');assert.ok(!name.some(w=>w.length>3&&r.query.toLowerCase().includes(w)),look.id+' query names the person');
 }
 assert.equal(new Set(lookCards().map(l=>l.id)).size,LOOKS.length);
});

test('typed celebrity looks are understood, and a profile department applies only when the words don’t say otherwise',async()=>{
 const reply={category:'cardigan',colour:'black',fit:'',pattern:'',details:'',subtype:'knit cardigan',features:'',department:'unknown',query:'black knit cardigan',budget:null,uncertainty:'',question:''};
 let prompt='';const d=createDiscovery({env:{OPENROUTER_API_KEY:'k',VISION_PROVIDER:'openrouter'},fetcher:async(url,opts)=>{prompt=JSON.parse(opts.body).messages[1].content[0].text;return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]})};}});
 const r=await d.interpret({text:"Hrithik Roshan's airport look",department:'menswear'});
 assert.equal(r.attributes.category,'cardigan','a named look counts as grounded');assert.equal(r.attributes.department,'menswear');
 assert.match(prompt,/Never put the person's or character's name in query/);
 assert.equal((await d.interpret({text:'black cardigan for women',department:'menswear'})).attributes.department,'','the words beat the profile');
});

test('the account id never reaches the page: a preview id embeds the HttpOnly guest cookie',async()=>{
 const accounts=createAccounts({env:{}});const id=await accounts.preview('a'.repeat(48));
 assert.equal(JSON.stringify(await accounts.me(id)).includes('a'.repeat(48)),false);
});

test('look precision: a look keeps titles with its must-have word, and shoes never answer a jacket',async()=>{
 const {titleRejection,attributes}=await import('../lib/discovery.mjs');
 const jacket=attributes({category:'Jacket',subtype:'satin bomber jacket',colour:'white'});
 assert.equal(titleRejection({title:"Nike Air Force 1 '07 Men's Shoes"},jacket),'Wrong garment type');
 assert.equal(titleRejection({title:'White satin scorpion bomber jacket'},jacket),'');
 assert.equal(titleRejection({title:'White leather sneakers'},attributes({category:'Shoes',subtype:'sneakers'})),'');
 const cardigan=LOOKS.find(l=>l.id==='virat-airport-cardigan');
 assert.ok(cardigan.must.test('Selected Homme Knit Cardigan')&&!cardigan.must.test('Monte Carlo Men Black V Neck Pullover'));
 const results=['Black knit cardigan','Black button cardigan','Cardigan men black','Black pullover','Black sweater'].map((title,i)=>({title,link:'https://www.myntra.com/p'+i,thumbnail:'https://img.example/'+i+'.jpg',source:'Myntra'}));
 const d=createDiscovery({env:{SERPAPI_API_KEY:'k'},fetcher:async()=>({ok:true,status:200,json:async()=>({shopping_results:results})}),pageFetcher:async()=>'',imageFetcher:async()=>{throw Error('offline');}});
 const r=await d.search({attributes:{...cardigan.attributes,department:'menswear'},query:cardigan.query,market:'in',look:cardigan.id});
 assert.ok(r.results.length>=3);assert.ok(r.results.every(p=>/cardigan/i.test(p.title)),'pullovers and sweaters are dropped for the cardigan look');
});

test('QA v5: typed references are grounded, Blade Runner maps to K’s coat, and photo colours are never gated',async()=>{
 const {matchLook}=await import('../lib/looks.mjs');
 // #18: "suit" is the person's word; the film's piece is the coat, and the reply says so. No model call.
 const none=createDiscovery({env:{OPENROUTER_API_KEY:'k',VISION_PROVIDER:'openrouter'},fetcher:async()=>assert.fail('curated look, no model')});
 const k=await none.interpret({text:'ryan gosling suit from blade runner'});
 assert.equal(k.look.id,'blade-runner-k-coat');assert.match(k.look.note,/shearling collar, not a suit/);assert.equal(k.query,'shearling collar leather coat men');
 assert.equal(matchLook('Don Draper suit'),null,'a different garment named for a non-iconic look goes to the model');
 assert.equal(matchLook('Don Draper sunglasses').id,'don-draper-aviators');
 // A named person or film grounds the model's answer even when the garment isn't in the words.
 const reply={reference:'Brad Pitt in Fight Club',category:'jacket',colour:'red',fit:'',pattern:'',details:'leather',subtype:'leather jacket',features:'',department:'menswear',query:'red leather jacket men',budget:null,uncertainty:'',question:''};
 const d=createDiscovery({env:{OPENROUTER_API_KEY:'k',VISION_PROVIDER:'openrouter'},fetcher:async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]})})});
 const r=await d.interpret({text:'brad pitt suit from fight club'});
 assert.equal(r.attributes.category,'jacket');assert.equal(r.reference,'Brad Pitt in Fight Club');assert.equal(r.question,'');
});
test('QA v5: the colour gate runs for typed colours only, and teal is its own colour',async()=>{
 const {colourFamily,titleColourConflict}=await import('../lib/colour.mjs');
 assert.equal(colourFamily('teal'),'teal');assert.equal(colourFamily('navy'),'blue');
 assert.equal(titleColourConflict('Teal suede jacket','teal'),false);
 const src=(await import('node:fs')).readFileSync(new URL('../lib/discovery.mjs',import.meta.url),'utf8');
 assert.match(src,/if\(known\(a\.colour\)&&!body\.image\)/,'photo-derived colours are judged by the visual comparison, not the pixel gate');
});
