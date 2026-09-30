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
  for(const p of Array.isArray(order?.products)?order.products:[]){
   if(!p?.id)continue;
   const category=classify(p.vertical,p.category,p.title);
   if(!category)continue;
   const url=typeof p.url==='string'&&p.url.startsWith('/')?'https://www.flipkart.com'+p.url:p.url;
   // Return state isn't mapped to a field yet; the in-page picker flags orders whose units mention a return/refund.
   out.push(toItem({retailer:'flipkart',productId:p.id,name:p.title,brand:p.brand,type:p.vertical,size:p.size,color:p.color,image:p.image,productUrl:url,orderedAt:isoDate(order.orderDate),category,flag:order.returnHint?'Flipkart shows a return or refund on this order · select only if you kept it.':''}));
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

export const normalizers={myntra:normalizeMyntra,flipkart:normalizeFlipkart,amazon:normalizeAmazon};
if(typeof window!=='undefined')window.OrderImport={classify,normalizeAmazon,normalizeMyntra,normalizeFlipkart,CATEGORIES};
