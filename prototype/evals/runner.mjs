import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {TASKS,SYSTEM,meta} from './tasks.mjs';
import {costOf} from './models.mjs';
import {callModel,EvalError} from './providers.mjs';
import {prepareImage,composition,PROTOTYPE_DIR} from './golden.mjs';
import {scoreLook,scoreQuery,aggregate} from './scoring.mjs';
import {scaleAnalysis} from './scale.mjs';

export const LAB_DIR=path.join(PROTOTYPE_DIR,'.local-data','evals');
export const newRunId=(now=Date.now())=>new Date(now).toISOString().replace(/[-:]/g,'').replace(/\..+/,'').replace('T','-')+'-'+randomBytes(2).toString('hex');

export function itemsFor(task,golden,limit){const list=task==='look'?golden.looks:golden.queries;return Number.isFinite(limit)&&limit>0?list.slice(0,limit):list;}
// Upper-bound style estimate from typical token counts; unknown-price models are listed, not guessed.
export function estimate({models,tasks,golden,limit,repeat=1}){
 let usd=0;const unpriced=new Set(),perModel={};
 for(const t of tasks){const n=itemsFor(t,golden,limit).length*repeat;const e=TASKS[t].estimate;
  for(const m of models){const c=costOf(m,{input:e.input,output:e.output});if(c===null){unpriced.add(m.id);continue;}perModel[m.id]=(perModel[m.id]||0)+c*n;usd+=c*n;}}
 return {usd,perModel,unpriced:[...unpriced],calls:tasks.reduce((s,t)=>s+itemsFor(t,golden,limit).length*repeat*models.length,0)};
}

function limiter(n){let active=0;const queue=[];const next=()=>{if(active>=n||!queue.length)return;active++;const {fn,resolve,reject}=queue.shift();fn().then(resolve,reject).finally(()=>{active--;next();});};return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});next();});}

export async function runEval({models,tasks=['look','query'],golden,limit,repeat=1,maxUsd=5,concurrency=3,maxDim=1024,env=process.env,fetcher=fetch,labDir=LAB_DIR,useCache=true,onProgress=()=>{},signal,runId=newRunId(),now=Date.now,allowUnpriced=true}){
 tasks=tasks.filter(t=>TASKS[t]);if(!tasks.length)throw new EvalError('bad_request','No valid tasks');
 const est=estimate({models,tasks,golden,limit,repeat});
 if(est.usd>maxUsd)throw new EvalError('budget',`Estimated cost $${est.usd.toFixed(2)} is above the $${maxUsd} cap. Raise --max-usd, lower --limit, or pick cheaper tiers.`);
 if(est.unpriced.length&&!allowUnpriced)throw new EvalError('budget','No price for: '+est.unpriced.join(', '));
 const runDir=path.join(labDir,'runs',runId),cacheDir=path.join(labDir,'cache');await mkdir(runDir,{recursive:true});await mkdir(cacheDir,{recursive:true});
 const itemsFile=path.join(runDir,'items.jsonl');await writeFile(itemsFile,'');
 const {promptVersion,taxonomyVersion}=meta();const images=new Map();const image=async g=>{if(!images.has(g.path))images.set(g.path,prepareImage(g.path,maxDim));return images.get(g.path);};
 const jobs=[];for(const t of tasks)for(const g of itemsFor(t,golden,limit))for(const m of models)for(let r=0;r<repeat;r++)jobs.push({task:t,g,m,r});
 const limits={};const lim=p=>limits[p]||=limiter(p==='ollama'?1:concurrency);
 let spent=0,done=0,stopped=false;const records=[];const startedAt=new Date(now()).toISOString();
 onProgress({type:'start',runId,total:jobs.length,estimateUsd:est.usd});
 await Promise.all(jobs.map(job=>lim(job.m.provider)(async()=>{
  const {task,g,m,r}=job;const T=TASKS[task];
  const base={runId,modelId:m.id,label:m.label,provider:m.provider,tier:m.tier,openWeights:m.openWeights,priceVerified:m.verified,task,itemId:g.id,repeat:r,tags:g.tags};
  let rec;
  if(signal?.aborted||stopped){rec={...base,ok:false,error:{code:signal?.aborted?'aborted':'budget',message:signal?.aborted?'Run cancelled':'Budget cap reached'}};}
  else{
   try{
    const img=T.needsImage?await image(g):null;
    const key=createHash('sha256').update(JSON.stringify([m.provider,m.model,m.options,task,promptVersion,taxonomyVersion,img?img.hash+':'+maxDim:g.query,r])).digest('hex');
    const cacheFile=path.join(cacheDir,key+'.json');let res=null,cached=false;
    if(useCache&&m.provider!=='mock'){try{res=JSON.parse(await readFile(cacheFile,'utf8'));cached=true;}catch{}}
    if(!res){const t0=now();const out=await callModel({model:m,system:SYSTEM,prompt:T.prompt(g),image:img,schema:T.schema,schemaName:T.schemaName,env,fetcher,signal,timeoutMs:120000,gold:g,seed:[m.id,g.id,r].join('|')});res={...out,latencyMs:now()-t0};if(m.provider!=='mock')await writeFile(cacheFile,JSON.stringify(res));}
    const costUsd=costOf(m,res.usage);if(!cached&&typeof costUsd==='number'){spent+=costUsd;if(spent>=maxUsd)stopped=true;}
    const s=task==='look'?scoreLook(res.json,g):scoreQuery(res.json,g);
    rec={...base,ok:true,cached,score:s.score,parts:s.parts||null,recall:s.recall??null,precision:s.precision??null,iou:s.iou??null,fields:s.fields,details:s.details,usage:res.usage,costUsd,latencyMs:res.latencyMs,notes:res.notes||[],output:res.json};
   }catch(e){
    if(e?.code==='aborted')stopped=true;
    rec={...base,ok:false,error:{code:e?.code||'error',message:String(e?.message||e).slice(0,300)}};
   }
  }
  records.push(rec);await appendFile(itemsFile,JSON.stringify(rec)+'\n');done++;
  onProgress({type:'progress',runId,done,total:jobs.length,spentUsd:spent,last:{model:m.label,task,item:g.id,ok:rec.ok,error:rec.error?.code}});
 })));
 const hardest=Object.fromEntries(tasks.map(t=>{const by=Object.groupBy(records.filter(r=>r.task===t),r=>r.itemId);return [t,Object.entries(by).map(([id,rs])=>({id,score:rs.reduce((s,r)=>s+(r.ok?r.score:0),0)/rs.length,tags:rs[0].tags})).sort((a,b)=>a.score-b.score).slice(0,8)];}));
 const failures=Object.fromEntries(tasks.map(t=>[t,records.filter(r=>r.task===t&&r.ok&&r.score<0.6).sort((a,b)=>a.score-b.score).slice(0,12).map(r=>({model:r.label,item:r.itemId,score:r.score,details:r.details}))]));
 const summary={runId,startedAt,finishedAt:new Date(now()).toISOString(),...meta(),mock:models.some(m=>m.provider==='mock'),
  config:{tasks,repeat,maxDim,limit:limit??null,maxUsd,models:models.map(m=>({id:m.id,label:m.label,provider:m.provider,model:m.model,tier:m.tier,price:m.price,priceVerified:m.verified,openWeights:m.openWeights,options:m.options}))},
  dataset:{looks:itemsFor('look',golden,limit).length,queries:itemsFor('query',golden,limit).length,lookComposition:composition(itemsFor('look',golden,limit)),queryComposition:composition(itemsFor('query',golden,limit)),warnings:golden.warnings||[]},
  estimateUsd:est.usd,spentUsd:spent,stoppedEarly:stopped,rows:aggregate(records),hardest,failures};
 if(tasks.includes('look'))summary.scale=scaleAnalysis(records,summary.rows);
 const keyMakers=[...new Set(itemsFor('look',golden,limit).map(g=>g.labeledBy).filter(l=>String(l).startsWith('ai-consensus:')))];if(keyMakers.length)summary.answerKey={labeledBy:keyMakers,agreement:golden.keyAgreement||null};
 await writeFile(path.join(runDir,'summary.json'),JSON.stringify(summary,null,1));
 onProgress({type:'done',runId,spentUsd:spent});
 return summary;
}
