import {readFile,writeFile,readdir,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {matchItems,searchWords,DESCRIBE_FIELDS} from './scoring.mjs';
import {canonicalCategory,canonicalEnum,canonicalColour} from './taxonomy.mjs';
import {callModel} from './providers.mjs';
import {costOf} from './models.mjs';
import {prepareImage,PROTOTYPE_DIR} from './golden.mjs';
import {TASKS,SYSTEM} from './tasks.mjs';

// The answer key, without anyone labelling by hand. Two strong models from different companies, kept out of
// the test so no model grades its own homework, label each image independently. An item counts only if both
// saw it; a field counts only if both said the same thing. Disagreements are left unscored, exactly as a
// careful human labeller leaves a field blank when unsure. At most 4 items per image: the most prominent.
export const KEY_MAKERS=['gemini-3.1-pro','claude-sonnet-5.5'];
export const KEY_DIR=path.join(PROTOTYPE_DIR,'.local-data','evals','golden');
const NOT_SCORABLE=new Set(['','unknown','not applicable']);

function sameValue(field,a,b){
 if(field==='colour'){const x=canonicalColour(a),y=canonicalColour(b);return x&&x===y&&x!=='unknown'?x:null;}
 if(field==='ethnic')return typeof a==='boolean'&&a===b?a:null;
 if(field==='brand_visible'){const x=String(a??'').trim().toLowerCase(),y=String(b??'').trim().toLowerCase();return x&&y&&(x.includes(y)||y.includes(x))?(x.length<=y.length?x:y):null;}
 const x=canonicalEnum(field,a),y=canonicalEnum(field,b);return x===y&&!NOT_SCORABLE.has(x)?x:null;
}
const shared=(xs,ys)=>{const have=new Set((ys||[]).flatMap(searchWords));return (xs||[]).filter(f=>{const w=searchWords(f);return w.length&&w.every(t=>have.has(t));});};

export function mergeKeys(a,b,{maxItems=4}={}){
 const A=(a?.items||[]).filter(x=>x&&typeof x==='object').map(x=>({...x,category:canonicalCategory(x.category)}));
 const B=(b?.items||[]).filter(x=>x&&typeof x==='object').map(x=>({...x,category:canonicalCategory(x.category)}));
 const matches=matchItems(A,B).sort((x,y)=>x.gi-y.gi).slice(0,maxItems);
 let agreed=0,compared=0;
 const items=matches.map(m=>{
  const x=A[m.gi],y=B[m.pi];const it={label:x.label};
  if(Array.isArray(x.box)&&Array.isArray(y.box)&&x.box.length===4&&y.box.length===4)it.box=x.box.map((v,i)=>Math.round((Number(v)+Number(y.box[i]))/2));
  compared++;it.category=x.category;if(x.category===y.category)agreed++;else it.categoryUnscored=true;
  for(const f of DESCRIBE_FIELDS){const both=[x[f],y[f]];if(both.every(v=>v===undefined||v===null||v===''))continue;compared++;const v=sameValue(f,x[f],y[f]);if(v!==null){it[f]=v;agreed++;}}
  const feats=shared(x.features,[...(y.features||[]),y.label,y.search_query]).slice(0,4);if(feats.length)it.features=feats;
  const ya=new Set(searchWords(y.search_query));const terms=searchWords(x.search_query).filter(w=>ya.has(w)).slice(0,8);if(terms.length)it.search_terms=terms;
  return it;
 });
 const specific=!!(a?.known_item?.is_specific&&b?.known_item?.is_specific);
 return {items,scene:a?.scene===b?.scene?a.scene:undefined,distinctive:specific?{a:a.known_item.guess,b:b.known_item.guess}:undefined,
  agreement:{items:Math.max(A.length,B.length)?matches.length/Math.min(Math.max(A.length,B.length),maxItems):1,fields:compared?agreed/compared:1}};
}

// Tags come from the folders you sorted the screenshots into: celebrity/womens-ethnic/x.png → ['celebrity','womens-ethnic'].
export async function walkImages(dir,base=dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walkImages(p,base));else if(/\.(jpe?g|png|webp)$/i.test(e.name))out.push({file:p,rel:path.relative(base,p)});}return out.sort((x,y)=>x.rel.localeCompare(y.rel));}
export const tagsFor=rel=>path.dirname(rel).split(path.sep).filter(s=>s&&s!=='.').map(s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean);
export const idFor=rel=>rel.replace(/\.[a-z]+$/i,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export async function buildKey({dir,models,env=process.env,fetcher=fetch,maxUsd=5,maxDim=768,limit,out=path.join(KEY_DIR,'autokey.json'),rawDir=path.join(KEY_DIR,'keymakers'),onProgress=()=>{}}){
 if(models.length!==2)throw Error('The answer key needs exactly two key-maker models.');
 let files=await walkImages(dir);if(!files.length)throw Error('No images found under '+dir);if(limit>0)files=files.slice(0,limit);
 await mkdir(rawDir,{recursive:true});await mkdir(path.dirname(out),{recursive:true});
 let spent=0;const images=[];
 for(const [i,f] of files.entries()){
  const id=idFor(f.rel);const outputs=[];
  for(const m of models){
   const raw=path.join(rawDir,`${id}.${m.id}.${maxDim}.json`);let res=null;
   try{res=JSON.parse(await readFile(raw,'utf8'));}catch{}
   if(!res){if(spent>=maxUsd)break;const img=await prepareImage(f.file,maxDim);try{res=await callModel({model:m,system:SYSTEM,prompt:TASKS.look.prompt(),image:img,schema:TASKS.look.schema,schemaName:'look',env,fetcher,maxTokens:4000});spent+=costOf(m,res.usage)||0;await writeFile(raw,JSON.stringify(res));}catch(e){res={error:e.message};}}
   outputs.push(res);
  }
  if(outputs.length<2||outputs.some(o=>!o?.json)){onProgress({i:i+1,total:files.length,id,skipped:true,spent});continue;}
  const k=mergeKeys(outputs[0].json,outputs[1].json);
  images.push({id,file:path.relative(path.dirname(out),f.file),status:'verified',labeledBy:'ai-consensus:'+models.map(m=>m.id).join('+'),tags:tagsFor(f.rel),exhaustive:false,scene:k.scene,distinctive:k.distinctive,agreement:k.agreement,items:k.items});
  onProgress({i:i+1,total:files.length,id,items:k.items.length,agreement:k.agreement.fields,spent});
 }
 const usable=images.filter(x=>x.items.length);
 const agreement={items:usable.reduce((s,x)=>s+x.agreement.items,0)/(usable.length||1),fields:usable.reduce((s,x)=>s+x.agreement.fields,0)/(usable.length||1)};
 await writeFile(out,JSON.stringify({version:1,description:'AI consensus answer key: only items and fields both key makers agreed on. Re-run autolabel to rebuild; key-maker answers are cached.',keyMakers:models.map(m=>m.id),agreement,images:usable},null,1));
 return {out,images:usable.length,skipped:files.length-usable.length,agreement,spent};
}
