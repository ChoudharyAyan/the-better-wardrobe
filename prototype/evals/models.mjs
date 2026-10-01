// Candidate models, grouped into the price tiers from the Discover model study.
// Prices are list USD per 1M tokens as researched on 2026-10-01. `verified:false` marks a price carried over
// from the previous model in that family: check the provider's pricing page before publishing numbers.
// Model ids drift (preview suffixes, renames): run `node evals/cli.mjs preflight` to check every id against
// the provider's live model list before spending anything.
export const TIERS=[
 {id:'local',label:'Free (local)'},
 {id:'very-cheap',label:'Very cheap'},
 {id:'cheap',label:'Cheap'},
 {id:'mid',label:'Mid-range'},
 {id:'mid-high',label:'Mid-high'},
 {id:'expensive',label:'Expensive'},
 {id:'very-expensive',label:'Very expensive'}
];
const m=(id,label,provider,model,tier,input,output,extra={})=>({id,label,provider,model,tier,price:input==null?null:{input,output},verified:true,openWeights:false,enabled:true,options:{},...extra});
export const MODELS=[
 m('ollama-qwen3-vl-2b','Qwen3-VL 2B (local)','ollama','qwen3-vl:2b','local',0,0,{openWeights:true,enabled:false,note:'Needs a local Ollama; enable with --models.'}),

 m('gpt-5-nano','GPT-5 nano','openai','gpt-5-nano','very-cheap',0.05,0.40,{options:{reasoning:'low'}}),
 m('gemini-2.5-flash-lite','Gemini 2.5 Flash-Lite (legacy)','gemini','gemini-2.5-flash-lite','very-cheap',0.10,0.40,{enabled:false,note:'Opt-in: legacy, being retired; 3.1 Flash-Lite replaces it.'}),
 m('qwen3-vl-30b','Qwen3-VL 30B-A3B','openrouter','qwen/qwen3-vl-30b-a3b-instruct','very-cheap',0.13,0.52,{openWeights:true}),
 m('qwen3-vl-235b','Qwen3-VL 235B-A22B','openrouter','qwen/qwen3-vl-235b-a22b-instruct','very-cheap',0.20,0.88,{openWeights:true}),

 m('gpt-5.4-nano','GPT-5.4 nano','openai','gpt-5.4-nano','cheap',0.20,1.25,{options:{reasoning:'low'}}),
 m('gemini-3.1-flash-lite','Gemini 3.1 Flash-Lite','gemini','gemini-3.1-flash-lite','cheap',0.25,1.50,{options:{thinkingLevel:'low'}}),

 m('gemini-3-flash','Gemini 3 Flash','gemini','gemini-3-flash','mid',0.50,3.00,{options:{thinkingLevel:'low'}}),
 m('gpt-5.4-mini','GPT-5.4 mini','openai','gpt-5.4-mini','mid',0.75,4.50,{options:{reasoning:'low'}}),
 m('claude-haiku-4.5','Claude Haiku 4.5','anthropic','claude-haiku-4-5-20251001','mid',1.00,5.00),
 m('gpt-5.6-luna','GPT-5.6 Luna','openai','gpt-5.6-luna','mid',1.00,6.00,{options:{reasoning:'low'}}),

 m('gemini-3.5-flash','Gemini 3.5 Flash','gemini','gemini-3.5-flash','mid-high',1.50,9.00,{options:{thinkingLevel:'low'},note:'Current production model in .env.example.'}),
 m('gemini-3.6-flash','Gemini 3.6 Flash','gemini','gemini-3.6-flash','mid-high',1.50,7.50,{options:{thinkingLevel:'low'}}),

 m('gemini-3.1-pro','Gemini 3.1 Pro','gemini','gemini-3.1-pro','expensive',2.00,12.00,{options:{thinkingLevel:'low'}}),
 m('gpt-5.6-terra','GPT-5.6 Terra','openai','gpt-5.6-terra','expensive',2.50,15.00,{options:{reasoning:'low'}}),
 m('claude-sonnet-5.5','Claude Sonnet 5.5','anthropic','claude-sonnet-5-5','expensive',3.00,15.00,{verified:false}),

 m('gpt-5.5','GPT-5.5','openai','gpt-5.5','very-expensive',5.00,30.00,{enabled:false,options:{reasoning:'low'},note:'Opt-in: same price as GPT-5.6 Sol, one generation older.'}),
 m('gpt-5.6-sol','GPT-5.6 Sol','openai','gpt-5.6-sol','very-expensive',5.00,30.00,{options:{reasoning:'low'}}),
 m('claude-opus-5.5','Claude Opus 5.5','anthropic','claude-opus-5-5','very-expensive',5.00,25.00,{verified:false}),
 m('claude-fable-5.1','Claude Fable 5.1','anthropic','claude-fable-5-1','very-expensive',10.00,50.00,{verified:false,enabled:false,note:'Opt-in: twice the Opus price; add only if Opus and Sol leave headroom.'})
];
export const PROVIDER_KEYS={gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',openrouter:'OPENROUTER_API_KEY',ollama:null,mock:null};

// "cheap,mid" → tiers; "gpt-5-nano,claude-haiku-4.5" → ids; "pareto" or "all" → every enabled model (the 16-model
// study set); "everything" adds the opt-in models too. Mixes are fine.
export function selectModels(spec='all',models=MODELS){
 const parts=String(spec||'all').split(',').map(s=>s.trim()).filter(Boolean);
 const picked=new Map();
 for(const p of parts){
  if(p==='all'||p==='pareto'){for(const x of models)if(x.enabled)picked.set(x.id,x);continue;}
  if(p==='everything'){for(const x of models)picked.set(x.id,x);continue;}
  const tier=models.filter(x=>x.tier===p&&(x.enabled||parts.includes(x.id)));
  if(tier.length){for(const x of tier)picked.set(x.id,x);continue;}
  const one=models.find(x=>x.id===p);if(!one)throw Error(`Unknown model or tier "${p}". Run: node evals/cli.mjs list`);picked.set(one.id,one);
 }
 return [...picked.values()];
}
// Adapters report usage.output as every billed output token, reasoning included; usage.reasoning is the
// informational subset. A provider-reported cost (OpenRouter) wins over the list-price estimate.
export const costOf=(model,usage)=>{if(typeof usage?.costUsd==='number')return usage.costUsd;if(!model.price)return null;return ((usage?.input||0)*model.price.input+(usage?.output||0)*model.price.output)/1e6;};
