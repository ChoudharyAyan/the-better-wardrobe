import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError,MODELS,modelKey} from './discovery.mjs';

// Discover search credits. Every guest gets a fixed allowance; each search costs the chosen model's
// credits (120 = 8 Gemini 3 Flash or 15 GPT-5 nano searches). Two backstops keep a shared preview inside
// budget even if someone clears cookies: a per-IP daily allowance and a daily total across all guests.
// Credits are charged before the model call and refunded if it fails, so errors never cost the user.

const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const day=now=>new Date(now()).toISOString().slice(0,10);

// Counters with a ceiling: add() succeeds only if the new total stays within the limit.
function memoryStore(){
 const used=new Map();
 return {
  async add(key,amount,limit){const next=(used.get(key)||0)+amount;if(next>limit)return null;used.set(key,next);return next;},
  async sub(key,amount){used.set(key,Math.max(0,(used.get(key)||0)-amount));},
  async get(key){return used.get(key)||0;}
 };
}
function fileStore(file){
 let pending=Promise.resolve();
 const tx=fn=>{const task=pending.then(async()=>{let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;data={};}const result=fn(data);await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomBytes(6).toString('hex')}.tmp`;await writeFile(temp,JSON.stringify(data));await rename(temp,file);return result;});pending=task.catch(()=>{});return task;};
 return {
  add:(key,amount,limit)=>tx(d=>{const next=(d[key]||0)+amount;if(next>limit)return null;d[key]=next;return next;}),
  sub:(key,amount)=>tx(d=>{d[key]=Math.max(0,(d[key]||0)-amount);}),
  get:key=>tx(d=>d[key]||0)
 };
}
function postgresStore(connection){
 let pool,ready;
 const db=async()=>{if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:3,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}ready??=pool.query('CREATE TABLE IF NOT EXISTS tbw_discover_usage (key text PRIMARY KEY, used integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())');await ready;return pool;};
 return {
  // One atomic statement: the row is created or incremented only while the total stays within the limit.
  // Casts are required: in INSERT … SELECT, Postgres cannot infer $2 from the target column and rejects it
  // ("inconsistent types deduced for parameter $2").
  async add(key,amount,limit){const r=await (await db()).query('INSERT INTO tbw_discover_usage (key,used) SELECT $1::text,$2::integer WHERE $2::integer<=$3::integer ON CONFLICT (key) DO UPDATE SET used=tbw_discover_usage.used+EXCLUDED.used, updated_at=now() WHERE tbw_discover_usage.used+EXCLUDED.used<=$3::integer RETURNING used',[key,amount,limit]);return r.rows[0]?.used??null;},
  async sub(key,amount){await (await db()).query('UPDATE tbw_discover_usage SET used=GREATEST(0,used-$2), updated_at=now() WHERE key=$1',[key,amount]);},
  async get(key){const r=await (await db()).query('SELECT used FROM tbw_discover_usage WHERE key=$1',[key]);return r.rows[0]?.used||0;}
 };
}

export function createCredits({env=process.env,store,now=Date.now,fetcher=fetch,file=fileURLToPath(new URL('../.local-data/discover-credits.json',import.meta.url))}={}){
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 // Without a database on Vercel each instance keeps its own counters: weaker, but the daily cap and the
 // prepaid OpenRouter balance still bound spend.
 // Under node --test, never touch the developer's real ledger file.
 store??=connection?postgresStore(connection):env.VERCEL||process.env.NODE_TEST_CONTEXT?memoryStore():fileStore(file);
 const allowance=Math.max(0,Number(env.DISCOVER_GUEST_CREDITS)||120);
 const ipDaily=Math.max(allowance,Number(env.DISCOVER_IP_DAILY_CREDITS)||allowance*3);
 // ~40 Gemini 3 Flash searches a day across everyone, sized to a few dollars of prepaid OpenRouter credit.
 const globalDaily=Math.max(0,Number(env.DISCOVER_DAILY_CREDIT_CAP)||600);
 // Pause all AI before the prepaid balance runs dry, so a demo never ends in raw provider errors.
 const minBalance=Number.isFinite(Number(env.OPENROUTER_MIN_BALANCE_USD))&&env.OPENROUTER_MIN_BALANCE_USD!==''?Number(env.OPENROUTER_MIN_BALANCE_USD):0.5;
 let balanceCache={at:-Infinity,usd:null};
 const secret=env.DISCOVER_TOKEN_SECRET||sha('tbw-turn|'+(env.OPENROUTER_API_KEY||env.GEMINI_API_KEY||'local-dev'));
 const sign=v=>createHmac('sha256',secret).update(v).digest('hex').slice(0,32);
 const keys=(guest,ip)=>({guest:'guest:'+sha(guest).slice(0,32),ip:'ip:'+sha('ip|'+secret+'|'+ip).slice(0,24)+':'+day(now),global:'global:'+day(now)});
 const costOf=model=>MODELS[modelKey(model)].credits;
 const summary=async guest=>{const remaining=Math.max(0,allowance-await store.get(keys(guest,'').guest));return {allowance,remaining,costs:Object.fromEntries(Object.entries(MODELS).map(([id,m])=>[id,m.credits]))};};
 // Real balance = credits bought − credits used (GET /api/v1/credits), not a key's spending limit.
 async function balance(){
  if(!env.OPENROUTER_API_KEY)return null;
  if(now()-balanceCache.at<60000)return balanceCache.usd;
  try{const r=await fetcher('https://openrouter.ai/api/v1/credits',{headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY},signal:AbortSignal.timeout(4000)});const d=(await r.json())?.data;const usd=r.ok&&Number.isFinite(d?.total_credits)?d.total_credits-(d.total_usage||0):null;balanceCache={at:now(),usd};return usd;}
  catch{balanceCache={at:now(),usd:null};return null;}
 }
 return {
  allowance,summary,balance,
  // Unknown balance (OpenRouter unreachable) does not block: the prepaid account still cannot overspend.
  async budgetOk(){if(env.VISION_PROVIDER&&env.VISION_PROVIDER!=='openrouter')return;const usd=await balance();if(usd!==null&&usd<minBalance)throw Object.assign(new ApiError(503,'Discover’s AI search is paused for now. Please try again later.'),{reason:'balance'});},
  // Charges guest, IP and global counters together, undoing earlier steps if a later ceiling is hit.
  async charge({guest,ip,model}){
   const cost=costOf(model),k=keys(guest,ip);
   if(await store.add(k.guest,cost,allowance)===null)throw Object.assign(new ApiError(429,`You have used your ${allowance} preview credits. Thanks for testing Discover!`),{reason:'guest'});
   if(await store.add(k.ip,cost,ipDaily)===null){await store.sub(k.guest,cost);throw Object.assign(new ApiError(429,'This network has used today’s preview searches. Try again tomorrow.'),{reason:'ip'});}
   if(await store.add(k.global,cost,globalDaily)===null){await store.sub(k.guest,cost);await store.sub(k.ip,cost);throw Object.assign(new ApiError(429,'Discover has reached today’s preview limit. Try again tomorrow.'),{reason:'global'});}
   const nonce=randomBytes(9).toString('hex'),expires=now()+30*60000,payload=`${nonce}.${expires}.${sha(guest).slice(0,16)}`;
   return {cost,remaining:Math.max(0,allowance-await store.get(k.guest)),turn:`${payload}.${sign(payload)}`};
  },
  async refund({guest,ip,model}){const cost=costOf(model),k=keys(guest,ip);await store.sub(k.guest,cost);await store.sub(k.ip,cost);await store.sub(k.global,cost);},
  // A charged question unlocks up to two shopping searches (the first, plus one after editing details).
  async useTurn(token,guest){
   const [nonce,expires,owner,mac]=String(token||'').split('.');
   if(!nonce||!mac||mac.length!==32)return false;
   const expected=Buffer.from(sign(`${nonce}.${expires}.${owner}`)),given=Buffer.from(mac);
   if(expected.length!==given.length||!timingSafeEqual(expected,given))return false;
   if(Number(expires)<now()||owner!==sha(guest).slice(0,16))return false;
   return await store.add('turn:'+nonce,1,2)!==null;
  }
 };
}
