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

// Runs in the store page: a slim bar at the bottom with one button. Re-added on every page load
// because the person may sign in or navigate first.
const banner=label=>`(()=>{if(document.getElementById('tbw-bar'))return;const bar=document.createElement('div');bar.id='tbw-bar';
bar.setAttribute('style','position:fixed;left:12px;right:12px;bottom:16px;z-index:2147483647;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:16px;background:#28101F;color:#FBF5EC;font:600 14px/1.3 Montserrat,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)');
const text=document.createElement('span');text.id='tbw-bar-text';text.style.flex='1';text.textContent=${JSON.stringify('Signed in to '+label+'? Bring your orders into your wardrobe.')};
const go=document.createElement('button');go.id='tbw-bar-go';go.textContent='Import my orders';go.setAttribute('style','border:0;border-radius:999px;padding:10px 14px;background:#C2477F;color:#fff;font:700 13px Montserrat,system-ui,sans-serif');
go.onclick=()=>{go.disabled=true;go.textContent='Reading…';window.mobileApp.postMessage({detail:{tbw:'go'}});};
bar.append(text,go);document.body.appendChild(bar);})();`;
const say=(text,done=false)=>`(()=>{const t=document.getElementById('tbw-bar-text'),b=document.getElementById('tbw-bar-go');if(t)t.textContent=${JSON.stringify(text)};if(b){b.disabled=${!done};b.textContent=${JSON.stringify(done?'Try again':'Reading…')};}})();`;
// Wraps the connector's extract() so partial pages and the final result come back as messages.
const runner=c=>`(async()=>{const send=d=>window.mobileApp.postMessage({detail:d});window.__tbwEmit=d=>send({tbw:'part',data:d});
try{const result=await (${c.extract.toString()})();send({tbw:'done',result});}catch(e){send({tbw:'done',result:{error:'layout',detail:String(e).slice(0,200)}});}})();`;

// preShowScript (observer.js, for stores whose order list needs the page's own responses) only
// runs when the browser is presented after the page loads, so isPresentAfterPageLoad is on.
// Opens the store and resolves when the import finishes or the person closes the browser.
// onData(data) receives connector-shaped data (e.g. {lines:[...]} for Myntra) one chunk at a time.
export async function run(id,{onData=()=>{},onStatus=()=>{}}={}){
 const IAB=plugin(),c=connectors.find(x=>x.id===id);
 if(!IAB||!c)throw new Error('Store imports open inside The Wardrobe OS app.');
 let observer='';try{observer=await (await fetch('store-observer.js')).text();}catch{}
 const handles=[];let streamed=0,finished=false,webview;
 const cleanup=()=>{for(const h of handles)h?.remove?.();};
 return new Promise(async(resolve,reject)=>{
  const finish=(value,error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
  const exec=code=>IAB.executeScript({code,...(webview?{id:webview}:{})}).catch(()=>{});
  handles.push(await IAB.addListener('browserPageLoaded',()=>exec(banner(c.label))));
  handles.push(await IAB.addListener('closeEvent',()=>finish({count:streamed,closed:true})));
  handles.push(await IAB.addListener('messageFromWebview',async e=>{
   const d=e?.detail||{};
   if(d.tbw==='go'){onStatus('reading');exec(say('Reading your '+c.label+' orders. Keep this open…'));exec(runner(c));}
   else if(d.tbw==='part'&&d.data){const n=d.data.lines?.length||0;streamed+=n;onData({lines:d.data.lines||[]});onStatus('reading',{page:d.data.page,pages:d.data.pages,count:streamed});
    exec(say(`Read ${d.data.page} of ${d.data.pages} pages · ${streamed} pieces so far…`));}
   else if(d.tbw==='done'){
    const r=d.result||{};
    if(r.error==='login'){onStatus('login');exec(say('Sign in to '+c.label+' first, then tap Import again.',true));return;}
    if(r.error){exec(say(c.label+"'s order page looked different than expected. Nothing was imported.",true));onStatus('error');return;}
    if(!streamed)onData(r);
    onStatus('done');IAB.close().catch(()=>{});finish({count:streamed||r.lines?.length||r.orders?.length||r.pages?.length||0});
   }
  }));
  try{
   const opened=await IAB.openWebView({url:c.ordersUrl,title:c.label+' orders',toolbarType:'navigation',isPresentAfterPageLoad:true,
    preShowScript:observer,preShowScriptInjectionTime:'documentStart'});
   webview=opened?.id;
  }catch(e){finish(null,new Error(c.label+' could not be opened. Try again.'));}
 });
}
if(typeof window!=='undefined')window.NativeImport={available,run,NATIVE_ORDER};
