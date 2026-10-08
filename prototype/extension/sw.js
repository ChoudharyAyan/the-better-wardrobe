import {connectors} from './connectors.js';

const DEFAULT_APP='http://127.0.0.1:5190';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Resolves once the tab has finished loading (or after 30 s, whichever comes first).
function loaded(tabId){
 return new Promise(resolve=>{
  const done=()=>{chrome.tabs.onUpdated.removeListener(listener);clearTimeout(timer);resolve();};
  const listener=(id,info)=>{if(id===tabId&&info.status==='complete')done();};
  const timer=setTimeout(done,30000);
  chrome.tabs.onUpdated.addListener(listener);
 });
}

const count=data=>data.lines?.length??data.orders?.length??data.pages?.length??0;

async function run(id){
 const connector=connectors.find(c=>c.id===id);
 if(!connector)throw new Error('Unknown store.');
 const {appUrl=DEFAULT_APP}=await chrome.storage.local.get('appUrl');
 // A visible tab: stores that load more orders on scroll don't do so in background tabs.
 const tab=await chrome.tabs.create({url:connector.ordersUrl,active:true});
 let keepTab=false;
 try{
  await loaded(tab.id);await sleep(2500);
  const [{result}={}]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:connector.extract});
  if(!result||result.error==='login'){keepTab=true;return {ok:false,error:`Sign in to ${connector.label} in the tab we opened, then run it again.`};}
  if(result.error)return {ok:false,error:`${connector.label}'s order page looked different than expected. Nothing was imported.`};
  const response=await fetch(appUrl.replace(/\/$/,'')+'/api/connectors/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({store:id,data:result})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)return {ok:false,error:body.error||`The Wardrobe OS at ${appUrl} did not accept the import. Is it running with ORDER_CONNECTORS=true?`};
  return {ok:true,count:count(result)};
 }finally{if(!keepTab)chrome.tabs.remove(tab.id).catch(()=>{});}
}

chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
 if(message?.type!=='run')return;
 run(message.id)
  .catch(e=>({ok:false,error:String(e?.message||e)}))
  .then(async result=>{
   const {results={}}=await chrome.storage.local.get('results');
   results[message.id]={...result,at:new Date().toISOString()};
   await chrome.storage.local.set({results});
   reply(result);
  });
 return true;
});
