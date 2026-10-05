import {readBrands,readFeed,refreshMall,saveFeed} from '../lib/mall-feed.mjs';

const flags=new Map(process.argv.slice(2).map(arg=>{const [key,...rest]=arg.replace(/^--/,'').split('=');return [key,rest.length?rest.join('='):true];}));
const numberFlag=(name,fallback)=>{const value=Number(flags.get(name)??fallback);if(!Number.isFinite(value)||value<0)throw new Error(`Invalid --${name}`);return value;};
const force=flags.has('force');
const dryRun=flags.has('dry-run');
const dueHours=numberFlag('due-hours',process.env.MALL_REFRESH_HOURS||24);
const concurrency=numberFlag('concurrency',3);
const limit=numberFlag('limit',100);
const target=String(flags.get('brand')||'').toLowerCase();
const statusFilter=String(flags.get('status')||'').toLowerCase();
const brands=await readBrands();
const previous=await readFeed();
const at=new Date().toISOString();
const due=brands.filter(brand=>{
 if(target&&!([String(brand.id),brand.name.toLowerCase()].includes(target)))return false;
 if(statusFilter&&previous.brands?.[brand.id]?.status!==statusFilter)return false;
 const checked=Date.parse(previous.brands?.[brand.id]?.checkedAt||'');
 return force||!Number.isFinite(checked)||Date.now()-checked>=dueHours*3_600_000;
}).slice(0,limit);
if(target&&!brands.some(brand=>[String(brand.id),brand.name.toLowerCase()].includes(target)))throw new Error(`Unknown brand: ${target}`);
console.log(`Mall refresh: ${due.length}/${brands.length} brands due; interval ${dueHours}h${dryRun?' (dry run)':''}.`);
if(due.length){
 const feed=await refreshMall({brands:due,previous,at,concurrency,onProgress:(brand,row)=>console.log(`${brand.id} ${brand.name}: ${row.status} · ${row.designs.length} designs · ${row.offers.length} offers`)});
 if(!dryRun){await saveFeed(feed);console.log('Mall feed saved.');}
}
