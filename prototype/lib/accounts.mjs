import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError} from './discovery.mjs';

// Accounts and onboarding (design QA #15, 6 Oct 2026).
// Google sign-in is the real account. Until the owner adds GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, a
// "preview profile" bound to the guest cookie stands in so onboarding can be tested on a phone; it
// disappears as soon as Google is configured. Guests who explore freely get no saved chats or personalisation.
export const EXPLORE=['discover','style','wardrobe','custom'];
export const GENDERS=['male','female','other'];
export const VIBES=['new','curious','knows','trend','freak'];
export const INTERESTS=['mens-formal','mens-casual','womens-ethnic','womens-western','streetwear','athleisure','sneakers','accessories','luxury','budget','indie'];
const SESSION_DAYS=30;
const b64=v=>Buffer.from(v).toString('base64url');

function memoryStore(){const rows=new Map();return {async get(id){return rows.get(id)||null;},async put(row){rows.set(row.id,row);}};}
function fileStore(file){
 let pending=Promise.resolve();
 const tx=fn=>{const task=pending.then(async()=>{let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;data={};}const result=await fn(data);await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,JSON.stringify(data));await rename(temp,file);return result;});pending=task.catch(()=>{});return task;};
 return {get:id=>tx(d=>d[id]||null),put:row=>tx(d=>{d[row.id]=row;})};
}
function postgresStore(connection){
 let pool,ready;
 const db=async()=>{if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:3,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}ready??=pool.query('CREATE TABLE IF NOT EXISTS tbw_accounts (id text PRIMARY KEY, kind text NOT NULL, email text NOT NULL DEFAULT \'\', name text NOT NULL DEFAULT \'\', picture text NOT NULL DEFAULT \'\', profile jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())');await ready;return pool;};
 const row=r=>r&&{id:r.id,kind:r.kind,email:r.email,name:r.name,picture:r.picture,profile:r.profile||null};
 return {
  async get(id){return row((await (await db()).query('SELECT id,kind,email,name,picture,profile FROM tbw_accounts WHERE id=$1::text',[id])).rows[0]);},
  async put(r){await (await db()).query('INSERT INTO tbw_accounts (id,kind,email,name,picture,profile,updated_at) VALUES ($1::text,$2::text,$3::text,$4::text,$5::text,$6::jsonb,now()) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture, profile=EXCLUDED.profile, updated_at=now()',[r.id,r.kind,r.email||'',r.name||'',r.picture||'',r.profile?JSON.stringify(r.profile):null]);}
 };
}

// Onboarding answers. Step one is required; step two (vibe, interests) is optional.
export function cleanProfile(input={}){
 const text=(v,max)=>typeof v==='string'?v.replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
 const name=text(input.name,60);if(!name)throw new ApiError(400,'Tell us your name.');
 const age=Number(input.age);if(!Number.isInteger(age)||age<13||age>100)throw new ApiError(400,'Enter an age between 13 and 100.');
 if(!GENDERS.includes(input.gender))throw new ApiError(400,'Choose male, female or other.');
 const explore=[...new Set((Array.isArray(input.explore)?input.explore:[]).filter(x=>EXPLORE.includes(x)))];
 if(!explore.length)throw new ApiError(400,'Pick at least one thing to explore.');
 const custom=explore.includes('custom')?text(input.custom,200):'';
 if(explore.includes('custom')&&!custom)throw new ApiError(400,'Tell us what you want to do.');
 const vibe=VIBES.includes(input.vibe)?input.vibe:'';
 const interests=[...new Set((Array.isArray(input.interests)?input.interests:[]).filter(x=>INTERESTS.includes(x)))];
 return {name,age,gender:input.gender,explore,custom,vibe,interests,completedAt:new Date().toISOString()};
}
// Discover's default department for this person; "other" keeps both.
export const departmentFor=profile=>profile?.gender==='male'?'menswear':profile?.gender==='female'?'womenswear':'';

export function createAccounts({env=process.env,store,fetcher=fetch,now=Date.now,file=fileURLToPath(new URL('../.local-data/accounts.json',import.meta.url))}={}){
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 store??=connection?postgresStore(connection):env.VERCEL||process.env.NODE_TEST_CONTEXT?memoryStore():fileStore(file);
 const google=Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
 const secret=env.AUTH_SECRET||env.DISCOVER_TOKEN_SECRET||'local-preview-secret';
 const sign=v=>createHmac('sha256',secret).update(v).digest('base64url');
 const equal=(a,b)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 // Session cookie: account id + expiry, signed. Nothing else about the person lives in the cookie.
 const session=id=>{const body=b64(id)+'.'+(now()+SESSION_DAYS*864e5);return body+'.'+sign(body);};
 const readSession=value=>{const [id,exp,mac]=String(value||'').split('.');if(!id||!exp||!mac)return null;const body=id+'.'+exp;if(!equal(mac,sign(body))||Number(exp)<now())return null;try{return Buffer.from(id,'base64url').toString();}catch{return null;}};
 const publicAccount=a=>a&&{id:a.id,kind:a.kind,name:a.name,email:a.email,picture:a.picture};
 return {
  google,session,readSession,
  async get(id){return id?store.get(id):null;},
  async me(id){const a=id?await store.get(id):null;return {google,signedIn:Boolean(a),previewAvailable:!google,account:publicAccount(a),profile:a?.profile||null,onboarded:Boolean(a?.profile?.completedAt)};},
  // Preview profiles exist only while Google isn't configured, and reuse the guest id so earlier chats carry over.
  async preview(guest){if(google)throw new ApiError(404,'Use Google sign-in.');const id='p:'+guest;if(!await store.get(id))await store.put({id,kind:'preview',email:'',name:'',picture:'',profile:null});return id;},
  async saveProfile(id,input){const a=id&&await store.get(id);if(!a)throw new ApiError(401,'Sign in to save your profile.');const profile=cleanProfile(input);await store.put({...a,profile});return profile;},
  // Whose chats these are: preview accounts keep the guest's existing chats.
  chatOwner:(id,guest)=>id?.startsWith('p:')?guest:id,
  // Google OAuth (authorization code + PKCE). The verifier and state ride in a short-lived signed cookie.
  authStart(redirectUri){
   if(!google)throw new ApiError(404,'Google sign-in is not configured yet.');
   const state=randomBytes(16).toString('base64url'),verifier=randomBytes(32).toString('base64url');
   const challenge=createHash('sha256').update(verifier).digest('base64url');
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).forEach(([k,v])=>url.searchParams.set(k,v));
   const body=b64(JSON.stringify({state,verifier,exp:now()+10*60000}));
   return {url:url.href,cookie:body+'.'+sign(body)};
  },
  async authFinish({code,state,cookie,redirectUri}){
   if(!google)throw new ApiError(404,'Google sign-in is not configured yet.');
   const [body,mac]=String(cookie||'').split('.');if(!body||!mac||!equal(mac,sign(body)))throw new ApiError(400,'Sign-in expired. Please try again.');
   const saved=JSON.parse(Buffer.from(body,'base64url').toString());
   if(saved.exp<now()||!state||!equal(String(state),saved.state))throw new ApiError(400,'Sign-in expired. Please try again.');
   const token=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(code||''),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:saved.verifier})});
   if(!token.ok)throw new ApiError(502,'Google sign-in did not complete. Please try again.');
   const {access_token}=await token.json();
   const info=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+access_token}});
   if(!info.ok)throw new ApiError(502,'Google sign-in did not complete. Please try again.');
   const user=await info.json();if(!user.sub||user.email_verified===false)throw new ApiError(403,'Use a verified Google account.');
   const id='g:'+user.sub,existing=await store.get(id);
   await store.put({id,kind:'google',email:String(user.email||'').slice(0,200),name:String(user.name||'').slice(0,80),picture:String(user.picture||'').startsWith('https://')?String(user.picture).slice(0,500):'',profile:existing?.profile||null});
   return {id,onboarded:Boolean(existing?.profile?.completedAt)};
  }
 };
}
