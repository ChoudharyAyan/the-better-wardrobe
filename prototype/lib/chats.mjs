import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError} from './discovery.mjs';

// Saved Discover chats, kept per anonymous guest (the same cookie as credits and Community XP).
// The beta keeps three: a fourth is refused with the current list so the app can ask which to replace.
export const MAX_CHATS=3;
const MAX_BYTES=400_000,ID=/^[a-f0-9-]{36}$/;
const owner=guest=>createHash('sha256').update('chat|'+guest).digest('hex').slice(0,32);
const summary=c=>({id:c.id,title:c.title,updatedAt:c.updatedAt});

function memoryStore(){
 const rows=new Map();
 return {
  async list(o){return [...rows.values()].filter(r=>r.owner===o).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  async get(o,id){const r=rows.get(id);return r&&r.owner===o?r:null;},
  async put(row){rows.set(row.id,row);},
  async remove(o,id){const r=rows.get(id);if(r&&r.owner===o)rows.delete(id);}
 };
}
function fileStore(file){
 let pending=Promise.resolve();
 const tx=fn=>{const task=pending.then(async()=>{let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;data={};}const result=await fn(data);await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,JSON.stringify(data));await rename(temp,file);return result;});pending=task.catch(()=>{});return task;};
 return {
  list:o=>tx(d=>Object.values(d).filter(r=>r.owner===o).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))),
  get:(o,id)=>tx(d=>d[id]?.owner===o?d[id]:null),
  put:row=>tx(d=>{d[row.id]=row;}),
  remove:(o,id)=>tx(d=>{if(d[id]?.owner===o)delete d[id];})
 };
}
function postgresStore(connection){
 let pool,ready;
 const db=async()=>{if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:3,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}ready??=pool.query('CREATE TABLE IF NOT EXISTS tbw_discover_chats (id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS tbw_discover_chats_owner ON tbw_discover_chats (owner, updated_at DESC)');await ready;return pool;};
 const row=r=>r&&{id:r.id,owner:r.owner,title:r.title,data:r.data,updatedAt:new Date(r.updated_at).toISOString()};
 return {
  async list(o){return (await (await db()).query('SELECT id,owner,title,data,updated_at FROM tbw_discover_chats WHERE owner=$1::text ORDER BY updated_at DESC',[o])).rows.map(row);},
  async get(o,id){return row((await (await db()).query('SELECT id,owner,title,data,updated_at FROM tbw_discover_chats WHERE id=$1::text AND owner=$2::text',[id,o])).rows[0]);},
  async put(r){await (await db()).query('INSERT INTO tbw_discover_chats (id,owner,title,data,updated_at) VALUES ($1::text,$2::text,$3::text,$4::jsonb,$5::timestamptz) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, data=EXCLUDED.data, updated_at=EXCLUDED.updated_at WHERE tbw_discover_chats.owner=EXCLUDED.owner',[r.id,r.owner,r.title,JSON.stringify(r.data),r.updatedAt]);},
  async remove(o,id){await (await db()).query('DELETE FROM tbw_discover_chats WHERE id=$1::text AND owner=$2::text',[id,o]);}
 };
}

export function createChats({env=process.env,store,now=Date.now,file=fileURLToPath(new URL('../.local-data/discover-chats.json',import.meta.url))}={}){
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 store??=connection?postgresStore(connection):env.VERCEL||process.env.NODE_TEST_CONTEXT?memoryStore():fileStore(file);
 const checkId=id=>{if(!ID.test(String(id)))throw new ApiError(400,'Invalid chat.');};
 return {
  async list(guest){return (await store.list(owner(guest))).slice(0,MAX_CHATS).map(summary);},
  async get(guest,id){checkId(id);const c=await store.get(owner(guest),id);if(!c)throw new ApiError(404,'Chat not found.');return {...summary(c),data:c.data};},
  async save(guest,id,{title,data}={}){
   checkId(id);
   if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(400,'Invalid chat.');
   if(JSON.stringify(data).length>MAX_BYTES)throw new ApiError(413,'This chat is too large to save.');
   const o=owner(guest),cleanTitle=String(title||'').replace(/\s+/g,' ').trim().slice(0,60)||'New search';
   if(!await store.get(o,id)){const existing=await store.list(o);if(existing.length>=MAX_CHATS)throw Object.assign(new ApiError(409,`You can keep ${MAX_CHATS} chats in the beta. Delete one to start another.`),{chats:existing.map(summary)});}
   const row={id,owner:o,title:cleanTitle,data,updatedAt:new Date(now()).toISOString()};
   await store.put(row);return summary(row);
  },
  async remove(guest,id){checkId(id);await store.remove(owner(guest),id);}
 };
}
