import {connectors} from './connectors.js';

const list=document.querySelector('#stores'),appUrl=document.querySelector('#app-url');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function status(result){
 if(!result)return '';
 const when=new Date(result.at).toLocaleString();
 return result.ok?`<small>${Number(result.count)||0} order records sent · ${esc(when)}</small>`:`<small class="error">${esc(result.error)}</small>`;
}

async function render(){
 const {results={}}=await chrome.storage.local.get('results');
 list.innerHTML=connectors.map(c=>`<li><span>${c.label}${c.verified?'':' <b class="tag">unverified</b>'}${status(results[c.id])}</span><button data-id="${c.id}">Import</button></li>`).join('');
}

list.addEventListener('click',async e=>{
 const button=e.target.closest('button[data-id]');if(!button)return;
 button.disabled=true;button.textContent='Working…';
 // The store tab opens in front and closes this popup; the service worker carries on
 // and saves the result, which shows here next time the popup opens.
 chrome.runtime.sendMessage({type:'run',id:button.dataset.id},()=>render());
});

appUrl.addEventListener('change',()=>chrome.storage.local.set({appUrl:appUrl.value.trim()}));
chrome.storage.local.get('appUrl').then(({appUrl:saved})=>{if(saved)appUrl.value=saved;});
render();
