import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import robotsParser from 'robots-parser';

const here=path.dirname(fileURLToPath(import.meta.url));
export const FEED_PATH=path.resolve(here,'../dist/assets/mall-updates.json');
export const BRAND_PATH=path.resolve(here,'../dist/discover-brands.js');
const USER_AGENT='BetterWardrobeMallBot/1.0 (+https://the-better-wardrobe-site.vercel.app/)';
const MAX_HTML=6_000_000;
const NON_FASHION=/\b(?:gift\s*card|voucher|tapestry|poster|sticker|mug|phone\s*case|keychain|umbrella|cushion|bedsheet|home\s*d[eé]cor|figurine|toy|perfume|fragrance)\b/i;
// Explicit official section URLs are only used when the homepage does not expose a link.
const VERIFIED_SECTIONS=new Map([[11,{designs:{url:'https://api.thesouledstore.com/tags/new-arrival',label:'New arrivals'}}]]);
const nowIso=()=>new Date().toISOString();
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,16);

export async function readBrands(file=BRAND_PATH){
 const source=await readFile(file,'utf8');
 const start=source.indexOf('Object.freeze(');
 if(start<0)throw new Error('Brand registry not found');
 const json=source.slice(start+'Object.freeze('.length,source.lastIndexOf(');'));
 return JSON.parse(json);
}

export async function readFeed(file=FEED_PATH){
 try{return JSON.parse(await readFile(file,'utf8'));}
 catch(error){if(error.code==='ENOENT')return {generatedAt:null,brands:{}};throw error;}
}

function safeUrl(value,base,host){
 try{const url=new URL(value,base);if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
  const domain=host.replace(/^www\./,'');
  if(url.hostname!==domain&&!url.hostname.endsWith(`.${domain}`))return null;
  url.hash='';return url.href;
 }catch{return null;}
}
function imageUrl(value,base){
 try{const url=new URL(value,base);if(!['https:','http:'].includes(url.protocol))return null;url.protocol='https:';return url.href;}catch{return null;}
}
function parseMoney(text){
 const match=clean(text).match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
 return match?Number(match[1].replace(/,/g,'')):null;
}
function ldNodes($){
 const nodes=[];
 $('script[type="application/ld+json"]').each((_,element)=>{
  try{const data=JSON.parse($(element).html());
   const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){nodes.push(value);if(value['@graph'])visit(value['@graph']);}};
   visit(data);
  }catch{/* malformed store metadata is ignored */}
 });
 return nodes;
}
function typeIs(node,type){return [].concat(node?.['@type']||[]).some(value=>String(value).toLowerCase()===type.toLowerCase());}
function productFromLd(node,base,host){
 if(!typeIs(node,'Product'))return null;
 const url=safeUrl(node.url||node['@id'],base,host);
 const title=clean(node.name);
 const image=imageUrl(Array.isArray(node.image)?node.image[0]:node.image?.url||node.image,base);
 if(!url||!title||!image)return null;
 const offers=Array.isArray(node.offers)?node.offers[0]:node.offers||{};
 const price=Number(offers.price||offers.lowPrice)||parseMoney(offers.priceSpecification?.price);
 const originalPrice=Number(node.priceRange?.maxPrice||offers.highPrice)||null;
 return {id:hash(url),title,url,image,price:price||null,originalPrice:price&&originalPrice>price?originalPrice:null,currency:clean(offers.priceCurrency)||'INR'};
}
function itemLinks($,base,host){
 const links=[];
 for(const node of ldNodes($))if(typeIs(node,'ItemList'))for(const item of node.itemListElement||[]){
  const url=safeUrl(item.url||item.item?.url,base,host);
  if(url&&/\/products?\//i.test(new URL(url).pathname))links.push({url,image:imageUrl(item.image||item.item?.image,base)});
 }
 $('a[href*="/product"]').each((_,element)=>{
  const url=safeUrl($(element).attr('href'),base,host);
  if(!url||!/\/products?\//i.test(new URL(url).pathname))return;
  const img=$(element).find('img').first();
  const image=imageUrl(img.attr('src')||img.attr('data-src')||img.attr('srcset')?.split(',')[0]?.trim().split(' ')[0],base);
  links.push({url,image});
 });
 return [...new Map(links.map(item=>[item.url,item])).values()].slice(0,18);
}
function sourceScore(text,href,kind){
 const haystack=`${text} ${href}`.toLowerCase();
 if(kind==='designs')return /new.arrivals|new.in|just.dropped|latest|new.collection|fresh.arrivals/.test(haystack)?3:/collection/.test(haystack)?1:0;
 return /sale|offers|discount|deals|clearance/.test(haystack)?3:0;
}
export function discoverSources(html,base,host){
 const $=load(html),sources={designs:null,offers:null};
 $('a[href]').each((_,element)=>{
  const url=safeUrl($(element).attr('href'),base,host);
  if(!url||url===base||/\/search|\/account|\/cart|\/checkout/i.test(new URL(url).pathname))return;
  const label=clean($(element).text()||$(element).attr('aria-label'));
  for(const kind of ['designs','offers']){
   const score=sourceScore(label,url,kind);
   if(score>(sources[kind]?.score||0))sources[kind]={url,label,score};
  }
 });
 return Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,value&&value.score>=3?value:null]));
}
function sitemapLocations(xml,base,host){
 const $=load(xml,{xmlMode:true});
 return $('loc').map((_,element)=>safeUrl(clean($(element).text()),base,host)).get().filter(Boolean);
}
async function discoverSitemapSources(base,host,crawler){
 const sources={designs:null,offers:null};
 const sitemap=`${new URL(base).origin}/sitemap.xml`;
 let root;
 try{root=await crawler.request(sitemap,host);}catch{return sources;}
 const locations=sitemapLocations(root,sitemap,host);
 const list=[...locations];
 for(const url of locations.filter(url=>/sitemap.*(collection|categor|page)/i.test(url)).slice(0,2)){
  try{list.push(...sitemapLocations(await crawler.request(url,host),url,host));}catch{/* a blocked sitemap is not a missing product claim */}
 }
 for(const url of list){
  for(const kind of ['designs','offers']){
   const score=sourceScore('',url,kind);
   if(score>(sources[kind]?.score||0))sources[kind]={url,label:new URL(url).pathname.split('/').pop().replace(/[-_]/g,' '),score};
  }
 }
 return Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,value&&value.score>=3?value:null]));
}

export function parseProducts(html,base,host){
 const $=load(html),fromLd=ldNodes($).map(node=>productFromLd(node,base,host)).filter(Boolean);
 if(fromLd.length){
  const originalPrice=parseMoney($('[class*="price--compare"], [class*="compare-at-price"], [class*="old-price"]').first().text());
  if(originalPrice>fromLd[0].price)fromLd[0].originalPrice=originalPrice;
 }
 if(fromLd.length)return fromLd;
 if(/\/products?\//i.test(new URL(base).pathname)){
  const title=clean($('meta[property="og:title"]').attr('content'));
  const image=imageUrl($('meta[property="og:image"]').attr('content'),base);
  const price=Number($('meta[property="product:price:amount"]').attr('content'))||null;
  const originalPrice=parseMoney($('[class*="price--compare"], [class*="compare-at-price"], [class*="old-price"]').first().text());
  if(title&&image)return [{id:hash(base),title,url:base,image,price,originalPrice:price&&originalPrice>price?originalPrice:null,currency:clean($('meta[property="product:price:currency"]').attr('content'))||'INR'}];
 }
 return itemLinks($,base,host).map(item=>({...item,id:hash(item.url)}));
}

export function classifyProducts(products,previous,checkedAt,kind,hasBaseline=false){
 const newWindowHours=Math.max(1,Number(process.env.MALL_NEW_WINDOW_HOURS)||72);
 const old=new Map((previous||[]).map(item=>[item.url,item]));
 const unique=[...new Map(products.filter(item=>item?.url&&item?.title&&item?.image&&!NON_FASHION.test(item.title)).map(item=>[item.url,item])).values()];
 return unique.slice(0,8).map(item=>{
  const prior=old.get(item.url);
  const row={id:item.id||hash(item.url),title:clean(item.title),url:item.url,image:item.image,
   price:Number.isFinite(item.price)?item.price:null,
   originalPrice:Number.isFinite(item.originalPrice)?item.originalPrice:null,
   currency:item.currency||'INR',firstSeenAt:prior?.firstSeenAt||checkedAt,
   sourceUrl:item.sourceUrl||null};
  if(kind==='designs')row.isNew=Boolean((!prior&&hasBaseline)||(prior?.isNew&&Date.parse(checkedAt)-Date.parse(row.firstSeenAt)<newWindowHours*3_600_000));
  if(kind==='offers'){
   if(!(row.originalPrice>row.price&&row.price>0))return null;
   row.discountPercent=Math.round(100*(row.originalPrice-row.price)/row.originalPrice);
   row.observedAt=checkedAt;
  }
  return row;
 }).filter(Boolean);
}

export function createMallCrawler({fetchImpl=fetch,delayMs=600,timeoutMs=12000}={}){
 const robotsCache=new Map(),lastRequest=new Map();
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function request(url,brandHost){
  const parsed=new URL(url),host=parsed.hostname;
  const domain=brandHost.replace(/^www\./,'');
  if(host!==domain&&!host.endsWith(`.${domain}`))throw new Error('Off-domain source');
  let robots=robotsCache.get(host);
  if(!robots){
   const robotsUrl=`${parsed.origin}/robots.txt`;
   try{const response=await fetchImpl(robotsUrl,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(timeoutMs)});
    robots=response.ok?robotsParser(robotsUrl,await response.text()):null;
   }catch{robots=null;}
   robotsCache.set(host,robots||false);
  }
  if(robots===undefined)robots=robotsCache.get(host);
  // A missing robots response is not permission to crawl an unknown store.
  if(!robots)throw new Error('Robots policy unavailable');
  if(robots.isAllowed(url,USER_AGENT)===false)throw new Error('Crawling disallowed');
  const wait=Math.max(0,delayMs-(Date.now()-(lastRequest.get(host)||0)));
  if(wait)await pause(wait);
  lastRequest.set(host,Date.now());
  const response=await fetchImpl(url,{headers:{'User-Agent':USER_AGENT,'Accept':'text/html'},signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
  if(!response.ok)throw new Error(`Source HTTP ${response.status}`);
  if(!safeUrl(response.url||url,url,brandHost))throw new Error('Off-domain redirect');
  const length=Number(response.headers?.get?.('content-length'));
  if(length>MAX_HTML)throw new Error('Source page too large');
  const html=await response.text();
  if(html.length>MAX_HTML)throw new Error('Source page too large');
  return html;
 }
 return {request};
}

export async function crawlBrand(brand,previous={},crawler=createMallCrawler(),checkedAt=nowIso()){
 const base=brand.url,host=new URL(base).hostname;
 const result={status:'empty',checkedAt,designs:[],offers:[],sources:{},error:null};
 try{
  const homepage=await crawler.request(base,host);
  const sources=discoverSources(homepage,base,host);
  for(const [kind,section] of Object.entries(VERIFIED_SECTIONS.get(brand.id)||{}))sources[kind]??=section;
  if(!sources.designs||!sources.offers){
   const fromSitemap=await discoverSitemapSources(base,host,crawler);
   sources.designs??=fromSitemap.designs;
   sources.offers??=fromSitemap.offers;
  }
  for(const kind of ['designs','offers']){
   const source=sources[kind];if(!source)continue;
   result.sources[kind]={url:source.url,label:source.label};
   try{
    const html=await crawler.request(source.url,host);
    const candidates=parseProducts(html,source.url,host).slice(0,4);
    const detailed=[];
    for(const candidate of candidates){
     if(candidate.title&&candidate.image&&candidate.price&&candidate.originalPrice){detailed.push(candidate);continue;}
     try{
      const page=await crawler.request(candidate.url,host);
      const product=parseProducts(page,candidate.url,host).find(item=>item.url===candidate.url);
      if(product)detailed.push({...candidate,...product});
     }catch{/* retain no unsupported product claim */}
    }
    result[kind]=classifyProducts(detailed.filter(item=>clean(item.title).toLowerCase()!==brand.name.toLowerCase()).map(item=>({...item,sourceUrl:source.url})),previous[kind],checkedAt,kind,previous?.status==='ok'&&Boolean(previous[kind]?.length));
   }catch(error){result.error=clean(error.message).slice(0,120);}
  }
  result.status=result.designs.length||result.offers.length?'ok':result.error?'error':'empty';
 }catch(error){result.status=/disallowed/i.test(error.message)?'blocked':'error';result.error=clean(error.message).slice(0,120);}
 if(['error','blocked'].includes(result.status)&&['ok','empty'].includes(previous?.status)){
  result.designs=result.designs.length?result.designs:previous.designs||[];
  result.offers=result.offers.length?result.offers:previous.offers||[];
  result.sources={...previous.sources,...result.sources};
  result.lastAttemptAt=checkedAt;
  result.checkedAt=previous.checkedAt;
 }
 return result;
}

export async function refreshMall({brands,previous,crawler=createMallCrawler(),at=nowIso(),onProgress=()=>{},concurrency=3}={}){
 brands??=await readBrands();previous??=await readFeed();
 const feed={generatedAt:at,brands:{...previous.brands}};
 let cursor=0;
 async function worker(){while(cursor<brands.length){
  const brand=brands[cursor++];
  feed.brands[brand.id]=await crawlBrand(brand,previous.brands?.[brand.id],crawler,at);
  onProgress(brand,feed.brands[brand.id]);
 }}
 await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),brands.length)},worker));
 return feed;
}
export async function saveFeed(feed,file=FEED_PATH){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(feed,null,2)+'\n');}
