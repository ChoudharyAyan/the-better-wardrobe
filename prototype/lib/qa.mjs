import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {imageData,ApiError} from './discovery.mjs';

const MAX_ENTRIES=200,MAX_NOTE=2000;
const extFor=type=>type==='image/png'?'.png':type==='image/webp'?'.webp':'.jpg';
const typeFor=file=>file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/jpeg';

// Screenshots come from the owner's own phone over the LAN/tunnel, never a shared
// audience, so this store has no auth beyond the DEVELOPER_DASHBOARD gate in server.mjs.
export function createQaStore({dir=new URL('../.local-data/qa/',import.meta.url),now=Date.now}={}){
 const indexFile=new URL('index.json',dir);
 // Re-read on every call: Claude resolves entries by editing index.json directly, and a cached copy would overwrite that.
 async function load(){try{const parsed=JSON.parse(await readFile(indexFile,'utf8'));return Array.isArray(parsed)?parsed:[];}catch{return [];}}
 async function persist(entries){await mkdir(dir,{recursive:true});await writeFile(indexFile,JSON.stringify(entries,null,2));}
 return {
  async add({image,note}){
   const img=imageData(image);
   const cleanNote=typeof note==='string'?note.trim().slice(0,MAX_NOTE):'';
   if(!cleanNote)throw new ApiError(400,'Add a note describing what you noticed.');
   const entries=await load();
   const id=randomBytes(8).toString('hex'),file=id+extFor(img.type);
   await mkdir(dir,{recursive:true});await writeFile(new URL(file,dir),img.data);
   entries.push({id,note:cleanNote,file,createdAt:new Date(now()).toISOString(),status:'open'});
   if(entries.length>MAX_ENTRIES){const removed=entries.splice(0,entries.length-MAX_ENTRIES);await Promise.all(removed.map(e=>unlink(new URL(e.file,dir)).catch(()=>{})));}
   await persist(entries);
   return {id};
  },
  async list(){return (await load()).map(({id,note,createdAt,status,resolution})=>({id,note,createdAt,status:status==='resolved'?'resolved':'open',resolution:typeof resolution==='string'?resolution:''})).reverse();},
  async image(id){if(!/^[a-f0-9]{16}$/.test(String(id)))return null;const entry=(await load()).find(e=>e.id===id);if(!entry||!/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(entry.file))return null;try{return {data:await readFile(new URL(entry.file,dir)),type:typeFor(entry.file)};}catch{return null;}}
 };
}
