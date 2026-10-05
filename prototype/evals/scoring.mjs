import {canonicalCategory,categoryCredit,colourCredit,canonicalColour,canonicalEnum,isUnscored} from './taxonomy.mjs';

export const LOOK_FIELDS=['category','department','colour','pattern','sleeve','fit','length','neckline','fabric','occasion','ethnic','brand_visible','search'];
export const QUERY_FIELDS=['category','department','colour','pattern','occasion','ethnic','min_price_inr','max_price_inr','size','brand','language'];

export function iou(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==4||b.length!==4)return null;
 const n=v=>v.map(Number);let [ax1,ay1,ax2,ay2]=n(a),[bx1,by1,bx2,by2]=n(b);
 if([ax1,ay1,ax2,ay2,bx1,by1,bx2,by2].some(v=>!Number.isFinite(v)))return null;
 [ax1,ax2]=[Math.min(ax1,ax2),Math.max(ax1,ax2)];[ay1,ay2]=[Math.min(ay1,ay2),Math.max(ay1,ay2)];[bx1,bx2]=[Math.min(bx1,bx2),Math.max(bx1,bx2)];[by1,by2]=[Math.min(by1,by2),Math.max(by1,by2)];
 const w=Math.max(0,Math.min(ax2,bx2)-Math.max(ax1,bx1)),h=Math.max(0,Math.min(ay2,by2)-Math.max(ay1,by1)),inter=w*h;
 const union=(ax2-ax1)*(ay2-ay1)+(bx2-bx1)*(by2-by1)-inter;return union>0?inter/union:0;
}
const words=s=>String(s??'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/[\s-]+/).filter(w=>w.length>1&&!['a','an','the','and','with','of'].includes(w)).map(w=>w.replace(/(es|s)$/,''));
// Share of the labelled features the model mentioned anywhere (in features or its label).
export function featureRecall(gold,pred,label=''){
 const have=new Set([...(pred||[]).flatMap(words),...words(label)]);
 const g=(gold||[]).filter(Boolean);if(!g.length)return null;
 return g.filter(f=>{const w=words(f);return w.length&&w.every(x=>have.has(x));}).length/g.length;
}
export function fieldCredit(field,gold,pred,predItem={}){
 if(field==='category')return categoryCredit(gold,pred);
 if(field==='colour')return colourCredit(gold,pred);
 if(field==='ethnic')return Boolean(gold)===Boolean(pred)?1:0;
 if(field==='features')return featureRecall(gold,pred,predItem.label);
 if(field==='brand_visible'){const g=String(gold).toLowerCase().trim(),p=String(pred??'').toLowerCase().trim();return p&&(p.includes(g)||g.includes(p))?1:0;}
 return canonicalEnum(field,gold)===canonicalEnum(field,pred)?1:0;
}

// Greedy one-to-one matching: same category (or a sibling in the same group) is required; label wording breaks ties.
// Boxes never decide a match: models ignore the requested box format (Gemini answers [y,x,y,x], Claude in pixels),
// so overlap would score vendors' box conventions rather than vision. It is still reported as iou.
const labelSim=(a,b)=>{const A=searchWords(a),B=new Set(searchWords(b));if(!A.length||!B.size)return 0;const hit=A.filter(w=>B.has(w)).length;return hit/new Set([...A,...B]).size;};
export function matchItems(goldItems,predItems){
 const pairs=[];
 goldItems.forEach((g,gi)=>predItems.forEach((p,pi)=>{const credit=categoryCredit(g.category,p.category);if(!credit)return;const overlap=iou(g.box,p.box);pairs.push({gi,pi,weight:credit*2+labelSim(g.label,p.label),overlap});}));
 pairs.sort((a,b)=>b.weight-a.weight);const usedG=new Set(),usedP=new Set(),out=[];
 for(const p of pairs){if(usedG.has(p.gi)||usedP.has(p.pi))continue;usedG.add(p.gi);usedP.add(p.pi);out.push(p);}
 return out;
}

// Image understanding score: one number for "how well does the model see, name, describe and make
// search-ready everything in the image". Parts without anything labelled to score drop out and the
// remaining weights are rescaled. Nothing here searches the web: every part compares against the key.
export const PART_WEIGHTS={spots:0.25,names:0.25,describes:0.30,search:0.20};
export const DESCRIBE_FIELDS=['department','colour','pattern','sleeve','fit','length','neckline','fabric','occasion','ethnic','brand_visible'];
const SEARCH_STOP=new Set(['a','an','the','and','with','for','of','in','on','to','buy','online','india','shop']);
export const searchWords=s=>[...new Set(String(s??'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/[\s-]+/).filter(w=>w.length>1&&!SEARCH_STOP.has(w)).map(w=>w.replace(/(es|s)$/,'')))];
// Share of the key's search terms that appear anywhere in what the model would hand to a keyword search.
export function searchRecall(goldItem,predItem){
 const terms=goldItem.search_terms?.length?goldItem.search_terms.flatMap(searchWords):(goldItem.features||[]).flatMap(searchWords);
 if(!terms.length)return null;
 const have=new Set([...searchWords(predItem.search_query),...searchWords(predItem.label),...(predItem.features||[]).flatMap(searchWords)]);
 const unique=[...new Set(terms)];return unique.filter(t=>have.has(t)).length/unique.length;
}
const avg=a=>{const v=a.filter(x=>x!==null&&x!==undefined);return v.length?v.reduce((p,c)=>p+c,0)/v.length:null;};
export function combineParts(parts){let sum=0,w=0;for(const [k,wt] of Object.entries(PART_WEIGHTS)){if(parts[k]===null||parts[k]===undefined)continue;sum+=parts[k]*wt;w+=wt;}return w?sum/w:0;}

export function scoreLook(pred,gold){
 const goldItems=gold.items||[];const predItems=Array.isArray(pred?.items)?pred.items.filter(x=>x&&typeof x==='object'):[];
 const matches=matchItems(goldItems,predItems);const fields={};const details=[];const overlaps=[];const names=[],describes=[],search=[];
 const add=(f,c)=>{(fields[f]||={sum:0,n:0}).sum+=c;fields[f].n++;};
 for(const m of matches){
  const g=goldItems[m.gi],p=predItems[m.pi];const fs={};
  const name=g.categoryUnscored?null:categoryCredit(g.category,p.category);if(name!==null){names.push(name);add('category',name);fs.category=name;}
  const ds=[];for(const f of DESCRIBE_FIELDS){if(isUnscored(g[f])&&!(f==='ethnic'&&typeof g[f]==='boolean'))continue;const c=fieldCredit(f,g[f],p[f],p);if(c===null)continue;ds.push(c);add(f,c);fs[f]=c;}
  const d=avg(ds);if(d!==null)describes.push(d);
  const sr=searchRecall(g,p);if(sr!==null){search.push(sr);add('search',sr);fs.search=sr;}
  if(m.overlap!==null)overlaps.push(m.overlap);
  details.push({gold:g.label||g.category,pred:p.label||p.category,query:p.search_query||'',score:combineParts({spots:1,names:name,describes:d,search:sr}),fields:fs});
 }
 // Missed items lower `spots`; the other parts are measured on the items the model did find.
 for(const [gi,g] of goldItems.entries())if(!matches.some(m=>m.gi===gi))details.push({gold:g.label||g.category,pred:null,score:0,fields:{}});
 const spots=goldItems.length?matches.length/goldItems.length:null;
 const parts={spots,names:matches.length?avg(names):(goldItems.length?0:null),describes:matches.length?avg(describes):(goldItems.length?0:null),search:matches.length?avg(search):(goldItems.length?0:null)};
 const precision=gold.exhaustive?(predItems.length?matches.length/predItems.length:0):null;
 return {score:goldItems.length?combineParts(parts):0,parts,recall:spots,precision,iou:overlaps.length?overlaps.reduce((a,b)=>a+b,0)/overlaps.length:null,fields,goldCount:goldItems.length,predCount:predItems.length,details};
}

const norm=v=>String(v??'').toLowerCase().trim();
export function queryFieldCredit(field,gold,pred){
 if(field==='min_price_inr'||field==='max_price_inr'){const g=gold===null||gold===''?null:Number(gold),p=pred===null||pred===undefined||pred===''?null:Number(pred);return g===null?(p===null?1:0):(p!==null&&Math.abs(p-g)<0.5?1:0);}
 if(field==='ethnic')return Boolean(gold)===Boolean(pred)?1:0;
 if(field==='category')return !norm(gold)?(!norm(pred)?1:0):categoryCredit(gold,pred);
 if(field==='colour')return !norm(gold)?(!norm(pred)?1:0):colourCredit(gold,pred);
 if(['pattern','occasion'].includes(field))return !norm(gold)?(!norm(pred)?1:0):(canonicalEnum(field,gold)===canonicalEnum(field,pred)?1:0);
 if(field==='department'||field==='language')return canonicalEnum(field,gold||'unknown')===canonicalEnum(field,pred||'unknown')?1:0;
 return norm(gold)===norm(pred)?1:0;
}
export function scoreQuery(pred,gold){
 const expect=gold.expect||{};const fields={};let sum=0,n=0;
 for(const f of QUERY_FIELDS){if(!(f in expect))continue;const c=queryFieldCredit(f,expect[f],pred?.[f]);fields[f]={sum:c,n:1};sum+=c;n++;}
 return {score:n?sum/n:0,fields,details:[{gold:gold.query,pred:pred?{category:canonicalCategory(pred.category),colour:canonicalColour(pred.colour),max:pred.max_price_inr}:null,score:n?sum/n:0}]};
}

const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.ceil(s.length*p)-1))];};
const std=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
// Records → one row per (model, task). Failed calls score 0 so unreliable models cannot hide behind their successes.
export function aggregate(records){
 const groups=new Map();
 for(const r of records){const k=r.modelId+'|'+r.task;(groups.get(k)||groups.set(k,[]).get(k)).push(r);}
 return [...groups.values()].map(rs=>{
  const ok=rs.filter(r=>r.ok),scores=rs.map(r=>r.ok?r.score:0);
  const byRepeat=Object.values(Object.groupBy(rs,r=>r.repeat)).map(g=>mean(g.map(r=>r.ok?r.score:0)));
  const fields={};for(const r of ok)for(const [f,v] of Object.entries(r.fields||{})){(fields[f]||={sum:0,n:0}).sum+=v.sum;fields[f].n+=v.n;}
  const slices={};for(const r of rs)for(const t of r.tags||[]){(slices[t]||=[]).push(r.ok?r.score:0);}
  const errors={};for(const r of rs.filter(r=>!r.ok))errors[r.error?.code||'error']=(errors[r.error?.code||'error']||0)+1;
  const costs=rs.map(r=>r.costUsd).filter(v=>typeof v==='number');const latency=ok.map(r=>r.latencyMs).filter(Number.isFinite);
  const first=rs[0];
  return {modelId:first.modelId,label:first.label,provider:first.provider,tier:first.tier,openWeights:!!first.openWeights,priceVerified:first.priceVerified!==false,task:first.task,
   calls:rs.length,okRate:ok.length/rs.length,errors,score:mean(scores),scoreSe:scores.length>1?std(scores)/Math.sqrt(scores.length):null,scoreStd:std(byRepeat),repeats:byRepeat.length,
   parts:Object.fromEntries(['spots','names','describes','search'].map(k=>[k,mean(ok.map(r=>r.parts?.[k]).filter(v=>v!==null&&v!==undefined))])),
   recall:mean(ok.map(r=>r.recall).filter(v=>v!==null&&v!==undefined)),precision:mean(ok.map(r=>r.precision).filter(v=>v!==null&&v!==undefined)),iou:mean(ok.map(r=>r.iou).filter(v=>v!==null&&v!==undefined)),
   fields:Object.fromEntries(Object.entries(fields).map(([f,v])=>[f,v.n?v.sum/v.n:null])),slices:Object.fromEntries(Object.entries(slices).map(([t,v])=>[t,{n:v.length,score:mean(v)}])),
   latencyP50:pct(latency,0.5),latencyP95:pct(latency,0.95),inputTokens:mean(ok.map(r=>r.usage?.input||0)),outputTokens:mean(ok.map(r=>r.usage?.output||0)),
   costUsd:costs.length?costs.reduce((a,b)=>a+b,0):null,costPer1k:costs.length?mean(costs)*1000:null,notes:[...new Set(rs.flatMap(r=>r.notes||[]))]};
 });
}
