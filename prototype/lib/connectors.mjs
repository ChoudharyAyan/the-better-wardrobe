import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {ApiError,localDataDirectory} from './discovery.mjs';

export const STORES=['myntra','flipkart','slikk','ajio','tatacliq','nykaafashion'];

// Order batches sent by the local-only Chrome extension (prototype/extension/), held until
// the app pulls them into import review. Off unless ORDER_CONNECTORS=true, and never on
// Vercel: this is a development channel for the owner's own accounts, not a public feature.
export function createConnectorStore({env=process.env,dir=new URL('connectors/',localDataDirectory),now=Date.now}={}){
 const enabled=env.ORDER_CONNECTORS==='true'&&!env.VERCEL;
 const file=store=>{if(!STORES.includes(store))throw new ApiError(400,'Unknown store.');return new URL(store+'.json',dir);};
 return {
  enabled,
  async put(store,data){
   if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(400,'Invalid order data.');
   await mkdir(dir,{recursive:true});
   await writeFile(file(store),JSON.stringify({store,receivedAt:new Date(now()).toISOString(),data}));
  },
  async get(store){try{return JSON.parse(await readFile(file(store),'utf8'));}catch(e){if(e.status)throw e;return null;}},
  async list(){const out=[];for(const store of STORES){const batch=await this.get(store);if(batch)out.push({store,receivedAt:batch.receivedAt});}return out;},
  async clear(store){await unlink(file(store)).catch(()=>{});}
 };
}
