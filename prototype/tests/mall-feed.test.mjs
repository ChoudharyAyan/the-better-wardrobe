import test from 'node:test';
import assert from 'node:assert/strict';
import {readBrands,readFeed,discoverSources,parseProducts,classifyProducts,crawlBrand,createMallCrawler} from '../lib/mall-feed.mjs';

const brand={id:67,name:'Libas',url:'https://www.libas.in/',focus:'Ethnic wear',category:'Ethnic wear'};
const home='<a href="/collections/new-arrivals">New arrivals</a><a href="/collections/sale">Sale</a>';
const listing='<script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{'@type':'ListItem',url:'https://www.libas.in/products/blue-suit',image:'https://www.libas.in/blue.jpg'}]})+'</script>';
const product=(name='Blue suit')=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product','@id':'https://www.libas.in/products/blue-suit',name,image:'https://www.libas.in/blue.jpg',offers:{price:'1200',priceCurrency:'INR'}})+'</script><span class="product__price--compare">₹2,000</span>';

test('mall registry covers 100 official store links',async()=>{
 const brands=await readBrands();assert.equal(brands.length,100);assert.ok(brands.find(item=>item.name==='Libas'));
});
test('published feed contains only official product links and real image URLs',async()=>{
 const brands=await readBrands(),feed=await readFeed();
 for(const brand of brands){
  const row=feed.brands[brand.id];if(!row)continue;
  const host=new URL(brand.url).hostname.replace(/^www\./,'');
  for(const item of [...row.designs,...row.offers]){
   assert.equal(new URL(item.url).hostname.replace(/^www\./,''),host,`${brand.name} product domain`);
   assert.ok(['https:','http:'].includes(new URL(item.image).protocol));
   assert.ok(item.title.length>2);
  }
 }
});
test('source discovery and structured-data parsing keep store URLs and verified prices',()=>{
 const sources=discoverSources(home,brand.url,'www.libas.in');
 assert.equal(sources.designs.url,'https://www.libas.in/collections/new-arrivals');
 assert.equal(sources.offers.url,'https://www.libas.in/collections/sale');
 const [item]=parseProducts(product(),'https://www.libas.in/products/blue-suit','www.libas.in');
 assert.equal(item.title,'Blue suit');assert.equal(item.price,1200);assert.equal(item.originalPrice,2000);
 assert.equal(parseProducts(product().replaceAll('www.libas.in','other.example'),'https://www.libas.in/products/blue-suit','www.libas.in').length,0);
});
test('a successful baseline does not falsely label designs newly launched; later unseen products do',async()=>{
 const crawler={request:async url=>url===brand.url?home:url.includes('/collections/')?listing:product()};
 const first=await crawlBrand(brand,{},crawler,'2026-10-05T00:00:00.000Z');
 assert.equal(first.status,'ok');assert.equal(first.designs.length,1);assert.equal(first.designs[0].isNew,false);
 assert.equal(first.offers[0].discountPercent,40);
 const second=await crawlBrand(brand,first,crawler,'2026-10-06T00:00:00.000Z');
 assert.equal(second.designs[0].isNew,false);assert.equal(second.designs[0].firstSeenAt,first.designs[0].firstSeenAt);
 const added=classifyProducts([{title:'New dress',url:'https://www.libas.in/products/new-dress',image:'https://www.libas.in/new.jpg'}],first.designs,'2026-10-06T00:00:00.000Z','designs',true);
 assert.equal(added[0].isNew,true);
 assert.equal(classifyProducts([{title:'New dress',url:'https://www.libas.in/products/new-dress',image:'https://www.libas.in/new.jpg'}],[],'2026-10-06T00:00:00.000Z','designs',false)[0].isNew,false);
 assert.equal(classifyProducts([{title:'Gift card',url:'https://www.libas.in/products/gift-card',image:'https://www.libas.in/card.jpg'}],[],'2026-10-06T00:00:00.000Z','designs',false).length,0);
});
test('a failed refresh preserves previous cards but marks them stale',async()=>{
 const previous={status:'ok',checkedAt:'2026-10-05T00:00:00.000Z',designs:[{title:'Blue suit'}],offers:[],sources:{}};
 const row=await crawlBrand(brand,previous,{request:async()=>{throw Error('Crawling disallowed');}},'2026-10-06T00:00:00.000Z');
 assert.equal(row.status,'blocked');assert.equal(row.checkedAt,previous.checkedAt);assert.equal(row.lastAttemptAt,'2026-10-06T00:00:00.000Z');assert.equal(row.designs.length,1);
});
test('sitemap discovers official new-arrivals and sale pages when a homepage is script-rendered',async()=>{
 const crawler={request:async url=>{
  if(url===brand.url)return '<html>No navigation rendered</html>';
  if(url.endsWith('/sitemap.xml'))return '<sitemapindex><sitemap><loc>https://www.libas.in/sitemap_collections.xml</loc></sitemap></sitemapindex>';
  if(url.endsWith('/sitemap_collections.xml'))return '<urlset><url><loc>https://www.libas.in/collections/new-arrivals</loc></url><url><loc>https://www.libas.in/collections/sale</loc></url></urlset>';
  if(url.includes('/collections/'))return listing;
  return product();
 }};
 const row=await crawlBrand(brand,{},crawler,'2026-10-05T00:00:00.000Z');
 assert.equal(row.status,'ok');assert.equal(row.designs.length,1);assert.equal(row.offers.length,1);
});
test('crawler honors robots before visiting a source and rejects cross-domain links',async()=>{
 const calls=[];
 const fetchImpl=async url=>{calls.push(url);return new Response(url.endsWith('/robots.txt')?'User-agent: *\nDisallow: /private\n':'<html>ok</html>',{status:200,headers:{'content-type':'text/html'}});};
 const crawler=createMallCrawler({fetchImpl,delayMs:0});
 assert.match(await crawler.request('https://www.libas.in/collections/new-arrivals','www.libas.in'),/ok/);
 await assert.rejects(()=>crawler.request('https://www.libas.in/private','www.libas.in'),/disallowed/);
 await assert.rejects(()=>crawler.request('https://attacker.example/','www.libas.in'),/Off-domain/);
 assert.deepEqual(calls,['https://www.libas.in/robots.txt','https://www.libas.in/collections/new-arrivals']);
});
