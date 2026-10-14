// Store imports inside The Wardrobe OS phone app (PRD FR#3, FR#5). The app opens the store's own
// order page in an in-app browser; the person signs in there as usual (we never see the
// password), taps "Import my orders", and the same extract() the browser extension uses runs in
// that page. Only product fields come back (connectors.js strips addresses, phones and payments).
// Myntra streams each page of orders as it lands, so the review queue fills while the rest load.
import {connectors} from './store-connectors.js';

// Priority agreed with the owner (14 Oct 2026): Myntra first, then Flipkart, Amazon, AJIO, Nykaa Fashion, Meesho.
export const NATIVE_ORDER=['myntra','flipkart','amazon','ajio','nykaafashion','meesho','slikk','tatacliq'];
const plugin=()=>globalThis.Capacitor?.isNativePlatform?.()?globalThis.Capacitor?.Plugins?.InAppBrowser||null:null;
export const available=id=>Boolean(plugin())&&connectors.some(c=>c.id===id);

// Stores that refuse in-app browsers. Flipkart answers a page that reports "Android WebView" with
// "Something went wrong" (seen on a Pixel 10a), so for these the browser can open identifying as
// mobile Chrome: the "; wv" marker leaves the user agent, and the app's patched plugin reports
// Chrome's brand in the client hints whenever a User-Agent is passed. Only after the person agrees
// in the app (app.js chromeOk); every other store opens as it is.
export const CHROME_STORES=['flipkart'];
export const needsChrome=id=>CHROME_STORES.includes(id);
export const chromeAgent=(ua=globalThis.navigator?.userAgent||'')=>ua.replace(/; wv\)/,')').replace(/ Version\/[\d.]+/,'');

// Runs in the store page: a slim bar with one button, well above the bottom edge so it clears Android's
// gesture bar and the store's own bottom navigation (the in-app browser draws under the gesture bar and
// store pages rarely set viewport-fit). It steps aside while the person types, so it never covers a
// login form. Re-added on every page load because the person may sign in or navigate first.
const banner=label=>`(()=>{if(document.getElementById('tbw-bar'))return;const bar=document.createElement('div');bar.id='tbw-bar';
bar.setAttribute('style','position:fixed;left:12px;right:12px;bottom:max(112px,calc(64px + env(safe-area-inset-bottom,0px)));z-index:2147483647;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:16px;background:#28101F;color:#FBF5EC;font:600 14px/1.3 Montserrat,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)');
const col=document.createElement('div');col.setAttribute('style','flex:1;min-width:0;display:flex;flex-direction:column');
const style=document.createElement('style');style.textContent='@keyframes tbw-slide{from{transform:translateX(-100%)}to{transform:translateX(290%)}}#tbw-bar-track.busy i{width:35%!important;animation:tbw-slide 1.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){#tbw-bar-track.busy i{animation:none;width:100%!important;opacity:.4}}';
const track=document.createElement('div');track.id='tbw-bar-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Import progress');track.setAttribute('style','display:none;position:relative;height:5px;margin-top:8px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden');
const fill=document.createElement('i');fill.setAttribute('style','display:block;height:100%;width:0;border-radius:inherit;background:#F7A8CB;transition:width .35s ease');track.append(fill);
const text=document.createElement('span');text.id='tbw-bar-text';text.textContent=${JSON.stringify('Signed in to '+label+'? Bring your orders into your wardrobe.')};
const go=document.createElement('button');go.id='tbw-bar-go';go.textContent='Import my orders';go.setAttribute('style','border:0;border-radius:999px;padding:10px 14px;background:#C2477F;color:#fff;font:700 13px Montserrat,system-ui,sans-serif');
go.onclick=()=>{go.disabled=true;go.textContent='Reading…';window.mobileApp.postMessage({detail:{tbw:'go'}});};
col.append(text,track);bar.append(col,go);document.head.appendChild(style);document.body.appendChild(bar);
const typing=()=>/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
const sync=()=>{bar.style.display=typing()?'none':'flex';};
document.addEventListener('focusin',sync,true);document.addEventListener('focusout',()=>setTimeout(sync,60),true);sync();})();`;
// pct: a number shows the share done, null a moving bar while the total is unknown, undefined hides it.
const say=(text,done=false,pct,button)=>`(()=>{const t=document.getElementById('tbw-bar-text'),b=document.getElementById('tbw-bar-go'),k=document.getElementById('tbw-bar-track');if(t)t.textContent=${JSON.stringify(text)};if(b){b.disabled=${!done};b.textContent=${JSON.stringify(button||(done?'Try again':'Reading…'))};}
if(k){const p=${pct===undefined?'undefined':JSON.stringify(pct)};k.style.display=p===undefined?'none':'block';k.classList.toggle('busy',p===null);if(typeof p==='number'){k.firstChild.style.width=p+'%';k.setAttribute('aria-valuenow',p);}else k.removeAttribute('aria-valuenow');}})();`;
const pace=(done,total,startedAt)=>globalThis.WardrobeIntake?.importProgress?.(done,total,startedAt)||{pct:total?Math.round(Math.min(1,done/total)*100):null,left:''};
// Wraps the connector's extract() so partial pages and the final result come back as messages.
const runner=c=>`(async()=>{const send=d=>window.mobileApp.postMessage({detail:d});window.__tbwEmit=(d,progress)=>send({tbw:'part',data:d,progress});
try{const result=await (${c.extract.toString()})();send({tbw:'done',result});}catch(e){send({tbw:'done',result:{error:'layout',detail:String(e).slice(0,200)}});}})();`;

// preShowScript (observer.js, for stores whose order list needs the page's own responses) only
// runs when the browser is presented after the page loads, so isPresentAfterPageLoad is on.
// Opens the store and resolves when the import finishes or the person closes the browser.
// onData(data) receives connector-shaped data (e.g. {lines:[...]} for Myntra) one chunk at a time.
export async function run(id,{onData=()=>{},onStatus=()=>{},asChrome=false}={}){
 const IAB=plugin(),c=connectors.find(x=>x.id===id);
 if(!IAB||!c)throw new Error('Store imports open inside The Wardrobe OS app.');
 let observer='';try{observer=await (await fetch('store-observer.js')).text();}catch{}
 const handles=[];let streamed=0,finished=false,webview,startedAt=0;
 const cleanup=()=>{for(const h of handles)h?.remove?.();};
 return new Promise(async(resolve,reject)=>{
  const finish=(value,error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
  const exec=code=>IAB.executeScript({code,...(webview?{id:webview}:{})}).catch(()=>{});
  handles.push(await IAB.addListener('browserPageLoaded',()=>exec(banner(c.label))));
  handles.push(await IAB.addListener('closeEvent',()=>finish({count:streamed,closed:true})));
  handles.push(await IAB.addListener('messageFromWebview',async e=>{
   const d=e?.detail||{};
   if(d.tbw==='go'){startedAt=Date.now();onStatus('reading');exec(say('Reading your '+c.label+' orders. Keep this open…',false,null));exec(runner(c));}
   else if(d.tbw==='part'&&d.data){const n=d.data.lines?.length??d.data.orders?.reduce((a,o)=>a+(o.products?.length||0),0)??0;streamed+=n;onData(d.data);const p=d.progress||{},{pct,left}=pace(p.page,p.pages,startedAt);onStatus('reading',{page:p.page,pages:p.pages,count:streamed});
    // Items read, not pieces: the app decides later which of them are clothes.
    exec(say(`${pct!=null?pct+'% · ':''}${streamed} ${streamed===1?'item':'items'} read${pct==null?' so far':''}${left?' · '+left:''}`,false,pct));}
   else if(d.tbw==='done'){
    const r=d.result||{};
    if(r.error==='login'){onStatus('login');exec(say('Sign in to '+c.label+' first, then tap Import again.',true));return;}
    if(r.error){exec(say(c.label+"'s order page looked different than expected. Nothing was imported.",true));onStatus('error');return;}
    if(!streamed)onData(r);
    // Show the finished bar for a moment so the person sees it complete, then return to the app.
    exec(say(`Done · ${streamed||r.lines?.length||r.orders?.length||0} items read. Back to your wardrobe…`,false,100,'Done ✓'));
    onStatus('done');setTimeout(()=>IAB.close().catch(()=>{}),900);finish({count:streamed||r.lines?.length||r.orders?.length||r.pages?.length||0});
   }
  }));
  try{
   const opened=await IAB.openWebView({url:c.ordersUrl,title:c.label+' orders',toolbarType:'navigation',isPresentAfterPageLoad:true,
    ...(asChrome&&needsChrome(id)?{headers:{'User-Agent':chromeAgent()}}:{}),
    preShowScript:observer,preShowScriptInjectionTime:'documentStart'});
   webview=opened?.id;
  }catch(e){finish(null,new Error(c.label+' could not be opened. Try again.'));}
 });
}
if(typeof window!=='undefined')window.NativeImport={available,run,NATIVE_ORDER,needsChrome};
