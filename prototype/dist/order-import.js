// Pure mapping from each retailer's order records to one wardrobe item shape.
// Runs in the browser only: order files are parsed on the device, and only the
// product fields below are kept. Addresses, payment and contact columns are never read.

export const CATEGORIES=['Shirts','Trousers','Footwear','Accessories','Belts','Dresses','Suits','Outerwear','Jewellery'];

// Order matters: the first rule that matches wins, so specific types sit above generic ones.
const RULES=[
 [/perfume|deodorant|fragrance|serum|shampoo|lipstick|makeup|skin ?care|personal care|grooming|blanket|quilt|dohar|bedsheet|cushion|towel|free ?gift|voucher|gift ?card|protection ?plan|charger|handset|mobile|book|suitcase|trolley|luggage|playgym|baby/i,null],
 [/trunk|brief|boxer|bra\b|panty|panties|innerwear|vest|socks?\b|thermal|camisole|shapewear/i,'innerwear'],
 [/kurta ?set|salwar ?suit|churidar ?set|co-?ords?|\bsuits?\b|sherwani|nehru/i,'Suits'],
 [/sari|saree|lehenga|dress|gown|jumpsuit|anarkali/i,'Dresses'],
 [/blazer|jacket|coat|sweat ?shirt|hoodie|sweater|cardigan|pullover|shrug|waistcoat|gilet/i,'Outerwear'],
 [/shoe|sneaker|sandal|flip ?flop|slipper|slider|loafer|heel|boot|mojari|jutti|kolhapuri|flats\b|clogs?/i,'Footwear'],
 [/belts?\b/i,'Belts'],
 [/bracelet|necklace|earring|ring\b|pendant|bangle|anklet|brooch|chain\b|jewell?ery|mangalsutra|nose ?pin/i,'Jewellery'],
 [/watch|sunglass|eyewear|caps?\b|hats?\b|beanie|scarf|stole|dupatta|ties?\b|pocket ?square|cufflink|wallet|bag|backpack|clutch|tote|handbag|gloves|mask/i,'Accessories'],
 [/trouser|jean|chino|short|track ?pant|jogger|pyjama|pajama|lounge ?pant|legging|jegging|skirt|salwar|palazzo|churidar|dhoti|cargo|pants?\b/i,'Trousers'],
 [/shirt|t-?shirt|tshirt|tee\b|top\b|tops\b|kurti|kurta|tunic|polo|blouse|henley|camisole|tank/i,'Shirts']
];

// Returns an app category, 'innerwear' (kept but unselected), or null (not clothing).
// Texts are tried in order, so a retailer's own type field ("Shirts") outranks words in
// a product title ("…Shirt with Mobile Pocket").
export function classify(...texts){
 for(const text of texts){if(!text)continue;for(const [re,category] of RULES)if(re.test(text))return category;}
 return 'unknown';
}

const https=url=>{if(typeof url!=='string'||!url)return '';const u=url.startsWith('//')?'https:'+url:url.replace(/^http:\/\//,'https://');try{return new URL(u).protocol==='https:'?u:'';}catch{return '';}};
const isoDate=v=>{if(v==null||v==='')return null;const n=Number(v);const d=new Date(Number.isFinite(n)&&String(v).trim()!==''?n:v);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);};
const clean=(s,max=120)=>typeof s==='string'?s.replace(/\s+/g,' ').trim().slice(0,max):'';

function toItem({retailer,productId,name,brand,type,size,color,image,productUrl,orderedAt,gender,category,flag,price=null}){
 const inner=category==='innerwear',unknown=category==='unknown';
 return {
  id:`order-${retailer}-${productId}`,
  retailer,productId:String(productId),
  name:clean(name,80)||'Untitled piece',brand:clean(brand,60),type:clean(type,40),
  category:inner||unknown?'Accessories':category,
  size:clean(size,20),color:clean(color,30),gender:clean(gender,20),
  image:https(image),productUrl:https(productUrl),orderedAt,price,
  selected:!inner&&!unknown&&!flag,
  warning:flag||(inner?'Innerwear · skipped unless you select it.':unknown?'Category unclear · check before saving.':'')
 };
}

// Keeps the most recent line per product: re-orders and size exchanges shouldn't double-count.
function dedupe(items){
 const byId=new Map();
 for(const item of items){const prev=byId.get(item.id);if(!prev||String(item.orderedAt||'')>String(prev.orderedAt||''))byId.set(item.id,item);}
 return [...byId.values()].sort((a,b)=>String(b.orderedAt||'').localeCompare(String(a.orderedAt||'')));
}

// Myntra: lines from window.__myx.omsServiceResponse.orderResponse.items, pre-picked in-page.
export function normalizeMyntra(lines){
 const out=[];
 for(const line of Array.isArray(lines)?lines:[]){
  const p=line?.product;if(!p?.id)continue;
  // Returned and cancelled lines never reached the wardrobe. Status 'IC' observed alongside cancellations.
  if(line.returned||line.cancelled||line.statusCode==='IC')continue;
  const category=classify(p.articleType,p.masterCategory==='Personal Care'?'personal care':'',p.masterCategory==='Free Items'?'free gift':'',p.masterCategory==='Home'?'blanket':'',p.name);
  if(!category)continue;
  const images=Array.isArray(p.images)?p.images:[];
  const image=(images.find(i=>i.view==='default')||images[0])?.src;
  out.push(toItem({retailer:'myntra',productId:p.id,name:p.name,brand:p.brand,type:p.articleType,size:p.size==='Onesize'?'':p.size,image,productUrl:`https://www.myntra.com/${encodeURIComponent(p.id)}`,orderedAt:isoDate(line.createdOn),gender:p.gender,category}));
 }
 return dedupe(out);
}

// Flipkart: orders from rome.api /self-serve/orders, pre-picked in-page.
export function normalizeFlipkart(orders){
 const out=[];
 for(const order of Array.isArray(orders)?orders:[]){
  if(order?.returned)continue;
  for(const p of Array.isArray(order?.products)?order.products:[]){
   if(!p?.id)continue;
   const category=classify(p.vertical,p.category,p.title);
   if(!category)continue;
   const url=typeof p.url==='string'&&p.url.startsWith('/')?'https://www.flipkart.com'+p.url:p.url;
   out.push(toItem({retailer:'flipkart',productId:p.id,name:p.title,brand:p.brand,type:p.vertical,size:p.size==='Free'?'':p.size,color:p.color,image:p.image,productUrl:url,orderedAt:isoDate(order.orderDate),category}));
  }
 }
 return dedupe(out);
}

// RFC 4180 CSV: quoted fields may hold commas, doubled quotes and newlines (Amazon's address columns do).
export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 const src=String(text).replace(/^﻿/,'');
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(quoted){if(ch==='"'){if(src[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=ch;continue;}
  if(ch==='"')quoted=true;
  else if(ch===',')row.push(field),field='';
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(field);field='';if(row.some(c=>c!==''))rows.push(row);row=[];}
  else field+=ch;
 }
 row.push(field);if(row.some(c=>c!==''))rows.push(row);
 return rows;
}

// Amazon "Request your data" → Your Orders → Retail.OrderHistory.*.csv.
// Only these columns are read; the file's address, payment and gift columns are ignored.
const AMAZON_COLUMNS={name:'product name',asin:'asin',date:'order date',status:'order status',price:'unit price',currency:'currency',website:'website'};
export function normalizeAmazon(csvText){
 const [header,...rows]=parseCsv(csvText);
 const at={};for(const [key,label] of Object.entries(AMAZON_COLUMNS))at[key]=(header||[]).findIndex(h=>h.trim().toLowerCase()===label);
 if(at.name<0||at.asin<0)throw new Error('This does not look like an Amazon order history file. Choose Retail.OrderHistory.1.csv from your Amazon data export.');
 const out=[];
 for(const r of rows){
  const name=r[at.name],asin=clean(r[at.asin],20);
  if(!asin||!name)continue;
  if(at.status>=0&&/cancel/i.test(r[at.status]))continue;
  // Amazon rows are mostly non-clothing and titles are the only signal, so unclear rows are dropped
  // rather than flooding the review screen.
  const category=classify(name);
  if(!category||category==='unknown')continue;
  const price=at.price>=0&&(at.currency<0||/INR|₹/i.test(r[at.currency]||'INR'))?Math.round(Number(String(r[at.price]).replace(/[^\d.]/g,'')))||null:null;
  const host=at.website>=0&&/amazon\.[a-z.]+/i.test(r[at.website])?r[at.website].match(/amazon\.[a-z.]+/i)[0].toLowerCase():'amazon.in';
  out.push(toItem({retailer:'amazon',productId:asin,name,type:'',image:'',productUrl:`https://www.${host}/dp/${encodeURIComponent(asin)}`,orderedAt:isoDate(at.date>=0?r[at.date]:''),category,price}));
 }
 return dedupe(out);
}

const priceOf=v=>{const n=Math.round(Number(String(v??'').replace(/[^\d.]/g,'')));return Number.isFinite(n)&&n>0&&n<10000000?n:null;};
// Stable ids for stores without a product id, so re-importing marks pieces as duplicates.
const hashId=s=>{let h=5381;for(const c of String(s))h=(h*33^c.charCodeAt(0))>>>0;return h.toString(36);};

// Slikk: orders captured from the page's own /user/order responses (see extension/observer.js).
export function normalizeSlikk(orders){
 const out=[];
 for(const o of Array.isArray(orders)?orders:[]){
  if(/cancel/i.test(o?.status||''))continue;
  // return_orders is order-level, so a two-item order with one return can't be told apart:
  // keep its items, unticked, for the user to decide.
  const flag=o?.returned?'This order had a return · tick it only if you kept this piece.':'';
  for(const i of Array.isArray(o?.items)?o.items:[]){
   const category=classify(i?.name);if(!i?.name||!category)continue;
   out.push(toItem({retailer:'slikk',productId:hashId(i.name+'|'+(i.image||'')),name:i.name,image:i.image,orderedAt:isoDate(o.date),category,price:priceOf(i.price),flag}));
  }
 }
 return dedupe(out);
}

// AJIO, Tata CLiQ and Nykaa Fashion: order endpoints are known but no test account had
// orders, so products are found by shape: any object with a product-like name and an
// image URL, inheriting status and date from the order that contains it.
const KEY={name:/^(product_?name|product_?title|productdisplayname|display_?name|item_?name|name|title)$/i,image:/image|img|thumb|picture|photo/i,brand:/^brand(_?name)?$/i,size:/^size(_?label|_?value|_?name)?$/i,price:/price|amount|mrp/i,status:/status/i,date:/date|placed|created|ordered/i,id:/^(product_?id|style_?id|sku(_?id)?|item_?id|product_?code|listing_?id|fsn|ussid)$/i};
const urlIn=v=>{if(typeof v==='string')return /^(https?:)?\/\//.test(v)?v:'';if(Array.isArray(v))for(const x of v){const u=urlIn(x);if(u)return u;}if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))if(/url|src|image|path/i.test(k)){const u=urlIn(x);if(u)return u;}return '';};
function findProducts(value,context={},out=[],depth=0){
 if(depth>14||!value||typeof value!=='object')return out;
 if(Array.isArray(value)){for(const v of value)findProducts(v,context,out,depth+1);return out;}
 const ctx={...context},entries=Object.entries(value);
 for(const [k,v] of entries){if(KEY.status.test(k)&&typeof v==='string')ctx.status=v;else if(KEY.date.test(k)&&(typeof v==='string'||typeof v==='number')&&!ctx.date)ctx.date=v;}
 const field=(re,ok)=>entries.find(([k,v])=>re.test(k)&&ok(v))?.[1];
 const name=field(KEY.name,v=>typeof v==='string'&&v.trim().length>=3&&v.length<=200&&!/^https?:/.test(v));
 const image=entries.filter(([k])=>KEY.image.test(k)).map(([,v])=>urlIn(v)).find(Boolean);
 if(name&&image){out.push({name,image,brand:field(KEY.brand,v=>typeof v==='string')||'',size:field(KEY.size,v=>typeof v==='string'||typeof v==='number')??'',price:priceOf(field(KEY.price,v=>typeof v==='number'||typeof v==='string')),id:field(KEY.id,v=>typeof v==='string'||typeof v==='number')??'',status:ctx.status||'',date:ctx.date??''});return out;}
 for(const [,v] of entries)findProducts(v,ctx,out,depth+1);
 return out;
}
export function normalizeGeneric(retailer,pages){
 const out=[];
 for(const p of findProducts(Array.isArray(pages)?pages:[])){
  if(/cancel|return|refund|rto/i.test(p.status))continue;
  // Tata CLiQ and others also sell electronics and home goods: drop anything not clearly clothing, as with Amazon.
  const category=classify(p.name);if(!category||category==='unknown')continue;
  out.push({...toItem({retailer,productId:String(p.id||hashId(p.name+'|'+p.image)),name:p.name,brand:p.brand,size:String(p.size),image:p.image,orderedAt:isoDate(p.date),category,price:p.price}),unverified:true});
 }
 return dedupe(out).map(i=>({...i,warning:i.warning||'Read with a new connector · check the name and category.'}));
}

export const normalizers={myntra:normalizeMyntra,flipkart:normalizeFlipkart,amazon:normalizeAmazon};
// Store connector batches (extension → /api/connectors) keyed by store id.
export const connectorNormalizers={
 myntra:d=>normalizeMyntra(d?.lines),flipkart:d=>normalizeFlipkart(d?.orders),slikk:d=>normalizeSlikk(d?.orders),
 ajio:d=>normalizeGeneric('ajio',d?.pages),tatacliq:d=>normalizeGeneric('tatacliq',d?.pages),nykaafashion:d=>normalizeGeneric('nykaafashion',d?.pages)
};
if(typeof window!=='undefined')window.OrderImport={classify,normalizeAmazon,normalizeMyntra,normalizeFlipkart,connectorNormalizers,CATEGORIES};
