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
