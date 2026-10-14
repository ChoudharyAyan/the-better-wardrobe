// My Wardrobe account sync (PRD NFR#2). Signed-in people keep their pieces, wear log and store
// picks on the server, so a new phone or a cleared browser does not empty the almirah. Guests keep
// everything on this device; when they sign in, what they added as a guest is carried across.
// Only changed pieces are sent: each synced piece's signature is remembered per account.
(()=>{
const KEY='tbw-wardrobe-sync-v1';
let account=null,signatures={},metaSig='',timer=null,running=null,again=false,latest=null,onChange=()=>{};
const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)+':'+s.length;};
// Images can be large data URLs; the signature only needs to notice that one changed.
const sig=p=>hash(JSON.stringify({...p,image:typeof p.image==='string'&&p.image.startsWith('data:')?hash(p.image):p.image||''}));
const load=()=>{try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');return all[account]||{items:{},meta:''};}catch{return {items:{},meta:''};}};
const save=()=>{try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');all[account]={items:signatures,meta:metaSig};localStorage.setItem(KEY,JSON.stringify(all));}catch{}};
async function api(method,path,body){
 const r=await fetch(path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data.error||'Your wardrobe could not be saved to your account.');e.status=r.status;throw e;}
 return data;
}
// What the server keeps for a piece. Drawn basics send their shape and colour, not a picture;
// pictures already on the server are not sent again.
function payload(p){
 const item={...p};delete item.image;
 const image=p.art?undefined:typeof p.image!=='string'?undefined:/^data:image\/(png|jpeg|webp);base64,/.test(p.image)||/^https:\/\//.test(p.image)?p.image:undefined;
 return {item,image};
}
const metaOf=s=>({wears:s.wears||[],looks:(s.looks||[]).map(l=>({id:l.id,ids:l.ids,title:l.title,occasion:l.occasion})),shops:s.shops||[],aiConsent:s.aiConsent===true});

async function flush(){
 const state=latest;if(!state||!account)return;
 const owned=state.items.filter(p=>p.source!=='Sample wardrobe');
 for(const p of owned){
  const s=sig(p);if(signatures[p.id]===s)continue;
  try{
   const {item}=await api('PUT','/api/wardrobe/items/'+encodeURIComponent(p.id),payload(p));
   // Swap a large local data URL for the server's cached picture link; it keeps this device's storage small.
   if(item?.image&&item.image.startsWith('/api/wardrobe/image/')&&p.image!==item.image&&!p.art){p.image=item.image;onChange();}
   signatures[p.id]=sig(p);save();
  }catch(e){if(e.status===401){stop();return;}if(e.status===409||e.status===413||e.status===400){signatures[p.id]=s;save();onChange(e.message);}else throw e;}
 }
 const ids=new Set(owned.map(p=>p.id));
 for(const id of Object.keys(signatures))if(!ids.has(id)){await api('DELETE','/api/wardrobe/items/'+encodeURIComponent(id));delete signatures[id];save();}
 const meta=metaOf(state),m=hash(JSON.stringify(meta));
 if(m!==metaSig){await api('PUT','/api/wardrobe/meta',meta);metaSig=m;save();}
}
function push(state){
 latest=state;if(!account)return;
 clearTimeout(timer);
 timer=setTimeout(async()=>{
  if(running){again=true;return;}
  running=flush().catch(()=>{}).finally(()=>{running=null;if(again){again=false;push(latest);}});
 },700);
}
// Signs in: reads the server's wardrobe and merges it with this device's. Server pieces win on
// conflict; pieces only on this device (added as a guest, or offline) are kept and uploaded.
async function start(id,state,{basicImage}={}){
 if(account===id)return null;
 account=id;({items:signatures,meta:metaSig}=load());
 let remote;try{remote=await api('GET','/api/wardrobe');}catch(e){if(e.status===401)stop();return null;}
 const byId=new Map(remote.items.map(p=>[p.id,p.art&&basicImage?{...p,image:basicImage(p.art.shape,p.art.colour)}:p]));
 for(const p of remote.items)signatures[p.id]=sig(byId.get(p.id));
 const local=state.items.filter(p=>!byId.has(p.id)&&p.source!=='Sample wardrobe');
 const union=(a=[],b=[])=>{const seen=new Set(a.map(x=>x.id));return [...a,...b.filter(x=>!seen.has(x.id))];};
 const merged={items:[...byId.values(),...local],wears:union(remote.meta?.wears,(state.wears||[]).filter(w=>!String(w.id).startsWith('seed-'))),looks:union(remote.meta?.looks,state.looks),
  shops:remote.meta?.shops?.length?remote.meta.shops:state.shops||[],aiConsent:Boolean(remote.meta?.aiConsent||state.aiConsent),uploaded:local.length};
 save();
 return merged;
}
function stop(){account=null;signatures={};metaSig='';clearTimeout(timer);}
window.WardrobeSync={start,push,stop,active:()=>Boolean(account),onChange:fn=>{onChange=fn;},_sig:sig,_payload:payload};
})();
