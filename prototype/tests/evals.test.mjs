import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {canonicalCategory,categoryCredit,colourCredit,canonicalEnum} from '../evals/taxonomy.mjs';
import {scoreLook,scoreQuery,iou,aggregate} from '../evals/scoring.mjs';
import {callModel,EvalError,parseJson} from '../evals/providers.mjs';
import {MODELS,selectModels,costOf,route} from '../evals/models.mjs';
import {loadGolden} from '../evals/golden.mjs';
import {runEval,estimate} from '../evals/runner.mjs';
import {buildReport,writeReport,frontier} from '../evals/report.mjs';
import {createEvalLab} from '../evals/lab.mjs';
import {lookSchema,querySchema} from '../evals/tasks.mjs';
import {createServer} from '../server.mjs';

const tmp=()=>mkdtemp(path.join(tmpdir(),'tbw-evals-'));
const mock=(id,quality,extra={})=>({id,label:id,provider:'mock',model:id,tier:'cheap',price:{input:1,output:5},verified:true,openWeights:false,enabled:true,options:{quality,...extra}});
const respond=(status,body,headers={})=>({ok:status>=200&&status<300,status,statusText:String(status),headers:{get:k=>headers[k.toLowerCase()]??null},text:async()=>JSON.stringify(body)});
const img={data:Buffer.from([255,216,255]),mimeType:'image/jpeg'};
const base={system:'s',prompt:'p',image:img,schema:lookSchema,schemaName:'look'};

test('taxonomy maps shopper words onto the frozen enums with partial credit for near misses',()=>{
 assert.equal(canonicalCategory('Tee'),'t-shirt');assert.equal(canonicalCategory('Mojari'),'juttis');assert.equal(canonicalCategory('heeled sandals'),'heels');
 assert.equal(canonicalCategory('Penny Loafers'),'loafers');assert.equal(canonicalCategory('white chikankari kurta set'),'kurta');assert.equal(canonicalCategory('spaceship'),'other');
 assert.equal(categoryCredit('loafers','formal shoes'),0.5);assert.equal(categoryCredit('loafers','shirt'),0);
 assert.equal(colourCredit('black','navy'),0.5);assert.equal(colourCredit('cream','off-white'),1);assert.equal(colourCredit('red','green'),0);
 assert.equal(canonicalEnum('pattern','Plaid'),'checked');assert.equal(canonicalEnum('occasion','Haldi'),'festive');assert.equal(canonicalEnum('neckline','Cuban collar'),'camp collar');
});

test('look scoring rewards found items and attributes, penalises misses and extras',()=>{
 const gold={exhaustive:true,items:[{category:'shirt',box:[0,0,500,500],colour:'cream',pattern:'solid',features:['camp collar']},{category:'loafers',box:[0,600,300,900],colour:'brown'}]};
 const perfect={items:[{category:'shirt',box:[0,0,500,500],colour:'cream',pattern:'solid',features:['Camp collar','short sleeves']},{category:'loafers',box:[0,600,300,900],colour:'brown'}]};
 const p=scoreLook(perfect,gold);assert.equal(p.score,1);assert.equal(p.recall,1);assert.equal(p.precision,1);assert.equal(p.iou,1);
 const partial=scoreLook({items:[{label:'ivory camp collar shirt',category:'shirt',box:[0,0,480,520],colour:'white',pattern:'solid',features:[]},{category:'sunglasses',box:[400,400,500,450]}]},gold);
 assert.equal(partial.recall,0.5);assert.equal(partial.precision,0.5);assert.ok(partial.score>0.3&&partial.score<0.5,'shirt partly right, loafers missed');
 assert.equal(partial.fields.features.sum,1,'feature found in the label counts');
 assert.equal(scoreLook({items:[{category:'formal shoes',box:[0,600,300,900],colour:'brown'}]},{exhaustive:false,items:[gold.items[1]]}).score,0.75);
 assert.equal(scoreLook(null,gold).score,0);assert.equal(iou([0,0,10,10],[5,5,15,15]).toFixed(3),'0.143');
});

test('query scoring checks requested filters and punishes invented ones',()=>{
 const gold={query:'black kurta under 1500',expect:{category:'kurta',colour:'black',min_price_inr:null,max_price_inr:1500,department:'unknown'}};
 assert.equal(scoreQuery({category:'kurta',colour:'Black',min_price_inr:null,max_price_inr:1500,department:'unknown'},gold).score,1);
 const invented=scoreQuery({category:'kurta',colour:'black',min_price_inr:500,max_price_inr:1500,department:'menswear'},gold);assert.equal(invented.score,0.6);
});

test('Gemini adapter sends the schema and image, and bills thinking tokens as output',async()=>{
 let seen;const fetcher=async(url,o)=>{seen={url,body:JSON.parse(o.body),headers:o.headers};return respond(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'thinking',thought:true},{text:'{"items":[]}'}]}}],usageMetadata:{promptTokenCount:1200,candidatesTokenCount:300,thoughtsTokenCount:200}});};
 const r=await callModel({...base,model:{provider:'gemini',model:'gemini-3-flash',options:{thinkingLevel:'low'}},env:{GEMINI_API_KEY:'k'},fetcher});
 assert.match(seen.url,/models\/gemini-3-flash:generateContent$/);assert.equal(seen.headers['x-goog-api-key'],'k');assert.ok(seen.body.generationConfig.responseJsonSchema);assert.equal(seen.body.generationConfig.thinkingConfig.thinkingLevel,'low');assert.equal(seen.body.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
 assert.deepEqual(r.json,{items:[]});assert.deepEqual(r.usage,{input:1200,output:500,reasoning:200});
 await assert.rejects(callModel({...base,model:{provider:'gemini',model:'x',options:{}},env:{},fetcher}),e=>e.code==='no_key');
});

test('OpenAI adapter uses strict structured output and retries once without an unsupported reasoning knob',async()=>{
 const bodies=[];const fetcher=async(url,o)=>{const b=JSON.parse(o.body);bodies.push(b);if(b.reasoning)return respond(400,{error:{message:"Unsupported parameter: 'reasoning.effort'"}});return respond(200,{status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'{"items":[{"category":"shirt"}]}'}]}],usage:{input_tokens:900,output_tokens:400,output_tokens_details:{reasoning_tokens:250}}});};
 const r=await callModel({...base,model:{provider:'openai',model:'gpt-5-nano',options:{reasoning:'low'}},env:{OPENAI_API_KEY:'k'},fetcher});
 assert.equal(bodies.length,2);assert.equal(bodies[0].text.format.strict,true);assert.equal(bodies[0].input[0].content[1].type,'input_image');
 assert.equal(r.json.items[0].category,'shirt');assert.deepEqual(r.usage,{input:900,output:400,reasoning:250});assert.match(r.notes[0],/reasoning effort/);
});

test('Anthropic adapter forces a tool call and reads its input; retries transient errors',async()=>{
 let calls=0;const fetcher=async(url,o)=>{calls++;if(calls===1)return respond(529,{error:{message:'overloaded'}},{'retry-after':'0.01'});const b=JSON.parse(o.body);assert.equal(b.tool_choice.name,'record_look');assert.equal(b.messages[0].content[0].type,'image');return respond(200,{stop_reason:'tool_use',content:[{type:'tool_use',name:'record_look',input:{items:[]}}],usage:{input_tokens:1500,output_tokens:200}});};
 const r=await callModel({...base,model:{provider:'anthropic',model:'claude-haiku-4-5-20251001',options:{}},env:{ANTHROPIC_API_KEY:'k'},fetcher});
 assert.equal(calls,2);assert.deepEqual(r.json,{items:[]});assert.equal(r.usage.input,1500);
});

test('OpenRouter adapter falls back to json_object and prefers the provider-reported cost',async()=>{
 const formats=[];const fetcher=async(url,o)=>{const b=JSON.parse(o.body);formats.push(b.response_format.type);if(b.response_format.type==='json_schema')return respond(400,{error:{message:'response_format not supported'}});return respond(200,{choices:[{finish_reason:'stop',message:{content:'```json\n{"category":"kurta"}\n```'}}],usage:{prompt_tokens:300,completion_tokens:50,cost:0.00042}});};
 const model={provider:'openrouter',model:'qwen/qwen3-vl-30b-a3b-instruct',price:{input:0.13,output:0.52},options:{}};
 const r=await callModel({...base,schema:querySchema,schemaName:'query',image:null,model,env:{OPENROUTER_API_KEY:'k'},fetcher});
 assert.deepEqual(formats,['json_schema','json_object']);assert.equal(r.json.category,'kurta');assert.equal(costOf(model,r.usage),0.00042);
 assert.throws(()=>parseJson('no json here'),EvalError);
});

test('model selection understands tiers, ids and opt-in models',()=>{
 assert.ok(selectModels('cheap').every(m=>m.tier==='cheap'));assert.ok(!selectModels('all').some(m=>m.provider==='ollama'));
 assert.equal(selectModels('ollama-qwen3-vl-2b')[0].provider,'ollama');assert.throws(()=>selectModels('nope'),/Unknown model/);
 assert.ok(new Set(MODELS.map(m=>m.id)).size===MODELS.length,'ids are unique');
 const pareto=selectModels('pareto');assert.equal(pareto.length,16);assert.deepEqual(pareto,selectModels('all'));
 for(const id of ['gemini-2.5-flash-lite','gpt-5.5','claude-fable-5.1','ollama-qwen3-vl-2b'])assert.ok(!pareto.some(m=>m.id===id),id+' is opt-in');
 assert.equal(selectModels('everything').length,MODELS.length);
 const pilot=selectModels('pilot');assert.equal(pilot.length,12);assert.ok(pilot.some(m=>m.id==='gemini-3.1-pro')&&!pilot.some(m=>m.id==='claude-opus-5.5'));
 const routed=route(pilot,'openrouter');assert.ok(routed.filter(m=>m.routedFrom).every(m=>m.provider==='openrouter'&&m.model.includes('/')));
 assert.ok(routed.filter(m=>m.id.startsWith('gemini')).every(m=>m.provider==='gemini'),'Gemini stays on its own key');
 assert.equal(routed.find(m=>m.id==='gpt-5.4-mini').options.reasoning,'low');assert.deepEqual(route(pilot,undefined),pilot);
});

test('runner scores mock models end to end, respects the budget cap and writes artefacts',async()=>{
 const labDir=await tmp();
 try{
  const golden=await loadGolden();assert.ok(golden.looks.length>=12&&golden.queries.length>=40);assert.deepEqual(golden.warnings,[]);
  const models=[mock('strong',0.95),mock('weak',0.4,{failRate:0.2})];
  await assert.rejects(runEval({models,golden,maxUsd:0.0001,labDir}),e=>e.code==='budget');
  const progress=[];const s=await runEval({models,golden,limit:12,repeat:2,maxUsd:5,labDir,onProgress:e=>progress.push(e.type)});
  assert.equal(s.mock,true);assert.equal(progress.at(-1),'done');
  const look=s.rows.filter(r=>r.task==='look').sort((a,b)=>b.score-a.score);assert.equal(look[0].modelId,'strong');assert.ok(look[1].okRate<1);assert.equal(look[0].repeats,2);
  assert.ok(look[0].costPer1k>0&&look[0].latencyP50>=0);assert.ok(s.rows.some(r=>r.task==='query'));
  const lines=(await readFile(path.join(labDir,'runs',s.runId,'items.jsonl'),'utf8')).trim().split('\n');assert.equal(lines.length,(12+12)*2*2);
  assert.ok(s.hardest.look.length>0);
 }finally{await rm(labDir,{recursive:true,force:true});}
});

test('runner caches real provider answers so re-runs cost nothing',async()=>{
 const labDir=await tmp();let calls=0;
 const fetcher=async()=>{calls++;return respond(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"category":"kurta","department":"menswear","colour":"black","pattern":"","occasion":"","ethnic":true,"min_price_inr":null,"max_price_inr":1500,"size":"","brand":"","keywords":[],"language":"english"}'}]}}],usageMetadata:{promptTokenCount:500,candidatesTokenCount:80}});};
 try{
  const golden=await loadGolden();const model={...MODELS.find(m=>m.id==='gemini-3-flash')};const opts={models:[model],tasks:['query'],golden,limit:3,maxUsd:1,labDir,env:{GEMINI_API_KEY:'k'},fetcher};
  const first=await runEval(opts);assert.equal(calls,3);assert.ok(first.spentUsd>0);
  const second=await runEval(opts);assert.equal(calls,3,'served from cache');assert.equal(second.spentUsd,0);assert.equal(second.rows[0].costPer1k,first.rows[0].costPer1k,'cached rows keep the real per-call cost');
  assert.equal(first.rows[0].score>0.5,true);
 }finally{await rm(labDir,{recursive:true,force:true});}
});

test('estimate counts calls and prices every selected model',async()=>{
 const golden=await loadGolden();const e=estimate({models:selectModels('cheap'),tasks:['look','query'],golden,limit:10});
 assert.equal(e.calls,2*20);assert.ok(e.usd>0&&e.usd<1);
});

test('report writes findings, a watermark for simulated data, charts and a LinkedIn draft',async()=>{
 const labDir=await tmp();
 try{
  const golden=await loadGolden();const s=await runEval({models:[mock('alpha',0.9),{...mock('beta',0.6),price:{input:5,output:25}},{...mock('gamma',0.75),openWeights:true,price:{input:0.1,output:0.4}}],golden,labDir,maxUsd:5});
  const r=buildReport(s);assert.match(r.markdown,/SIMULATED DATA/);assert.match(r.linkedin,/DO NOT POST/);assert.match(r.markdown,/Leaderboard: screenshot understanding/);
  assert.ok(r.charts['frontier-look'].startsWith('<svg'));assert.ok(frontier(s.rows.filter(x=>x.task==='look')).length>=1);
  const out=await writeReport(s,path.join(labDir,'report'));assert.ok(out.files.includes('charts/frontier-look.png'));
  const png=await readFile(path.join(labDir,'report','charts','frontier-look.png'));assert.equal(png.subarray(1,4).toString(),'PNG');
 }finally{await rm(labDir,{recursive:true,force:true});}
});

test('model lab endpoints are local-only, same-origin, and refuse runs without keys or over the cap',async()=>{
 const labDir=await tmp();let started=null;
 const lab=createEvalLab({env:{DEVELOPER_DASHBOARD:'true'},labDir,run:async o=>{started=o;return {spentUsd:0};}});
 const server=createServer({status:()=>({developerDashboard:true})},undefined,undefined,undefined,lab);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=(p,body,headers={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const st=await(await fetch(base+'/api/developer/evals/status')).json();assert.equal(st.enabled,true);assert.ok(st.models.length>10);
  const noKey=await post('/api/developer/evals/run',{models:['cheap']});assert.equal(noKey.status,400);assert.match((await noKey.json()).error,/Missing API keys/);
  assert.equal((await post('/api/developer/evals/run',{},{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await fetch(base+'/api/developer/evals/runs/../../etc')).status,404);
  assert.equal((await fetch(base+'/api/developer/evals/runs/20260101-000000-abcd')).status,404);
  const vercel=createEvalLab({env:{DEVELOPER_DASHBOARD:'true',VERCEL:'1'}});assert.equal(vercel.enabled,false);
  const off=createServer({status:()=>({developerDashboard:false})},undefined,undefined,undefined,createEvalLab({env:{}}));await new Promise(r=>off.listen(0,'127.0.0.1',r));
  try{assert.equal((await fetch('http://127.0.0.1:'+off.address().port+'/api/developer/evals/status')).status,404);}finally{await new Promise(r=>off.close(r));}
  const keyed=createEvalLab({env:{DEVELOPER_DASHBOARD:'true',GEMINI_API_KEY:'k',OPENAI_API_KEY:'k'},labDir,run:async o=>{started=o;return {spentUsd:0};}});
  await assert.rejects(keyed.start({models:['gpt-5.5','gpt-5.6-sol'],maxUsd:0.05}),/above your/);
  const ok=await keyed.start({models:['cheap'],tasks:['query'],limit:2,maxUsd:99});assert.match(ok.runId,/^\d{8}-\d{6}-[a-f0-9]{4}$/);assert.equal(started.maxUsd,25,'dashboard cap is clamped');assert.equal(started.limit,2);
 }finally{await new Promise(r=>server.close(r));await rm(labDir,{recursive:true,force:true});}
});

test('aggregate counts failures as zero and reports errors by kind',()=>{
 const row=aggregate([{modelId:'m',label:'m',task:'look',repeat:0,ok:true,score:1,costUsd:0.002,latencyMs:100,usage:{input:1,output:1},tags:['a']},{modelId:'m',label:'m',task:'look',repeat:0,ok:false,error:{code:'invalid_json'},tags:['a']}])[0];
 assert.equal(row.score,0.5);assert.equal(row.errors.invalid_json,1);assert.equal(row.okRate,0.5);assert.equal(row.slices.a.score,0.5);assert.equal(row.costPer1k,2);
});
