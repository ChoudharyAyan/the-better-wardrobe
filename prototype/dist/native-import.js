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

// Is the person signed in to the store? The pill only shows once they are: before that there is nothing
// to import. Most stores send a signed-out visitor to a login page or show a login form; Flipkart shows its
// orders page either way and Amazon may land on the cart after login, so those two ask their own order
// pages. Each probe is an expression for the store page that resolves to true or false.
const SIGNED_OUT_PAGE=`(()=>{if(/(^|\\/)(login|signin|sign-in|register|auth|authorization)(\\/|$)|\\/ap\\/signin/i.test(location.pathname))return true;
 return [...document.querySelectorAll('input[type=password],input[type=tel],input[autocomplete=one-time-code],input[name*=otp i]')].some(i=>i.offsetParent!==null);})()`;
const PROBES={
 flipkart:`fetch('https://2.rome.api.flipkart.com/api/5/self-serve/orders/?page=1&filterType=PREORDER_UNITS',{credentials:'include',headers:{'X-User-Agent':navigator.userAgent+' FKUA/website/42/website/Desktop'}}).then(r=>r.status!==401&&r.status!==403).catch(()=>false)`,
 amazon:`fetch('/gp/css/order-history',{credentials:'include'}).then(r=>!/\\/ap\\/signin/.test(r.url)).catch(()=>false)`
};
export const signedIn=id=>PROBES[id]?`(${SIGNED_OUT_PAGE}?Promise.resolve(false):${PROBES[id]})`:`Promise.resolve(!${SIGNED_OUT_PAGE})`;

// Runs in the store page. Idle it is a small pill in the bottom-right corner ("Import AJIO orders"),
// so it covers as little of the store as possible; while importing it widens into a bar with progress.
// It sits above whatever the store pins to the bottom of the screen (bottom menus, "Buy now" bars,
// cookie notices) and Android's gesture bar, rechecking as the page scrolls, and steps aside while the
// person types so it never covers a login form. Re-added on every page load (sign-in, navigation).
export const banner=(label,probe='Promise.resolve(true)')=>`(()=>{if(document.getElementById('tbw-bar'))return;
const bar=document.createElement('div');bar.id='tbw-bar';bar.dataset.mode='pill';let ready=false;
const style=document.createElement('style');style.textContent='#tbw-bar{position:fixed;right:12px;left:auto;bottom:112px;z-index:2147483647;display:flex;gap:10px;align-items:center;box-sizing:border-box;max-width:calc(100% - 24px);padding:6px;border-radius:999px;background:#28101F;color:#FBF5EC;font:600 14px/1.3 Montserrat,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);transition:bottom .2s ease}#tbw-bar[data-mode=full]{left:12px;right:12px;padding:12px 14px;border-radius:16px}#tbw-bar[data-mode=pill] #tbw-bar-col{display:none}#tbw-bar-col{flex:1;min-width:0;display:flex;flex-direction:column}#tbw-bar-go{border:0;border-radius:999px;padding:10px 16px;background:#C2477F;color:#fff;font:700 13px Montserrat,system-ui,sans-serif;white-space:nowrap}@keyframes tbw-slide{from{transform:translateX(-100%)}to{transform:translateX(290%)}}#tbw-bar-track.busy i{width:35%!important;animation:tbw-slide 1.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){#tbw-bar-track.busy i{animation:none;width:100%!important;opacity:.4}#tbw-bar{transition:none}}';
const col=document.createElement('div');col.id='tbw-bar-col';
const track=document.createElement('div');track.id='tbw-bar-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Import progress');track.setAttribute('style','display:none;position:relative;height:5px;margin-top:8px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden');
const fill=document.createElement('i');fill.setAttribute('style','display:block;height:100%;width:0;border-radius:inherit;background:#F7A8CB;transition:width .35s ease');track.append(fill);
const text=document.createElement('span');text.id='tbw-bar-text';
const go=document.createElement('button');go.id='tbw-bar-go';go.textContent=${JSON.stringify('Import '+label)};go.setAttribute('aria-label',${JSON.stringify('Import my '+label+' into The Wardrobe OS')});
go.onclick=()=>{go.disabled=true;go.textContent='Reading…';bar.dataset.mode='full';window.mobileApp.postMessage({detail:{tbw:'go'}});};
col.append(text,track);bar.append(col,go);document.head.appendChild(style);document.body.appendChild(bar);
// Lift above anything the store fixes to the bottom edge of the screen.
const lift=()=>{const h=innerHeight;let top=h;const seen=new Set();
 for(const x of [0.1,0.3,0.5,0.7,0.9])for(let y=h-2;y>h-260;y-=24)for(const el of document.elementsFromPoint(innerWidth*x,y)){
  if(seen.has(el)||bar.contains(el))continue;seen.add(el);const cs=getComputedStyle(el);if(cs.position!=='fixed'&&cs.position!=='sticky')continue;
  const r=el.getBoundingClientRect();if(r.bottom>=h-6&&r.height<h*0.45&&r.height>0)top=Math.min(top,r.top);}
 bar.style.bottom=Math.max(112,h-top+12)+'px';};
let pending=0;const soon=()=>{if(pending)return;pending=setTimeout(()=>{pending=0;lift();},200);};
addEventListener('scroll',soon,{passive:true});addEventListener('resize',soon);setInterval(lift,1500);lift();
const typing=()=>/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
const sync=()=>{bar.style.display=!ready||typing()?'none':'flex';};
document.addEventListener('focusin',sync,true);document.addEventListener('focusout',()=>setTimeout(sync,60),true);sync();
// Checked again every 2 s, so the pill appears by itself once sign-in completes on this page.
const check=async()=>{if(bar.dataset.mode==='full')return;let ok=false;try{ok=await (${probe});}catch{}if(ok!==ready){ready=ok;sync();lift();}};
check();setInterval(check,2000);})();`;
// pct: a number shows the share done, null a moving bar while the total is unknown, undefined hides it.
const say=(text,done=false,pct,button)=>`(()=>{const t=document.getElementById('tbw-bar-text'),b=document.getElementById('tbw-bar-go'),k=document.getElementById('tbw-bar-track'),bar=document.getElementById('tbw-bar');if(bar)bar.dataset.mode='full';if(t)t.textContent=${JSON.stringify(text)};if(b){b.disabled=${!done};b.textContent=${JSON.stringify(button||(done?'Try again':'Reading…'))};}
if(k){const p=${pct===undefined?'undefined':JSON.stringify(pct)};k.style.display=p===undefined?'none':'block';k.classList.toggle('busy',p===null);if(typeof p==='number'){k.firstChild.style.width=p+'%';k.setAttribute('aria-valuenow',p);}else k.removeAttribute('aria-valuenow');}})();`;
// Drops the store's service worker and its caches in this browser only; it re-registers on its next visit.
const FRESH=`(async()=>{try{for(const r of await navigator.serviceWorker?.getRegistrations?.()||[])await r.unregister();for(const k of await caches?.keys?.()||[])await caches.delete(k);}catch{}})();`;
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
 const handles=[];let streamed=0,finished=false,webview,startedAt=0,again=false;
 const cleanup=()=>{for(const h of handles)h?.remove?.();};
 return new Promise(async(resolve,reject)=>{
  const finish=(value,error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
  const exec=code=>IAB.executeScript({code,...(webview?{id:webview}:{})}).catch(()=>{});
  // A reader that first has to open another page (Instagram: your profile) asks to run again once it loads.
  handles.push(await IAB.addListener('browserPageLoaded',()=>{exec(banner(`${c.label} ${c.noun||'orders'}`,signedIn(id)));if(again){again=false;setTimeout(()=>{exec(say(`Reading your ${c.label} ${c.noun||'orders'}. Keep this open…`,false,null));exec(runner(c));},1500);}}));
  handles.push(await IAB.addListener('closeEvent',()=>finish({count:streamed,closed:true})));
  handles.push(await IAB.addListener('messageFromWebview',async e=>{
   const d=e?.detail||{};
   if(d.tbw==='go'){startedAt=Date.now();onStatus('reading');exec(say(`Reading your ${c.label} ${c.noun||'orders'}. Keep this open…`,false,null));exec(runner(c));}
   else if(d.tbw==='part'&&d.data){const n=d.data.lines?.length??d.data.orders?.reduce((a,o)=>a+(o.products?.length||0),0)??0;streamed+=n;onData(d.data);const p=d.progress||{},{pct,left}=pace(p.page,p.pages,startedAt);onStatus('reading',{page:p.page,pages:p.pages,count:streamed});
    // Items read, not pieces: the app decides later which of them are clothes.
    exec(say(`${pct!=null?pct+'% · ':''}${streamed} ${streamed===1?'item':'items'} read${pct==null?' so far':''}${left?' · '+left:''}`,false,pct));}
   else if(d.tbw==='done'){
    const r=d.result||{};
    if(r.retryAfterLoad){again=true;return;}
    if(r.error==='login'){onStatus('login');exec(say('Sign in to '+c.label+' first, then tap Import again.',true));return;}
    if(r.error){exec(say(c.label+"'s order page looked different than expected. Nothing was imported.",true));onStatus('error');return;}
    if(!streamed)onData(r);
    // Show the finished bar for a moment so the person sees it complete, then return to the app.
    exec(say(`Done · ${streamed||r.lines?.length||r.orders?.length||r.posts?.length||0} ${c.noun==='photos'?'posts':'items'} read. Back to your wardrobe…`,false,100,'Done ✓'));
    onStatus('done');setTimeout(()=>IAB.close().catch(()=>{}),900);finish({count:streamed||r.lines?.length||r.orders?.length||r.pages?.length||r.posts?.length||0});
   }
  }));
  try{
   const opened=await IAB.openWebView({url:c.ordersUrl,title:`${c.label} ${c.noun||'orders'}`,toolbarType:'navigation',isPresentAfterPageLoad:true,
    ...(asChrome&&needsChrome(id)?{headers:{'User-Agent':chromeAgent()}}:{}),
    preShowScript:observer,preShowScriptInjectionTime:'documentStart'});
   webview=opened?.id;
   // A store that refused this browser before may have cached those failures (HTTP cache and its own
   // service worker). Once it opens as Chrome, clear both (never cookies, so the person stays signed
   // in) and reload, so the page asks afresh. Seen with Flipkart: data request 200 only after this.
   if(asChrome&&needsChrome(id)){
    await IAB.clearCache(webview?{id:webview}:{}).catch(()=>{});
    await exec(FRESH);await new Promise(r=>setTimeout(r,400));
    await IAB.reload(webview?{id:webview}:{}).catch(()=>{});
   }
  }catch(e){finish(null,new Error(c.label+' could not be opened. Try again.'));}
 });
}
if(typeof window!=='undefined')window.NativeImport={available,run,NATIVE_ORDER,needsChrome};
