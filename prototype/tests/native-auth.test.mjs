import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
const source=readFileSync(new URL('../dist/native-auth.js',import.meta.url),'utf8');

function phone({native=true,launchUrl=null}={}){
 const listeners={},opened=[],posts=[],storage=new Map(),clicks=[];let reloads=0,closed=0;
 const location={origin:'https://app.thewardrobeos.com',hash:'',reload:()=>{reloads++;}};
 const ctx={
  crypto:webcrypto,TextEncoder,URLSearchParams,btoa,setTimeout,
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  location,
  document:{addEventListener:(type,fn)=>clicks.push(fn),getElementById:()=>null},
  fetch:async(url,opts)=>{posts.push({url,body:JSON.parse(opts.body)});return {ok:true,json:async()=>({onboarded:true})};},
  Capacitor:{isNativePlatform:()=>native,Plugins:{
   Browser:{open:async o=>{opened.push(o.url);},close:async()=>{closed++;}},
   App:{addListener:(name,fn)=>{listeners[name]=fn;},getLaunchUrl:async()=>launchUrl?{url:launchUrl}:undefined}
  }}
 };
 ctx.globalThis=ctx;vm.runInNewContext(source,ctx);
 const click=href=>{let prevented=false;const link={href};const event={target:{closest:sel=>sel.includes(`"${href}"`)?link:null},preventDefault:()=>{prevented=true;}};clicks.forEach(fn=>fn(event));return prevented;};
 return {listeners,opened,posts,storage,click,get reloads(){return reloads;},location};
}
const settle=()=>new Promise(r=>setTimeout(r,10));

test('in the app, Continue with Google opens a Custom Tab with a challenge only the app can answer',async()=>{
 const p=phone();
 assert.equal(p.click('/api/auth/google'),true,'the WebView never loads Google itself');
 await settle();
 const url=new URL(p.opened[0]);assert.equal(url.origin+url.pathname,'https://app.thewardrobeos.com/api/auth/google');
 const challenge=url.searchParams.get('app'),verifier=p.storage.get('tbw-app-verifier');
 assert.match(challenge,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(createHash('sha256').update(verifier).digest('base64url'),challenge);
 p.listeners.appUrlOpen({url:'com.thewardrobeos.app://auth?code=abc.def'});await settle();
 assert.deepEqual(p.posts[0],{url:'/api/auth/app-exchange',body:{code:'abc.def',verifier}});
 assert.equal(p.reloads,1);assert.equal(p.location.hash,'discover');assert.equal(p.storage.has('tbw-app-verifier'),false);
});

test('the launch link that survives a reload is not exchanged twice, and other links are ignored',async()=>{
 const p=phone({launchUrl:'com.thewardrobeos.app://auth?code=used'});await settle();
 assert.equal(p.posts.length,0);
 p.storage.set('tbw-app-verifier','x');p.listeners.appUrlOpen({url:'https://evil.example/auth?code=1'});await settle();
 assert.equal(p.posts.length,0);assert.equal(p.click('/somewhere-else'),false);
});

test('on the web the script does nothing',()=>{
 const p=phone({native:false});assert.equal(p.click('/api/auth/google'),false);assert.deepEqual(p.listeners,{});
});
