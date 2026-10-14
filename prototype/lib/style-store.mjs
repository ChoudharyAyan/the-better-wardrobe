import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ApiError } from './discovery.mjs';

/** Serialized owner-scoped transactions, local atomic files or Postgres row locks. */
export function createStyleStore({ env = process.env, file = fileURLToPath(new URL('../.local-data/style-sessions.json', import.meta.url)) } = {}) {
  let queue = Promise.resolve(), memory = {}, pool, ready;
  const connection = env.POSTGRES_URL || env.COMMUNITY_DATABASE_URL;
  const transact = async (owner, update) => {
    if (connection) {
      if (!pool) { const { Pool } = await import('pg'); pool = new Pool({ connectionString: connection, max: 3, ssl: connection.includes('localhost') ? false : { rejectUnauthorized: true } }); }
      ready ??= pool.query('CREATE TABLE IF NOT EXISTS tbw_style_sessions (owner text PRIMARY KEY, data jsonb NOT NULL)');
      await ready;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO tbw_style_sessions (owner,data) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING', [owner, '{}']);
        const { rows } = await client.query('SELECT data FROM tbw_style_sessions WHERE owner=$1 FOR UPDATE', [owner]);
        const data = rows[0].data;
        const result = await update(data);
        await client.query('UPDATE tbw_style_sessions SET data=$2::jsonb WHERE owner=$1', [owner, JSON.stringify(data)]);
        await client.query('COMMIT'); return result;
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
    if (env.VERCEL) throw new ApiError(503, 'Style Me storage is not configured. Your draft remains on this device.');
    const run = queue.then(async () => {
      const ephemeral = !!process.env.NODE_TEST_CONTEXT || env.STYLE_MEMORY_STORE === 'true';
      let all = structuredClone(memory);
      if (!ephemeral) { try { all = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; all = {}; } }
      all[owner] ??= {};
      const result = await update(all[owner]);
      if (ephemeral) memory = all;
      else { await mkdir(path.dirname(file), { recursive: true }); const temp = file + '.' + randomUUID() + '.tmp'; await writeFile(temp, JSON.stringify(all), { mode: 0o600 }); await rename(temp, file); }
      return result;
    });
    queue = run.catch(() => {}); return run;
  };
  const migrate = async (from, to) => {
    if (from === to) return;
    if(connection){
      await transact(from,()=>{});await transact(to,()=>{});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const {rows}=await client.query('SELECT owner,data FROM tbw_style_sessions WHERE owner=ANY($1::text[]) ORDER BY owner FOR UPDATE',[[from,to]]);
        const source=rows.find(r=>r.owner===from).data,target=rows.find(r=>r.owner===to).data;
        for(const [id,session] of Object.entries(source))if(!target[id])target[id]=session;
        await client.query('UPDATE tbw_style_sessions SET data=$2::jsonb WHERE owner=$1',[to,JSON.stringify(target)]);
        await client.query('UPDATE tbw_style_sessions SET data=$2::jsonb WHERE owner=$1',[from,'{}']);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
      return;
    }
    if(env.VERCEL)throw new ApiError(503,'Account session storage is not configured.');
    const run=queue.then(async()=>{
      const ephemeral=!!process.env.NODE_TEST_CONTEXT||env.STYLE_MEMORY_STORE==='true';let all=structuredClone(memory);
      if(!ephemeral){try{all=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;all={};}}
      all[to]??={};for(const [id,session] of Object.entries(all[from]||{}))if(!all[to][id])all[to][id]=session;
      delete all[from];
      if(ephemeral)memory=all;
      else{await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(all),{mode:0o600});await rename(temp,file);}
    });queue=run.catch(()=>{});return run;
  };
  return { transact, migrate };
}
