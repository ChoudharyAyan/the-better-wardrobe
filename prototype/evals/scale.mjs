// "Which model for the first 1,000 users, and for 10,000?" answered from the run's own answers, at no extra cost.
// Besides single models it simulates cascades: a cheap model reads every image, and only images it is unsure
// about (or flags as a celebrity or ethnic look) go on to a stronger model. Each image's real score and real cost
// for both models are already in the run, so the blended score and cost are exact for this image set.
export const BANDS=[
 {id:'early',label:'Up to 1,000 image searches / month',volume:1000,tolerance:0.01,why:'Cost is a few dollars either way: buy the best quality.'},
 {id:'growth',label:'1,000–10,000 / month',volume:10000,tolerance:0.03,why:'Give up at most 3 points to save money.'},
 {id:'scale',label:'10,000–100,000 / month',volume:100000,tolerance:0.05,why:'Cost dominates: give up at most 5 points.'}
];
export const eligible=r=>r.okRate>=0.98&&!(r.privacyRate>0.02);
const RULES=[
 {id:'conf70',label:'escalate when unsure (confidence < 0.7)',test:o=>minConf(o)<0.7},
 {id:'conf85',label:'escalate when not confident (< 0.85)',test:o=>minConf(o)<0.85},
 {id:'special',label:'escalate celebrity and ethnic looks',test:o=>!!o?.known_item?.is_specific||(o?.items||[]).some(i=>i.ethnic)}
];
function minConf(o){const c=(o?.items||[]).map(i=>Number(i.confidence)).filter(Number.isFinite);return c.length?Math.min(...c):0;}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

export function cascades(records,rows){
 const look=records.filter(r=>r.task==='look'&&r.repeat===0);const by=new Map(look.map(r=>[r.modelId+'|'+r.itemId,r]));
 const images=[...new Set(look.map(r=>r.itemId))];
 const pool=rows.filter(r=>r.task==='look'&&eligible(r)&&typeof r.costPer1k==='number').sort((a,b)=>a.costPer1k-b.costPer1k);
 if(pool.length<2)return [];
 const median=pool[Math.floor((pool.length-1)/2)].costPer1k;const cheap=pool.filter(r=>r.costPer1k<=median);const strong=[...pool].sort((a,b)=>b.score-a.score).slice(0,3);
 const out=[];
 for(const A of cheap)for(const B of strong){if(B.modelId===A.modelId||B.score<=A.score)continue;
  for(const rule of RULES){const scores=[],costs=[];let up=0;
   for(const img of images){const ra=by.get(A.modelId+'|'+img),rb=by.get(B.modelId+'|'+img);if(!ra)continue;const esc=!ra.ok||rule.test(ra.output);if(esc)up++;
    scores.push(esc?(rb?.ok?rb.score:0):ra.score);costs.push((ra.costUsd||0)+(esc?(rb?.costUsd||0):0));}
   if(!scores.length)continue;
   out.push({kind:'cascade',id:`${A.modelId}>${B.modelId}:${rule.id}`,label:`${A.label} → ${B.label}`,rule:rule.label,score:mean(scores),costPer1k:mean(costs)*1000,escalation:up/scores.length,cheap:A.modelId,strong:B.modelId});}
 }
 return out;
}
export function frontierOf(options){const s=[...options].filter(o=>typeof o.costPer1k==='number').sort((a,b)=>a.costPer1k-b.costPer1k||b.score-a.score);const f=[];let best=-1;for(const o of s)if(o.score>best+1e-9){f.push(o);best=o.score;}return f;}

export function scaleAnalysis(records,rows){
 const singles=rows.filter(r=>r.task==='look'&&eligible(r)).map(r=>({kind:'single',id:r.modelId,label:r.label,score:r.score,costPer1k:r.costPer1k,tier:r.tier}));
 const casc=cascades(records,rows);const front=frontierOf([...singles,...casc]);
 // Only frontier cascades are worth showing; everything else is beaten on both axes.
 const options=[...singles,...casc.filter(c=>front.some(f=>f.id===c.id))];
 const bands=BANDS.map(b=>{const best=Math.max(...options.map(o=>o.score));const pick=options.filter(o=>o.score>=best-b.tolerance&&typeof o.costPer1k==='number').sort((x,y)=>x.costPer1k-y.costPer1k)[0];const top=[...options].sort((x,y)=>y.score-x.score)[0];
  return {...b,pick:pick&&{label:pick.label,rule:pick.rule,score:pick.score,monthlyUsd:pick.costPer1k*b.volume/1000,kind:pick.kind},best:top&&{label:top.label,score:top.score,monthlyUsd:top.costPer1k*b.volume/1000}};});
 const look=rows.filter(r=>r.task==='look'&&eligible(r));
 const winner=(get,label)=>{const v=look.map(r=>({r,v:get(r)})).filter(x=>typeof x.v==='number');if(!v.length)return null;const best=v.reduce((a,b)=>b.v>a.v?b:a);const value=v.filter(x=>x.v>=best.v-0.03&&typeof x.r.costPer1k==='number').sort((a,b)=>a.r.costPer1k-b.r.costPer1k)[0];return {label,best:{model:best.r.label,score:best.v},value:value&&{model:value.r.label,score:value.v,costPer1k:value.r.costPer1k}};};
 const PART_LABELS={spots:'Spotting every item',names:'Naming the product type',describes:'Describing attributes',search:'Search-ready phrasing'};
 const slices=[...new Set(look.flatMap(r=>Object.keys(r.slices||{})))].filter(t=>t!=='sample');
 const byExtraction=[...Object.entries(PART_LABELS).map(([k,l])=>winner(r=>r.parts?.[k],l)),...slices.map(t=>winner(r=>r.slices?.[t]?.score,'Images tagged '+t))].filter(Boolean);
 return {options,frontier:front.map(f=>f.id),bands,byExtraction};
}
