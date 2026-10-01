import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {MODELS,TIERS,PROVIDER_KEYS,selectModels} from './models.mjs';
import {loadGolden} from './golden.mjs';
import {runEval,estimate,LAB_DIR,newRunId} from './runner.mjs';
import {findings,frontierChart} from './report.mjs';

// The dashboard can start runs only on the owner's machine: on Vercel a function times out long before a
// full run ends and /tmp is not durable. Published results are static files in dist/evals and work anywhere.
export const DASHBOARD_MAX_USD=25;
export function createEvalLab({env=process.env,run=runEval,load=loadGolden,labDir=LAB_DIR}={}){
 const enabled=env.DEVELOPER_DASHBOARD==='true'&&!env.VERCEL;let current=null,controller=null;
 const runsDir=path.join(labDir,'runs');
 async function recent(){const ids=(await readdir(runsDir).catch(()=>[])).sort().reverse().slice(0,15);const out=[];for(const id of ids){try{const s=JSON.parse(await readFile(path.join(runsDir,id,'summary.json'),'utf8'));out.push({runId:s.runId,finishedAt:s.finishedAt,mock:!!s.mock,models:s.config.models.length,looks:s.dataset.looks,queries:s.dataset.queries,spentUsd:s.spentUsd});}catch{}}return out;}
 async function summary(runId){if(!/^[0-9]{8}-[0-9]{6}-[a-f0-9]{4}$/.test(runId))return null;try{const s=JSON.parse(await readFile(path.join(runsDir,runId,'summary.json'),'utf8'));return {...s,findings:findings(s)};}catch{return null;}}
 return {
  enabled,
  async status(){return {enabled,running:current,recent:await recent(),tiers:TIERS,models:MODELS.map(m=>({id:m.id,label:m.label,tier:m.tier,provider:m.provider,enabled:m.enabled,price:m.price,keyReady:!PROVIDER_KEYS[m.provider]||!!env[PROVIDER_KEYS[m.provider]]}))};},
  async start(body={}){
   if(!enabled)throw Object.assign(Error('Not found'),{status:404});if(current&&!current.finishedAt)throw Object.assign(Error('A run is already in progress.'),{status:409});
   const maxUsd=Math.min(DASHBOARD_MAX_USD,Math.max(0.05,Number(body.maxUsd)||2));const repeat=Math.min(3,Math.max(1,Math.round(Number(body.repeat)||1)));const limit=Number(body.limit)>0?Math.min(500,Math.round(Number(body.limit))):undefined;
   const tasks=(Array.isArray(body.tasks)?body.tasks:['look','query']).filter(t=>['look','query'].includes(t));if(!tasks.length)throw Object.assign(Error('Pick at least one task.'),{status:400});
   let models;try{models=selectModels(Array.isArray(body.models)&&body.models.length?body.models.join(','):'cheap');}catch(e){throw Object.assign(Error(e.message),{status:400});}
   const missing=models.filter(m=>PROVIDER_KEYS[m.provider]&&!env[PROVIDER_KEYS[m.provider]]);if(missing.length)throw Object.assign(Error('Missing API keys for: '+missing.map(m=>m.label).join(', ')),{status:400});
   const golden=await load();const est=estimate({models,tasks,golden,limit,repeat});if(est.usd>maxUsd)throw Object.assign(Error(`Estimated ${'$'+est.usd.toFixed(2)} is above your $${maxUsd} cap.`),{status:400});
   const runId=newRunId();controller=new AbortController();current={runId,startedAt:new Date().toISOString(),done:0,total:est.calls,spentUsd:0,estimateUsd:est.usd,last:null,error:null,finishedAt:null};
   run({models,tasks,golden,limit,repeat,maxUsd,env,labDir,runId,signal:controller.signal,onProgress:ev=>{if(ev.type==='progress')Object.assign(current,{done:ev.done,total:ev.total,spentUsd:ev.spentUsd,last:ev.last});}})
    .then(s=>Object.assign(current,{finishedAt:new Date().toISOString(),spentUsd:s.spentUsd}),e=>Object.assign(current,{finishedAt:new Date().toISOString(),error:e.message}));
   return {runId,estimateUsd:est.usd,calls:est.calls};
  },
  cancel(){if(!enabled)throw Object.assign(Error('Not found'),{status:404});controller?.abort();return {ok:true};},
  summary,
  async chart(runId,task){const s=await summary(runId);return s?frontierChart(s,task):null;}
 };
}
