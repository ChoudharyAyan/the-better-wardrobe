// Where the Mall's daily feed lives (owner, 15 Oct 2026: "regular refresh of malls, a daily job").
// The GitHub workflow used to propose the feed as a pull request, which the repo refuses ("GitHub Actions is not
// permitted to create pull requests"), so the Mall stayed frozen at 5 Oct. Now a Vercel cron runs the crawl
// (GET /api/mall/refresh) and saves the feed here; /api/mall/updates reads it, falling back to the bundled
// snapshot in dist/assets/mall-updates.json.
function postgresStore(connection){
 let pool,ready;
 const db=async()=>{if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:2,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}
  ready??=pool.query('CREATE TABLE IF NOT EXISTS tbw_mall_feed (id text PRIMARY KEY, feed jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');await ready;return pool;};
 return {
  async get(){const r=(await (await db()).query("SELECT feed FROM tbw_mall_feed WHERE id='current'")).rows[0];return r?.feed||null;},
  async put(feed){await (await db()).query("INSERT INTO tbw_mall_feed (id,feed,updated_at) VALUES ('current',$1::jsonb,now()) ON CONFLICT (id) DO UPDATE SET feed=EXCLUDED.feed, updated_at=now()",[JSON.stringify(feed)]);}
 };
}
function memoryStore(){let saved=null;return {async get(){return saved;},async put(feed){saved=JSON.parse(JSON.stringify(feed));}};}

export function createMallStore({env=process.env,store}={}){
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 store??=connection?postgresStore(connection):memoryStore();
 let cache=null,cachedAt=0;
 return {
  // Cached for a minute per server instance; a failed read falls back to whatever the caller has.
  async latest(now=Date.now()){
   if(cache&&now-cachedAt<60_000)return cache;
   try{const feed=await store.get();if(feed?.generatedAt){cache=feed;cachedAt=now;}return feed;}catch{return cache;}
  },
  async save(feed){await store.put(feed);cache=feed;cachedAt=Date.now();}
 };
}

// "Today in the Mall": the newest arrivals and the biggest current offers, at most one per store, so the Mall
// opens on something worth tapping rather than a map.
export function todayInMall(feed,brands=[],count=6){
 const names=new Map(brands.map(b=>[String(b.id),b]));
 const rows=Object.entries(feed?.brands||{}).filter(([,b])=>b&&['ok','error','blocked'].includes(b.status));
 const pick=(kind,score)=>{
  const seen=new Set(),out=[];
  const items=rows.flatMap(([id,b])=>(b[kind]||[]).map(item=>({...item,brandId:id,store:names.get(String(id))?.name||'',storeUrl:names.get(String(id))?.url||''}))).filter(item=>item.url&&item.image&&item.title);
  for(const item of items.sort(score)){if(seen.has(item.brandId))continue;seen.add(item.brandId);out.push(item);if(out.length>=count)break;}
  return out;
 };
 return {
  generatedAt:feed?.generatedAt||null,
  arrivals:pick('designs',(a,b)=>Number(Boolean(b.isNew))-Number(Boolean(a.isNew))||Date.parse(b.firstSeenAt||0)-Date.parse(a.firstSeenAt||0)),
  offers:pick('offers',(a,b)=>(b.discountPercent||0)-(a.discountPercent||0))
 };
}

// Who a Mall item is for: the title's own words first, then the store's district; otherwise everyone.
const WOMEN=/\b(women|womens|woman|ladies|girls?|her|kurti|kurta set for women|saree|sari|lehenga|dupatta|anarkali|blouse|skirt|dress(es)?|bra|lingerie|crop top|co-?ord set for women|palazzo|salwar)\b/i;
const MEN=/\b(men|mens|man|boys?|his|sherwani|bandhgala|nehru jacket|lungi|boxers?|briefs?)\b/i;
export function audienceOf(item,brand){
 const t=String(item?.title||'');const w=WOMEN.test(t),m=MEN.test(t)&&!/\bwomen\b/i.test(t);
 if(w&&!m)return 'womenswear';if(m&&!w)return 'menswear';
 if(/menswear/i.test(brand?.category||''))return 'menswear';if(/womenswear/i.test(brand?.category||''))return 'womenswear';
 return 'unisex';
}

// The full-screen board behind "Today in the Mall" (owner, 15 Oct 2026: endless, Pinterest-style, "On offer" and
// "Curated designs for <name>", filtered by Men or Women). Pages of 24. Curated mixes stores (no two from the same
// store in a row where possible), newest first, in a daily order so a refresh doesn't reshuffle what you saw.
export function mallBoard(feed,brands=[],{kind='curated',audience='',page=0,size=24,day=new Date().toISOString().slice(0,10)}={}){
 const byId=new Map(brands.map(b=>[String(b.id),b]));
 const want=['menswear','womenswear'].includes(audience)?audience:'';
 const all=[];
 for(const [id,b] of Object.entries(feed?.brands||{})){
  if(!b||!['ok','error','blocked'].includes(b.status))continue;const brand=byId.get(String(id));
  for(const k of kind==='offers'?['offers']:['designs','offers'])for(const item of b[k]||[]){
   if(!item?.url||!item.image||!item.title)continue;
   const who=audienceOf(item,brand);if(want&&who!=='unisex'&&who!==want)continue;
   all.push({id:item.id||item.url,url:item.url,image:item.image,title:item.title,price:item.price??null,originalPrice:item.originalPrice??null,discountPercent:item.discountPercent??null,isNew:Boolean(item.isNew),store:brand?.name||'',brandId:String(id),audience:who,kind:k});
  }
 }
 const seen=new Set(),unique=all.filter(i=>!seen.has(i.url)&&seen.add(i.url));
 const hash=s=>{let h=2166136261;for(const c of s+day)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 let ordered;
 if(kind==='offers')ordered=unique.sort((a,b)=>(b.discountPercent||0)-(a.discountPercent||0));
 else{
  const groups=new Map();for(const i of unique.sort((a,b)=>Number(b.isNew)-Number(a.isNew)||hash(a.url)-hash(b.url))){if(!groups.has(i.brandId))groups.set(i.brandId,[]);groups.get(i.brandId).push(i);}
  const lanes=[...groups.values()].sort((a,b)=>hash(a[0].brandId)-hash(b[0].brandId));ordered=[];
  for(let r=0;lanes.some(l=>l[r]);r++)for(const l of lanes)if(l[r])ordered.push(l[r]);
 }
 const start=Math.max(0,page|0)*size;
 return {kind,audience:want,total:ordered.length,items:ordered.slice(start,start+size),next:start+size<ordered.length?page+1:null,generatedAt:feed?.generatedAt||null};
}
