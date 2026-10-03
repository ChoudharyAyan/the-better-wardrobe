import {createHash} from 'node:crypto';
import {PROVIDER_KEYS} from './models.mjs';
import {CATEGORIES,COLOURS,PATTERNS,OCCASIONS} from './taxonomy.mjs';

// One call signature for every provider:
//   call({model, system, prompt, image:{data:Buffer,mimeType}|null, schema, schemaName, env, fetcher, signal, timeoutMs, gold, seed})
//   → {json, usage:{input, output, reasoning, costUsd?}, notes:[]}
// usage.output counts every billed output token (reasoning included). Errors throw EvalError with a short code.
export class EvalError extends Error{constructor(code,message,status){super(message);this.code=code;this.status=status;}}

const RETRY=[429,500,502,503,504,529];
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new EvalError('aborted','Run cancelled'));},{once:true});});
async function post(fetcher,url,headers,body,{signal,timeoutMs=90000,attempts=3}={}){
 let last;
 for(let attempt=0;attempt<attempts;attempt++){
  let res;
  try{res=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});}
  catch(e){if(signal?.aborted)throw new EvalError('aborted','Run cancelled');last=new EvalError('timeout',e.name==='TimeoutError'?'Timed out':'Network error: '+e.message);if(attempt<attempts-1){await sleep(1500*(attempt+1),signal);continue;}throw last;}
  const text=await res.text();let data;try{data=JSON.parse(text);}catch{data={raw:text.slice(0,500)};}
  if(res.ok)return data;
  const message=String(data?.error?.message||data?.error||data?.raw||res.statusText).slice(0,300);
  last=new EvalError(res.status===429?'rate_limited':res.status>=500?'provider_error':'bad_request',`${res.status}: ${message}`,res.status);
  if(!RETRY.includes(res.status)||attempt===attempts-1)throw last;
  const after=Number(res.headers.get?.('retry-after'));await sleep(Number.isFinite(after)&&after>0?Math.min(after,30)*1000:[1500,5000,12000][attempt],signal);
 }
 throw last;
}
async function get(fetcher,url,headers){const res=await fetcher(url,{headers,signal:AbortSignal.timeout(20000)});if(!res.ok)throw new EvalError('bad_request',`${res.status} listing models`,res.status);return res.json();}
export function parseJson(text){
 if(text&&typeof text==='object')return text;
 const t=String(text??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t);}catch{}
 const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1));}catch{}}
 throw new EvalError('invalid_json','Model output was not valid JSON');
}
const dataUrl=img=>`data:${img.mimeType};base64,${img.data.toString('base64')}`;
const key=(env,provider)=>{const name=PROVIDER_KEYS[provider];if(!name)return '';const v=env[name];if(!v)throw new EvalError('no_key',`${name} is not set`);return v;};
// Some ids reject an optional knob (a thinking level, a reasoning effort). Retry once without it and say so.
const optionRejected=e=>e instanceof EvalError&&e.status===400&&/think|reason|effort|budget|unsupported|unknown (field|parameter)|invalid.*(field|param)/i.test(e.message);

async function gemini(a){
 const k=key(a.env,'gemini');const parts=[{text:a.prompt}];if(a.image)parts.push({inlineData:{mimeType:a.image.mimeType,data:a.image.data.toString('base64')}});
 const build=withOption=>({systemInstruction:{parts:[{text:a.system}]},contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseJsonSchema:a.schema,maxOutputTokens:8192,...(withOption&&a.model.options?.thinkingLevel?{thinkingConfig:{thinkingLevel:a.model.options.thinkingLevel}}:{})}});
 const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(a.model.model)+':generateContent';const notes=[];
 let d;try{d=await post(a.fetcher,url,{'x-goog-api-key':k},build(true),a);}catch(e){if(!optionRejected(e)||!a.model.options?.thinkingLevel)throw e;notes.push('thinkingLevel not accepted; ran with provider default');d=await post(a.fetcher,url,{'x-goog-api-key':k},build(false),a);}
 const c=d.candidates?.[0];if(!c)throw new EvalError('refused',d.promptFeedback?.blockReason?'Blocked: '+d.promptFeedback.blockReason:'No candidate returned');
 if(c.finishReason&&c.finishReason!=='STOP')throw new EvalError('incomplete','Finish reason '+c.finishReason);
 const text=(c.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
 const u=d.usageMetadata||{};const thoughts=u.thoughtsTokenCount||0;
 return {json:parseJson(text),usage:{input:u.promptTokenCount||0,output:(u.candidatesTokenCount||0)+thoughts,reasoning:thoughts},notes};
}
async function openai(a){
 const k=key(a.env,'openai');const content=[{type:'input_text',text:a.prompt}];if(a.image)content.push({type:'input_image',image_url:dataUrl(a.image),detail:'high'});
 const build=withOption=>({model:a.model.model,instructions:a.system,input:[{role:'user',content}],text:{format:{type:'json_schema',name:a.schemaName,schema:a.schema,strict:true}},max_output_tokens:8000,store:false,...(withOption&&a.model.options?.reasoning?{reasoning:{effort:a.model.options.reasoning}}:{})});
 const url='https://api.openai.com/v1/responses',h={Authorization:'Bearer '+k};const notes=[];
 let d;try{d=await post(a.fetcher,url,h,build(true),a);}catch(e){if(!optionRejected(e)||!a.model.options?.reasoning)throw e;notes.push('reasoning effort not accepted; ran with provider default');d=await post(a.fetcher,url,h,build(false),a);}
 if(d.status&&d.status!=='completed')throw new EvalError('incomplete','Response status '+d.status+(d.incomplete_details?.reason?' ('+d.incomplete_details.reason+')':''));
 const parts=(d.output||[]).filter(o=>o.type==='message').flatMap(o=>o.content||[]);
 if(parts.some(p=>p.type==='refusal'))throw new EvalError('refused','Model refused');
 const text=typeof d.output_text==='string'&&d.output_text?d.output_text:parts.filter(p=>p.type==='output_text').map(p=>p.text).join('');
 const u=d.usage||{};return {json:parseJson(text),usage:{input:u.input_tokens||0,output:u.output_tokens||0,reasoning:u.output_tokens_details?.reasoning_tokens||0},notes};
}
async function anthropic(a){
 const k=key(a.env,'anthropic');const content=[];if(a.image)content.push({type:'image',source:{type:'base64',media_type:a.image.mimeType,data:a.image.data.toString('base64')}});content.push({type:'text',text:a.prompt});
 // Forcing a single tool call is the most portable way to get schema-shaped JSON from every Claude model.
 const url='https://api.anthropic.com/v1/messages',h={'x-api-key':k,'anthropic-version':'2023-06-01'},notes=[];
 const body={model:a.model.model,max_tokens:8000,temperature:0,system:a.system,messages:[{role:'user',content}],tools:[{name:'record_'+a.schemaName,description:'Record the structured result.',input_schema:a.schema}],tool_choice:{type:'tool',name:'record_'+a.schemaName}};
 let d;try{d=await post(a.fetcher,url,h,body,a);}catch(e){if(!(e instanceof EvalError&&e.status===400&&/temperature/i.test(e.message)))throw e;notes.push('temperature not accepted; ran with provider default');const {temperature,...rest}=body;d=await post(a.fetcher,url,h,rest,a);}
 const tool=(d.content||[]).find(c=>c.type==='tool_use');if(!tool)throw new EvalError(d.stop_reason==='refusal'?'refused':'invalid_json','No structured result returned');
 if(d.stop_reason==='max_tokens')throw new EvalError('incomplete','Hit max_tokens');
 const u=d.usage||{};return {json:tool.input,usage:{input:(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0),output:u.output_tokens||0,reasoning:0},notes};
}
async function openrouter(a){
 const k=key(a.env,'openrouter');const content=[{type:'text',text:a.prompt}];if(a.image)content.push({type:'image_url',image_url:{url:dataUrl(a.image)}});
 const base={model:a.model.model,temperature:0,max_tokens:8000,usage:{include:true},...(a.model.options?.reasoning?{reasoning:{effort:a.model.options.reasoning}}:{}),messages:[{role:'system',content:a.system},{role:'user',content}]};
 const url='https://openrouter.ai/api/v1/chat/completions',h={Authorization:'Bearer '+k,'X-Title':'The Better Wardrobe model lab'};const notes=[];
 let d;try{d=await post(a.fetcher,url,h,{...base,response_format:{type:'json_schema',json_schema:{name:a.schemaName,strict:true,schema:a.schema}}},a);}
 catch(e){if(!(e instanceof EvalError&&e.status===400))throw e;notes.push('json_schema not supported by the routed provider; used json_object with the schema in the prompt');
  d=await post(a.fetcher,url,h,{...base,response_format:{type:'json_object'},messages:[base.messages[0],{role:'user',content:[{type:'text',text:a.prompt+'\nReply with JSON only, matching this JSON Schema exactly:\n'+JSON.stringify(a.schema)},...content.slice(1)]}]},a);}
 const choice=d.choices?.[0];if(!choice)throw new EvalError('provider_error',d.error?.message||'No choice returned');
 if(choice.finish_reason==='length')throw new EvalError('incomplete','Hit max_tokens');
 const u=d.usage||{};return {json:parseJson(choice.message?.content),usage:{input:u.prompt_tokens||0,output:u.completion_tokens||0,reasoning:u.completion_tokens_details?.reasoning_tokens||0,...(typeof u.cost==='number'?{costUsd:u.cost}:{})},notes};
}
async function ollama(a){
 const base=(a.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
 const d=await post(a.fetcher,base+'/api/chat',{},{model:a.model.model,stream:false,format:a.schema,options:{temperature:0},messages:[{role:'system',content:a.system},{role:'user',content:a.prompt,images:a.image?[a.image.data.toString('base64')]:[]}]},{...a,timeoutMs:Math.max(a.timeoutMs||0,240000),attempts:1});
 return {json:parseJson(d.message?.content),usage:{input:d.prompt_eval_count||0,output:d.eval_count||0,reasoning:0},notes:[]};
}

// Deterministic fake model for tests and for previewing a report layout without spending anything.
// Its numbers mean nothing; reports built from it are watermarked.
function rng(seed){let h=createHash('sha256').update(String(seed)).digest();let i=0;return ()=>{if(i>=28){h=createHash('sha256').update(h).digest();i=0;}const v=h.readUInt32LE(i)/2**32;i+=4;return v;};}
async function mock(a){
 const q=a.model.options?.quality??0.7,r=rng(a.seed);const pick=list=>list[Math.floor(r()*list.length)];const keep=(v,list)=>r()<q?v:pick(list);
 await sleep(Math.round(5+r()*20),a.signal);
 if(a.model.options?.failRate&&r()<a.model.options.failRate)throw new EvalError('invalid_json','Mock failure');
 let json;
 if(a.schemaName==='look'){
  const items=(a.gold?.items||[]).filter(()=>r()<0.55+q*0.45).map(g=>({label:g.label||g.category,category:keep(g.category,CATEGORIES),box:(g.box||[100,100,900,900]).map(v=>Math.max(0,Math.min(1000,v+(r()-0.5)*(1-q)*300))),department:keep(g.department||'unknown',['menswear','womenswear','unisex']),colour:keep(g.colour||'unknown',COLOURS),secondary_colour:'unknown',pattern:keep(g.pattern||'unknown',PATTERNS),sleeve:g.sleeve||'unknown',fit:g.fit||'unknown',length:g.length||'unknown',neckline:keep(g.neckline||'unknown',['crew','shirt collar','unknown']),fabric:keep(g.fabric||'unknown',['cotton','polyester','unknown']),occasion:keep(g.occasion||'unknown',OCCASIONS),ethnic:!!g.ethnic,features:(g.features||[]).filter(()=>r()<q),search_query:[g.colour,...(g.search_terms||[g.label||g.category])].filter(()=>r()<q+0.1).join(' '),brand_visible:g.brand_visible||'',confidence:Math.min(1,q*(0.65+0.6*r()))}));
  if(r()>q)items.push({label:'extra item',category:pick(CATEGORIES),box:[0,0,100,100],department:'unknown',colour:'unknown',secondary_colour:'unknown',pattern:'unknown',sleeve:'unknown',fit:'unknown',length:'unknown',neckline:'unknown',fabric:'unknown',occasion:'unknown',ethnic:false,features:[],search_query:'',brand_visible:'',confidence:0.2});
  json={scene:a.gold?.scene||'other',caption_text:'',items,known_item:{is_specific:false,guess:''}};
 }else{
  const g=a.gold?.expect||{};json={category:keep(g.category??'',['',...CATEGORIES]),department:keep(g.department??'unknown',['menswear','womenswear','unknown']),colour:keep(g.colour??'',['',...COLOURS]),pattern:g.pattern??'',occasion:keep(g.occasion??'',['',...OCCASIONS]),ethnic:r()<q?!!g.ethnic:!g.ethnic,min_price_inr:g.min_price_inr??null,max_price_inr:r()<q?(g.max_price_inr??null):null,size:g.size??'',brand:g.brand??'',keywords:[],language:keep(g.language??'english',['english','hinglish'])};
 }
 const input=a.image?2400:850,output=a.schemaName==='look'?650:120;
 return {json,usage:{input,output,reasoning:0},notes:[]};
}

export const PROVIDERS={gemini,openai,anthropic,openrouter,ollama,mock};
export async function callModel(args){const fn=PROVIDERS[args.model.provider];if(!fn)throw new EvalError('bad_request','Unknown provider '+args.model.provider);return fn(args);}

// Live model lists, used by preflight to catch renamed or preview-suffixed ids before any paid call.
export async function listModels(provider,env,fetcher=fetch){
 if(provider==='gemini'){const ids=[];let token='';do{const d=await get(fetcher,'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'+(token?'&pageToken='+token:''),{'x-goog-api-key':key(env,'gemini')});ids.push(...(d.models||[]).map(x=>x.name.replace(/^models\//,'')));token=d.nextPageToken||'';}while(token);return ids;}
 if(provider==='openai')return ((await get(fetcher,'https://api.openai.com/v1/models',{Authorization:'Bearer '+key(env,'openai')})).data||[]).map(x=>x.id);
 if(provider==='anthropic')return ((await get(fetcher,'https://api.anthropic.com/v1/models?limit=1000',{'x-api-key':key(env,'anthropic'),'anthropic-version':'2023-06-01'})).data||[]).map(x=>x.id);
 if(provider==='openrouter')return ((await get(fetcher,'https://openrouter.ai/api/v1/models',{})).data||[]).map(x=>x.id);
 if(provider==='ollama')return ((await get(fetcher,(env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'')+'/api/tags',{})).models||[]).map(x=>x.name);
 return [];
}
