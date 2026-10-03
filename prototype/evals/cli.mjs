#!/usr/bin/env node
// Model lab CLI. Run from prototype/:  node evals/cli.mjs <command> [--flags]
//   list                              every model, tier, price and whether its API key is set
//   preflight [--models all]          checks each model id against the provider's live model list (free)
//   estimate  [--models ..] [--tasks look,query] [--limit N] [--repeat N]
//   run       [--models ..] [--tasks ..] [--limit N] [--repeat N] [--max-usd 5] [--max-dim 1024] [--no-cache] [--yes]
//   report    <runId|latest> [--out dir]       writes report.md, linkedin.txt and PNG charts
//   publish   <runId|latest>                    copies the summary into evals/results and dist/evals for the dashboard
//   --via openrouter                  run the OpenAI and Claude models through one OpenRouter balance (Gemini stays native)
//   prelabel  --dir <images> [--models gemini-3.1-pro,claude-opus-5.5] [--max-usd 2]   drafts labels for review
import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {MODELS,TIERS,PROVIDER_KEYS,selectModels,costOf,route} from './models.mjs';
import {listModels,callModel} from './providers.mjs';
import {loadGolden,prepareImage,PROTOTYPE_DIR,EVALS_DIR} from './golden.mjs';
import {runEval,estimate,LAB_DIR} from './runner.mjs';
import {writeReport,pct,usd,findings,frontierChart} from './report.mjs';
import {TASKS,SYSTEM} from './tasks.mjs';

try{process.loadEnvFile(path.join(PROTOTYPE_DIR,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const [cmd,...rest]=process.argv.slice(2);const args={_:[]};
for(let i=0;i<rest.length;i++){const a=rest[i];if(a.startsWith('--')){const k=a.slice(2);const v=rest[i+1]&&!rest[i+1].startsWith('--')?rest[++i]:true;args[k]=v;}else args._.push(a);}
const num=(v,d)=>v===undefined||v===true?d:Number(v);
const log=(...x)=>console.log(...x);
const pad=(s,n)=>String(s).padEnd(n);

async function latestRun(){const dir=path.join(LAB_DIR,'runs');const runs=(await readdir(dir).catch(()=>[])).sort();if(!runs.length)throw Error('No runs yet. Try: node evals/cli.mjs run --models cheap --limit 5');return runs.at(-1);}
async function readSummary(id){const runId=!id||id==='latest'?await latestRun():id;return JSON.parse(await readFile(path.join(LAB_DIR,'runs',runId,'summary.json'),'utf8'));}

async function list(){
 for(const t of TIERS){const ms=MODELS.filter(m=>m.tier===t.id);if(!ms.length)continue;log(`\n${t.label}`);
  for(const m of ms){const k=PROVIDER_KEYS[m.provider];const ready=!k||process.env[k]?'key ok ':'no key ';const per1k=costOf(m,TASKS.look.estimate);log(`  ${pad(m.id,24)} ${pad(m.provider,10)} ${ready} ${m.price?`$${m.price.input}/$${m.price.output} per 1M`:'provider-reported'}${m.verified?'':' (price unverified)'}  ≈${usd(per1k*1000)}/1k images${m.enabled?'':'  [opt-in]'}`);}}
 log('\nSelect with --models using tiers (cheap,mid), ids, or "all".');
}
async function preflight(){
 const models=route(selectModels(args.models||'all'),args.via);const byProvider=Object.groupBy(models,m=>m.provider);let bad=0;
 for(const [provider,ms] of Object.entries(byProvider)){
  let ids;try{ids=await listModels(provider,process.env);}catch(e){log(`✗ ${provider}: ${e.message}`);bad+=ms.length;continue;}
  for(const m of ms){if(ids.includes(m.model)){log(`✓ ${provider} ${m.model}`);continue;}bad++;const near=ids.filter(id=>id.startsWith(m.model)||m.model.startsWith(id.replace(/-preview.*$/,''))||id.includes(m.model.replace(/^.*\//,''))).slice(0,4);log(`✗ ${provider} ${m.model} not found${near.length?` — did you mean: ${near.join(', ')}? (edit evals/models.mjs)`:''}`);}
 }
 log(bad?`\n${bad} model id(s) need attention before a run.`:'\nAll model ids resolved.');process.exitCode=bad?1:0;
}
function plan(){
 return {models:route(selectModels(args.models||'all'),args.via),tasks:String(args.tasks||'look,query').split(','),limit:num(args.limit,undefined),repeat:num(args.repeat,1)};
}
async function showEstimate(){
 const p=plan();const golden=await loadGolden({includeDrafts:!!args['include-drafts']});const e=estimate({...p,golden});
 log(`${p.models.length} models × ${golden.looks.length} images / ${golden.queries.length} queries${p.limit?` (limit ${p.limit})`:''} × ${p.repeat} repeat → ${e.calls} calls`);
 for(const [id,v] of Object.entries(e.perModel).sort((a,b)=>b[1]-a[1]))log(`  ${pad(id,24)} ≈ ${usd(v)}`);
 if(e.unpriced.length)log(`  no list price (cost read from provider): ${e.unpriced.join(', ')}`);
 log(`Estimated total ≈ ${usd(e.usd)} (cached calls are free).`);for(const w of golden.warnings)log('! '+w);return e;
}
async function run(){
 const p=plan();const golden=await loadGolden({includeDrafts:!!args['include-drafts']});const e=await showEstimate();
 const maxUsd=num(args['max-usd'],5);if(e.usd>maxUsd){log(`\nAbove the $${maxUsd} cap. Re-run with --max-usd ${Math.ceil(e.usd*1.2)} if that is intended.`);process.exitCode=1;return;}
 if(!args.yes&&e.usd>1&&process.stdin.isTTY){process.stdout.write(`\nSpend up to ${usd(Math.min(maxUsd,e.usd*1.5))}? [y/N] `);const answer=await new Promise(r=>process.stdin.once('data',d=>r(String(d).trim().toLowerCase())));process.stdin.pause();if(answer!=='y'){log('Cancelled.');return;}}
 const controller=new AbortController();process.on('SIGINT',()=>{log('\nStopping after in-flight calls…');controller.abort();});
 let lastPct=-1;const summary=await runEval({...p,golden,maxUsd,maxDim:num(args['max-dim'],1024),concurrency:num(args.concurrency,3),useCache:!args['no-cache'],signal:controller.signal,onProgress:ev=>{if(ev.type==='progress'){const pc=Math.floor(ev.done/ev.total*100);if(pc!==lastPct||!ev.last.ok){lastPct=pc;process.stdout.write(`\r${pc}% · ${ev.done}/${ev.total} · spent ${usd(ev.spentUsd)}${ev.last.ok?'':` · ${ev.last.model} ${ev.last.error}`}        `);}}}});
 log(`\n\nRun ${summary.runId} · spent ${usd(summary.spentUsd)}${summary.stoppedEarly?' · stopped early':''}`);
 for(const task of p.tasks){const rows=summary.rows.filter(r=>r.task===task).sort((a,b)=>b.score-a.score);if(!rows.length)continue;log(`\n${TASKS[task].label}`);for(const r of rows)log(`  ${pad(r.label,28)} ${pad(pct(r.score),7)} ${task==='look'?`found ${pad(pct(r.recall),7)}`:''} fail ${pad(pct(1-r.okRate,0),5)} ${pad(usd(r.costPer1k)+'/1k',10)} p50 ${r.latencyP50??'—'}ms`);}
 log(`\nNext: node evals/cli.mjs report ${summary.runId}   then   node evals/cli.mjs publish ${summary.runId}`);
}
async function report(){const s=await readSummary(args._[0]);const out=args.out||path.join(LAB_DIR,'reports',s.runId);const r=await writeReport(s,out);log(`Report written to ${r.dir}\n  ${r.files.join('\n  ')}`);if(s.mock)log('\n! Built from the mock provider: watermarked, not for publishing.');}
async function publish(){
 const s=await readSummary(args._[0]);if(s.mock&&!args['allow-mock']){log('Refusing to publish a mock run (use --allow-mock for a layout preview).');process.exitCode=1;return;}
 const slim={...s,findings:findings(s),failures:undefined};const resultsDir=path.join(EVALS_DIR,'results'),distDir=path.join(PROTOTYPE_DIR,'dist','evals');await mkdir(resultsDir,{recursive:true});await mkdir(distDir,{recursive:true});
 await writeFile(path.join(resultsDir,s.runId+'.json'),JSON.stringify(slim,null,1));await writeFile(path.join(distDir,s.runId+'.json'),JSON.stringify(slim));
 const files=(await readdir(resultsDir)).filter(f=>f.endsWith('.json'));const index=[];
 for(const f of files){const x=JSON.parse(await readFile(path.join(resultsDir,f),'utf8'));index.push({runId:x.runId,finishedAt:x.finishedAt,mock:!!x.mock,models:x.config.models.length,looks:x.dataset.looks,queries:x.dataset.queries,spentUsd:x.spentUsd});await copyFile(path.join(resultsDir,f),path.join(distDir,f));for(const t of ['look','query'])if(x.rows.some(r=>r.task===t))await writeFile(path.join(distDir,`${x.runId}-frontier-${t}.svg`),frontierChart(x,t));}
 index.sort((a,b)=>String(b.finishedAt).localeCompare(String(a.finishedAt)));await writeFile(path.join(distDir,'index.json'),JSON.stringify({runs:index}));
 log(`Published ${s.runId}. Commit evals/results and dist/evals; the Developer tab's Model lab reads dist/evals/index.json.\nNote: dist/ is public on Vercel, so these aggregate numbers (no images) become public too.`);
}
// Drafts labels with strong models so a human only corrects them. Fields where the models disagree are listed
// first in `review`, which is where a labeller's attention pays off. Drafts are ignored by runs until verified.
async function prelabel(){
 if(!args.dir)throw Error('Pass --dir with the folder of screenshots to label.');
 const dir=path.resolve(args.dir);const files=(await readdir(dir)).filter(f=>/\.(jpe?g|png|webp)$/i.test(f)).slice(0,num(args.limit,500));
 const models=selectModels(args.models||'gemini-3.1-pro,claude-opus-5.5');const per=models.reduce((s,m)=>s+(costOf(m,TASKS.look.estimate)||0),0)*files.length;const maxUsd=num(args['max-usd'],2);
 log(`${files.length} images × ${models.length} models ≈ ${usd(per)}`);if(per>maxUsd){log(`Above the $${maxUsd} cap; raise --max-usd.`);process.exitCode=1;return;}
 const out=args.out||path.join(PROTOTYPE_DIR,'.local-data','evals','golden','drafts.json');await mkdir(path.dirname(out),{recursive:true});
 let existing={images:[]};try{existing=JSON.parse(await readFile(out,'utf8'));}catch{}const done=new Set(existing.images.map(i=>i.file));const images=[...existing.images];
 for(const [i,f] of files.entries()){
  const rel=path.relative(path.dirname(out),path.join(dir,f));if(done.has(rel))continue;const img=await prepareImage(path.join(dir,f),num(args['max-dim'],1024));const outputs=[];
  for(const m of models){try{outputs.push({model:m.id,...(await callModel({model:m,system:SYSTEM,prompt:TASKS.look.prompt(),image:img,schema:TASKS.look.schema,schemaName:'look',env:process.env,fetcher:fetch}))});}catch(e){outputs.push({model:m.id,error:e.message});}}
  const first=outputs.find(o=>o.json);const review=[];
  if(first&&outputs.filter(o=>o.json).length>1){const other=outputs.filter(o=>o.json)[1].json;first.json.items.forEach((it,k)=>{const o=other.items?.[k];if(!o)return review.push(`item ${k+1}: only ${first.model} saw "${it.label}"`);for(const fld of ['category','colour','pattern','department','sleeve','neckline'])if(String(it[fld])!==String(o[fld]))review.push(`item ${k+1} ${fld}: ${it[fld]} vs ${o[fld]}`);});}
  images.push({id:path.parse(f).name,file:rel,status:'draft',labeledBy:'draft:'+outputs.map(o=>o.model).join('+'),tags:[],scene:first?.json.scene||'other',exhaustive:false,review,items:(first?.json.items||[]).map(({confidence,secondary_colour,...it})=>it)});
  await writeFile(out,JSON.stringify({version:1,description:'Model-drafted labels. Fix each item, add tags, set exhaustive, then change status to "verified".',images},null,1));
  log(`${i+1}/${files.length} ${f}${review.length?` · ${review.length} disagreements`:''}`);
 }
 log(`\nDrafts in ${out}. Review them: delete wrong items, fix fields, remove anything you are unsure of (unscored), then set "status":"verified".`);
}

const commands={list,preflight,estimate:showEstimate,run,report,publish,prelabel};
if(!commands[cmd]){log(`Usage: node evals/cli.mjs <${Object.keys(commands).join('|')}> [--flags]\nSee the header of evals/cli.mjs or evals/README.md.`);process.exitCode=cmd?1:0;}
else commands[cmd]().catch(e=>{console.error('\n'+(e.message||e));process.exitCode=1;});
