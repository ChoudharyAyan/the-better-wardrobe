import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {imageData,ApiError} from './discovery.mjs';

const MAX_ENTRIES=200,MAX_NOTE=2000;
const extFor=type=>type==='image/png'?'.png':type==='image/webp'?'.webp':'.jpg';

// Screenshots come from the owner's own phone over the LAN/tunnel, never a shared
// audience, so this store has no auth beyond the DEVELOPER_DASHBOARD gate in server.mjs.
export function createQaStore({dir=new URL('../.local-data/qa/',import.meta.url),now=Date.now}={}){
 const indexFile=new URL('index.json',dir);
 let loaded=false,entries=[];
 async function load(){if(loaded)return;loaded=true;try{const parsed=JSON.parse(await readFile(indexFile,'utf8'));entries=Array.isArray(parsed)?parsed:[];}catch{entries=[];}}
 async function persist(){await mkdir(dir,{recursive:true});await writeFile(indexFile,JSON.stringify(entries,null,2));}
 return {async add({image,note}){
  await load();
  const img=imageData(image);
  const cleanNote=typeof note==='string'?note.trim().slice(0,MAX_NOTE):'';
  if(!cleanNote)throw new ApiError(400,'Add a note describing what you noticed.');
  const id=randomBytes(8).toString('hex'),file=id+extFor(img.type);
  await mkdir(dir,{recursive:true});await writeFile(new URL(file,dir),img.data);
  entries.push({id,note:cleanNote,file,createdAt:new Date(now()).toISOString(),status:'open'});
  if(entries.length>MAX_ENTRIES){const removed=entries.splice(0,entries.length-MAX_ENTRIES);await Promise.all(removed.map(e=>unlink(new URL(e.file,dir)).catch(()=>{})));}
  await persist();
  return {id};
 }};
}
