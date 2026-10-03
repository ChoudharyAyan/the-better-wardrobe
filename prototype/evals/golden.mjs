import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {CATEGORIES,COLOURS,canonicalCategory} from './taxonomy.mjs';

export const EVALS_DIR=fileURLToPath(new URL('./',import.meta.url));
export const PROTOTYPE_DIR=path.resolve(EVALS_DIR,'..');
// Committed labels live in evals/golden. Private screenshots (Instagram, celebrity looks) and their labels go in
// .local-data/evals/golden, which is gitignored, so real user images never end up in the repo.
export const GOLDEN_DIRS=[path.join(EVALS_DIR,'golden'),path.join(PROTOTYPE_DIR,'.local-data','evals','golden')];

async function jsonFiles(dir){try{return (await readdir(dir)).filter(f=>f.endsWith('.json')).map(f=>path.join(dir,f));}catch{return [];}}
export async function loadGolden({dirs=GOLDEN_DIRS,includeDrafts=false,only}={}){
 const looks=[],queries=[],warnings=[],seen=new Set();let keyAgreement=null;
 for(const dir of dirs)for(const file of await jsonFiles(dir)){
  if(only&&!path.basename(file,'.json').startsWith(only))continue;
  let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){warnings.push(`${path.basename(file)}: not valid JSON (${e.message})`);continue;}
  if(data.agreement)keyAgreement=data.agreement;
  for(const g of data.images||[]){
   if(!g.id||seen.has('l:'+g.id)){warnings.push(`${path.basename(file)}: duplicate or missing image id ${g.id}`);continue;}seen.add('l:'+g.id);
   if(g.status!=='verified'&&!includeDrafts)continue;
   const items=(g.items||[]).map(it=>({...it,category:canonicalCategory(it.category)}));
   for(const it of items){if(!CATEGORIES.includes(it.category))warnings.push(`${g.id}: unknown category ${it.category}`);if(it.colour&&!COLOURS.includes(it.colour))warnings.push(`${g.id}: colour "${it.colour}" is not a colour family`);}
   looks.push({...g,items,path:path.resolve(path.dirname(file),g.file),tags:g.tags||[]});
  }
  for(const q of data.queries||[]){
   if(!q.id||seen.has('q:'+q.id)){warnings.push(`${path.basename(file)}: duplicate or missing query id ${q.id}`);continue;}seen.add('q:'+q.id);
   if(q.status!=='verified'&&!includeDrafts)continue;queries.push({...q,tags:q.tags||[]});
  }
 }
 return {looks,queries,warnings,keyAgreement};
}
export const composition=list=>{const out={};for(const x of list)for(const t of x.tags||[])out[t]=(out[t]||0)+1;return out;};

// Same preprocessing for every provider so no model gets a sharper picture than another.
export async function prepareImage(file,maxDim=1024){
 const original=await readFile(file);
 const data=await sharp(original).rotate().resize(maxDim,maxDim,{fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
 return {data,mimeType:'image/jpeg',hash:createHash('sha256').update(original).digest('hex')};
}
