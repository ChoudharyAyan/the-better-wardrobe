import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError,imageData,safeURL} from './discovery.mjs';

// The signed-in person's wardrobe, kept on the server so it survives a new phone or a cleared
// browser (PRD NFR#2). Items and their pictures are stored separately: a 100-piece wardrobe with
// photos is far over Vercel's 4.5 MB response cap, so the list carries image URLs and each
// picture is fetched (and cached) on its own.
export const CATEGORIES=['Shirts','Trousers','Ethnic wear','Dresses','Suits','Outerwear','Footwear','Accessories','Belts','Jewellery'];
export const MAX_ITEMS=600;
const ID=/^[A-Za-z0-9:._-]{1,100}$/;
const MAX_IMAGE=1_200_000,MAX_META=400_000;

const text=(v,max)=>typeof v==='string'?v.replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
const price=v=>v===null||v===''||v===undefined?null:Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<1e7?Math.round(Number(v)):null;

// Only these fields are kept; anything else a client sends is dropped.
export function cleanItem(input={}){
 const id=String(input.id||'');if(!ID.test(id))throw new ApiError(400,'Invalid piece.');
 const name=text(input.name,80);if(!name)throw new ApiError(400,'Give this piece a name.');
 const category=CATEGORIES.includes(input.category)?input.category:'Accessories';
 const reviews=(Array.isArray(input.reviews)?input.reviews:[]).slice(-20).map(r=>({date:date(r?.date),text:text(r?.text,600),rating:Math.max(1,Math.min(5,Math.round(Number(r?.rating)||3)))})).filter(r=>r.text);
 return {id,name,category,type:text(input.type,40),colour:text(input.colour,30),pattern:text(input.pattern,20),brand:text(input.brand,60),size:text(input.size,20),
  price:price(input.price),purchased:date(input.purchased),source:text(input.source,80),retailer:text(input.retailer,60),productUrl:safeURL(String(input.productUrl||''))||'',
  tags:(Array.isArray(input.tags)?input.tags:[]).map(t=>text(t,30)).filter(Boolean).slice(0,8),reviews,cutout:input.cutout===true,
  status:['available','laundry','lent','tailor','stored'].includes(input.status)?input.status:'available',addedAt:text(input.addedAt,30),archived:input.archived===true,
  // A basic added from the tray is drawn, not photographed: its shape and colour are enough.
  art:input.art&&/^[a-z]{2,12}$/.test(input.art.shape)&&/^#[0-9A-Fa-f]{6}$/.test(input.art.colour)?{shape:input.art.shape,colour:input.art.colour}:null};
}
export function cleanMeta(input={}){
 const ids=v=>(Array.isArray(v)?v:[]).map(String).filter(x=>ID.test(x)).slice(0,40);
 const wears=(Array.isArray(input.wears)?input.wears:[]).slice(-2000).map(w=>({id:text(w?.id,60),date:date(w?.date),occasion:text(w?.occasion,20)||'Untagged',items:ids(w?.items)})).filter(w=>w.id&&w.date&&w.items.length);
 const looks=(Array.isArray(input.looks)?input.looks:[]).slice(-200).map(l=>({id:text(l?.id,60),ids:ids(l?.ids),title:text(l?.title,80),occasion:text(l?.occasion,20)})).filter(l=>l.id&&l.ids.length);
 // Last import per store (PRD FR#5): when, and how many pieces it found.
 const syncs=Object.fromEntries(Object.entries(input.syncs&&typeof input.syncs==='object'?input.syncs:{}).filter(([k])=>/^[a-z]{2,20}$/.test(k)).slice(0,20).map(([k,v])=>[k,{at:text(v?.at,30),count:Math.max(0,Math.min(5000,Math.round(Number(v?.count)||0)))}]));
 const meta={wears,looks,shops:(Array.isArray(input.shops)?input.shops:[]).map(s=>text(s,20)).filter(Boolean).slice(0,12),aiConsent:input.aiConsent===true,syncs};
 if(JSON.stringify(meta).length>MAX_META)throw new ApiError(413,'Your wear history is too large to save.');
 return meta;
}

function memoryStore(){
 const items=new Map(),meta=new Map();
 return {
  async list(o){return [...items.values()].filter(r=>r.owner===o).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));},
  async count(o){return [...items.values()].filter(r=>r.owner===o).length;},
  async get(o,id){return items.get(o+'|'+id)||null;},
  async put(row){items.set(row.owner+'|'+row.id,row);},
  async remove(o,id){items.delete(o+'|'+id);},
  async meta(o){return meta.get(o)||null;},
  async putMeta(o,data){meta.set(o,data);}
 };
}
function fileStore(file){
 let pending=Promise.resolve();
 const tx=fn=>{const task=pending.then(async()=>{let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;data={items:{},meta:{}};}const result=await fn(data);await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,JSON.stringify(data));await rename(temp,file);return result;});pending=task.catch(()=>{});return task;};
 const back=r=>r&&{...r,image:r.image?Buffer.from(r.image,'base64'):null};
 return {
  list:o=>tx(d=>Object.values(d.items).filter(r=>r.owner===o).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).map(back)),
  count:o=>tx(d=>Object.values(d.items).filter(r=>r.owner===o).length),
  get:(o,id)=>tx(d=>back(d.items[o+'|'+id])),
  put:row=>tx(d=>{d.items[row.owner+'|'+row.id]={...row,image:row.image?row.image.toString('base64'):null};}),
  remove:(o,id)=>tx(d=>{delete d.items[o+'|'+id];}),
  meta:o=>tx(d=>d.meta[o]||null),
  putMeta:(o,m)=>tx(d=>{d.meta[o]=m;})
 };
}
function postgresStore(connection){
 let pool,ready;
 const db=async()=>{if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:3,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}
  ready??=pool.query('CREATE TABLE IF NOT EXISTS tbw_wardrobe_items (owner text NOT NULL, id text NOT NULL, data jsonb NOT NULL, image bytea, image_type text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner, id)); CREATE TABLE IF NOT EXISTS tbw_wardrobe_meta (owner text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');await ready;return pool;};
 const row=r=>r&&{owner:r.owner,id:r.id,data:r.data,image:r.image||null,imageType:r.image_type||'',updatedAt:new Date(r.updated_at).toISOString()};
 return {
  // The list never pulls picture bytes; pictures are read one at a time by get().
  async list(o){return (await (await db()).query('SELECT owner,id,data,NULL AS image,image_type,updated_at FROM tbw_wardrobe_items WHERE owner=$1::text ORDER BY updated_at',[o])).rows.map(row);},
  async count(o){return Number((await (await db()).query('SELECT count(*) AS n FROM tbw_wardrobe_items WHERE owner=$1::text',[o])).rows[0].n);},
  async get(o,id){return row((await (await db()).query('SELECT owner,id,data,image,image_type,updated_at FROM tbw_wardrobe_items WHERE owner=$1::text AND id=$2::text',[o,id])).rows[0]);},
  async put(r){await (await db()).query('INSERT INTO tbw_wardrobe_items (owner,id,data,image,image_type,updated_at) VALUES ($1::text,$2::text,$3::jsonb,$4::bytea,$5::text,$6::timestamptz) ON CONFLICT (owner,id) DO UPDATE SET data=EXCLUDED.data, image=EXCLUDED.image, image_type=EXCLUDED.image_type, updated_at=EXCLUDED.updated_at',[r.owner,r.id,JSON.stringify(r.data),r.image,r.imageType||null,r.updatedAt]);},
  async remove(o,id){await (await db()).query('DELETE FROM tbw_wardrobe_items WHERE owner=$1::text AND id=$2::text',[o,id]);},
  async meta(o){return (await (await db()).query('SELECT data FROM tbw_wardrobe_meta WHERE owner=$1::text',[o])).rows[0]?.data||null;},
  async putMeta(o,m){await (await db()).query('INSERT INTO tbw_wardrobe_meta (owner,data,updated_at) VALUES ($1::text,$2::jsonb,now()) ON CONFLICT (owner) DO UPDATE SET data=EXCLUDED.data, updated_at=now()',[o,JSON.stringify(m)]);}
 };
}

export function createWardrobe({env=process.env,store,now=Date.now,file=fileURLToPath(new URL('../.local-data/wardrobe.json',import.meta.url))}={}){
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 store??=connection?postgresStore(connection):env.VERCEL||process.env.NODE_TEST_CONTEXT?memoryStore():fileStore(file);
 // Rows are keyed by a hash of the account id, never the raw id.
 const owner=account=>{if(!account)throw new ApiError(401,'Sign in to keep your wardrobe on every device.');return createHash('sha256').update('wardrobe|'+account).digest('hex').slice(0,32);};
 const imageUrl=(id,version)=>`/api/wardrobe/image/${encodeURIComponent(id)}?v=${version}`;
 const view=r=>({...r.data,image:r.data.image||(r.imageType?imageUrl(r.id,r.data.imageVersion||''):'')});
 return {
  async list(account){const o=owner(account);const [rows,meta]=await Promise.all([store.list(o),store.meta(o)]);return {items:rows.map(view),meta:meta||cleanMeta({})};},
  // image: a data URL (stored here) or an https URL (kept as a link, e.g. the retailer's product photo).
  async putItem(account,id,{item,image}={}){
   const o=owner(account),clean=cleanItem({...item,id});
   const existing=await store.get(o,id);
   if(!existing&&await store.count(o)>=MAX_ITEMS)throw new ApiError(409,`Your wardrobe can hold ${MAX_ITEMS} pieces in the beta.`);
   let bytes=existing?.image||null,type=existing?.imageType||'',version=existing?.data?.imageVersion||'';
   if(typeof image==='string'&&image.startsWith('data:')){
    const img=imageData(image);if(img.data.length>MAX_IMAGE)throw new ApiError(413,'This picture is too large to save.');
    bytes=img.data;type=img.type;version=createHash('sha256').update(img.data).digest('hex').slice(0,12);clean.image='';
   }else if(typeof image==='string'&&image){clean.image=safeURL(image);bytes=null;type='';version='';if(!clean.image)throw new ApiError(400,'Invalid picture link.');}
   else if(!bytes)clean.image=existing?.data?.image||'';
   clean.imageVersion=version;
   await store.put({owner:o,id,data:clean,image:bytes,imageType:type,updatedAt:new Date(now()).toISOString()});
   return view({id,data:clean,imageType:type});
  },
  async removeItem(account,id){if(!ID.test(String(id)))throw new ApiError(400,'Invalid piece.');await store.remove(owner(account),id);},
  async image(account,id){if(!ID.test(String(id)))return null;const r=await store.get(owner(account),id);return r?.image?{data:Buffer.from(r.image),type:r.imageType}:null;},
  async putMeta(account,input){const meta=cleanMeta(input);await store.putMeta(owner(account),meta);return meta;}
 };
}

// "Paste a product link" (PRD FR#8): read the retailer's own page for the product photo, name,
// brand and price. Only known retailers are fetched (retailerPage enforces the allow-list and
// blocks private addresses); nothing is invented when a field is missing.
const meta=(html,prop)=>{const m=html.match(new RegExp('<meta[^>]*(?:property|name)=["\']'+prop+'["\'][^>]*content=["\']([^"\']*)["\']|<meta[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']'+prop+'["\']','i'));return text((m?.[1]||m?.[2]||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"),250);};
export function productFromPage(html,url){
 let product=null;
 const walk=v=>{if(product||!v||typeof v!=='object')return;if([v['@type']].flat().includes('Product')){product=v;return;}if(Array.isArray(v))v.forEach(walk);else if(v['@graph'])walk(v['@graph']);};
 for(const m of String(html).matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 const offer=Array.isArray(product?.offers)?product.offers[0]:product?.offers;
 const firstImage=v=>typeof v==='string'?v:Array.isArray(v)?firstImage(v[0]):v?.url||v?.contentUrl||'';
 const image=safeURL(firstImage(product?.image)||meta(html,'og:image')||'');
 const name=text(product?.name,80)||meta(html,'og:title').slice(0,80);
 const brand=text(typeof product?.brand==='string'?product.brand:product?.brand?.name,60);
 const amount=Number(offer?.price??meta(html,'product:price:amount'));
 const currency=text(offer?.priceCurrency||meta(html,'product:price:currency'),3).toUpperCase();
 if(!name)return null;
 return {name,brand,image,price:Number.isFinite(amount)&&amount>0&&(!currency||currency==='INR')?Math.round(amount):null,productUrl:safeURL(url)};
}
