import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscovery,attributes,imageData,safeURL,normalize,dedupe,matchScore,productMetadata,searchIntent,titleRejection} from '../lib/discovery.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXmQAAAAASUVORK5CYII=';
const attr={category:'Shirt',colour:'pastel blue',fit:'relaxed',pattern:'solid',details:'long sleeves'};
const response=data=>({ok:true,json:async()=>data});
const results=Array.from({length:6},(_,i)=>({title:'Pastel blue relaxed shirt '+i,link:'https://www.myntra.com/shirt/'+i,thumbnail:'https://images.example.com/'+i+'.jpg',source:'Myntra',price:'₹1,499',extracted_price:1499}));
const schemaPage=(stock='InStock')=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Blue shirt',offers:{price:1499,priceCurrency:'INR',availability:'https://schema.org/'+stock}})}</script>`;
test('input validation rejects unsafe URLs, invalid categories and disguised images',()=>{
 for(const url of ['javascript:alert(1)','http://shop.com','https://localhost','https://127.0.0.1','https://user:pass@shop.com','https://shop.com:8080'])assert.equal(safeURL(url),'');
 assert.equal(safeURL('https://www.myntra.com/p'),'https://www.myntra.com/p');
 assert.throws(()=>attributes({category:''}));assert.throws(()=>imageData('data:image/png;base64,SGVsbG8gdGhpcyBpcyBub3QgYW4gaW1hZ2U='));assert.equal(imageData(image).type,'image/png');
});
test('rank weights ignore unknown attributes and never imply certainty from sparse evidence',()=>{
 assert.equal(matchScore({visual:1,colour:1}),null);assert.equal(matchScore({visual:1,fit:1,colour:0,pattern:1,details:1}),80);assert.equal(matchScore({visual:2,fit:1}),null);
});
test('normalization keeps only real HTTPS links and removes tracking duplicates',()=>{
 const rows=normalize({shopping_results:[...results,{title:'bad',link:'javascript:bad'}, {...results[0],link:results[0].link+'?utm_source=foo'}]},'shopping','in');assert.equal(dedupe(rows).length,6);assert.equal(rows[0].verified,false);
});
test('metadata extraction declines ambiguous product collections',()=>{
 assert.equal(productMetadata(schemaPage()).currency,'INR');assert.equal(productMetadata(schemaPage()+schemaPage()),null);assert.equal(productMetadata('<html>Blocked</html>'),null);
});
test('metadata falls back to OpenGraph tags when JSON-LD is missing or incomplete',()=>{
 const ogPage='<meta property="og:title" content="Blue shirt"><meta property="product:price:amount" content="1499"><meta property="product:price:currency" content="INR"><meta property="product:availability" content="https://schema.org/InStock">';
 const og=productMetadata(ogPage);
 assert.equal(og.title,'Blue shirt');assert.equal(og.price,1499);assert.equal(og.currency,'INR');assert.equal(og.stock,'InStock');
 assert.equal(productMetadata('<meta content="Blue shirt" property="og:title"><meta content="999" property="og:price:amount">').price,999);
 assert.equal(productMetadata('<html>No tags here</html>'),null);
 const schemaMissingPrice=`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Blue shirt',offers:{priceCurrency:'',availability:''}})}</script><meta property="og:price:amount" content="1299">`;
 assert.equal(productMetadata(schemaMissingPrice).price,1299);
});
test('missing credentials are explicit and no provider calls occur',async()=>{
 const d=createDiscovery({env:{},fetcher:()=>assert.fail('No network without keys')});assert.deepEqual(d.status(),{vision:false,visionProvider:'gemini',shopping:false,lens:false,model:'gemini-3.5-flash',developerDashboard:false,dataMode:'live'});await assert.rejects(d.analyze({image,category:'Shirt'}),/Gemini/);await assert.rejects(d.search({attributes:attr}),/SerpApi/);
});
test('manual India search retains unknown availability and excludes above-budget prices',async()=>{
 const calls=[];const d=createDiscovery({env:{SERPAPI_API_KEY:'test'},fetcher:async url=>{calls.push(new URL(url));return response({shopping_results:results});},pageFetcher:async()=>{throw Error('blocked')}});
 const data=await d.search({attributes:attr,market:'in',budget:1000});assert.equal(data.results.length,0);assert.equal(calls[0].searchParams.get('gl'),'in');assert.ok(calls[0].searchParams.get('q').includes('pastel blue'));
});
test('full retrieval combines routes, expires crop, and derives scores from supplied evidence',async()=>{
 let uploadId;let d;
 const fetcher=async(url,opts)=>{if(String(url).includes('generativelanguage.googleapis.com')){const body=JSON.parse(opts.body);assert.equal(body.store,false);const ids=body.contents[0].parts.filter(c=>c.text?.startsWith('{')).map(c=>JSON.parse(c.text).id);return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({matches:ids.map(id=>({id,categoryMatch:true,essentialMismatch:false,visual:1,fit:1,colour:1,pattern:1,details:0.5,reason:'Similar colour and silhouette; collar differs.'}))})}]}}]});}const u=new URL(url);if(u.searchParams.get('engine')==='google_lens'){uploadId=new URL(u.searchParams.get('url')).pathname.split('/').pop();assert.ok(d.getImage(uploadId));return response({visual_matches:[{...results[0],link:'https://global.example.com/shirt'}]});}return response({shopping_results:results});};
 d=createDiscovery({env:{GEMINI_API_KEY:'test',SERPAPI_API_KEY:'test',PUBLIC_BASE_URL:'https://preview.example.com'},fetcher,imageFetcher:async()=>({data:image.split(',')[1],mimeType:'image/png'}),pageFetcher:async()=>schemaPage()});
 const data=await d.search({attributes:attr,image,market:'us'});assert.equal(d.getImage(uploadId),undefined);assert.equal(data.results[0].score,95);assert.equal(data.results[0].match,'Very close vibe');assert.ok(data.results.some(p=>p.market==='global'));assert.ok(data.results[0].availability.includes('confirm delivery'));assert.ok(!JSON.stringify(data).includes('test'));
});
test('provider failures yield partial results, never substitute sample products',async()=>{
 const d=createDiscovery({env:{SERPAPI_API_KEY:'test',PUBLIC_BASE_URL:'https://preview.example.com'},fetcher:async url=>new URL(url).searchParams.get('engine')==='google_lens'?{ok:false,status:429}:response({shopping_results:results}),pageFetcher:async()=>schemaPage('OutOfStock')});const data=await d.search({attributes:attr,image,market:'us'});assert.equal(data.results.length,0);assert.ok(data.warnings.some(s=>s.includes('lens search was slow')));
});
test('merchant enrichment resolves supplied tokens, retains correct retailer link',async()=>{
 let resolved=false;const d=createDiscovery({env:{SERPAPI_API_KEY:'test'},fetcher:async url=>new URL(url).searchParams.get('engine')==='google_immersive_product'?response({product_results:{stores:[{name:'Brand',link:'https://brand.example.com/blue-shirt',price:'₹900',extracted_price:900}]}}):response({shopping_results:[{...results[0],link:'https://www.google.com/shopping/product/1',immersive_product_page_token:'token'},...results.slice(1)]}),pageFetcher:async url=>{if(url==='https://brand.example.com/blue-shirt')resolved=true;throw Error('not checked')}});const data=await d.search({attributes:attr,market:'us'});assert.ok(resolved);assert.ok(data.results.length);assert.ok(data.results.every(p=>!('pageToken'in p)));
});
test('hourly cap bounds public preview operations',async()=>{
 const d=createDiscovery({env:{SERPAPI_API_KEY:'test',DISCOVERY_HOURLY_LIMIT:'1'},fetcher:async()=>response({shopping_results:results}),pageFetcher:async()=>''});await d.search({attributes:attr});await assert.rejects(d.search({attributes:attr}),/hourly/);
});
test('detect locates multiple items and converts normalized boxes to crop percentages',async()=>{
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:[{label:'Dress',box:[100,50,600,900]},{label:'Bracelet',box:[650,700,900,780]},{label:'bad',box:[1,1]}]})}]}}]})});
 const out=await d.detect({image});
 assert.equal(out.items.length,2);assert.equal(out.items[0].label,'Dress');
 assert.equal(out.items[0].crop.left,10);assert.equal(out.items[0].crop.top,5);assert.equal(out.items[0].crop.width,50);assert.equal(out.items[0].crop.height,85);
});
test('detect declines items with empty labels or degenerate boxes',async()=>{
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:[{label:'',box:[0,0,100,100]},{label:'Tiny',box:[0,0,10,10]},{label:'Flipped',box:[500,500,100,100]}]})}]}}]})});
 assert.equal((await d.detect({image})).items.length,0);
});
test('Gemini analysis uses inline images, structured output and header-only credentials',async()=>{
 let sent;
 const d=createDiscovery({env:{GEMINI_API_KEY:'secret-test'},fetcher:async(url,opts)=>{sent={url,opts,body:JSON.parse(opts.body)};return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...attr,uncertainty:'Fabric unknown'})}]}}]});}});
 assert.equal((await d.analyze({image,category:'Shirt'})).colour,'pastel blue');
 assert.ok(sent.url.includes('generativelanguage.googleapis.com'));assert.ok(!sent.url.includes('secret-test'));assert.equal(sent.opts.headers['x-goog-api-key'],'secret-test');assert.ok(sent.body.contents[0].parts.some(p=>p.inlineData));assert.equal(sent.body.generationConfig.responseMimeType,'application/json');
});
test('local Ollama analysis sends images locally and parses structured thinking output',async()=>{
 let sent;const d=createDiscovery({env:{VISION_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3-vl:2b'},fetcher:async(url,opts)=>{sent={url:String(url),body:JSON.parse(opts.body)};return response({message:{content:'',thinking:JSON.stringify({...attr,subtype:'shirt',uncertainty:''})}});}});
 const out=await d.analyze({image,category:'Shirt'});assert.equal(out.colour,'pastel blue');assert.equal(sent.url,'http://127.0.0.1:11434/api/chat');assert.equal(sent.body.model,'qwen3-vl:2b');assert.equal(sent.body.stream,false);assert.ok(sent.body.messages.some(m=>m.images?.length));assert.equal(d.status().visionProvider,'ollama');
});
test('developer observability records sanitized local provider telemetry',async()=>{
 let tick=1000;const d=createDiscovery({env:{VISION_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3-vl:2b',DEVELOPER_DASHBOARD:'true'},now:()=>tick,fetcher:async()=>{tick+=27;return response({message:{content:JSON.stringify({...attr,subtype:'shirt',uncertainty:''})}});}});
 await d.analyze({image,category:'Shirt'});const dashboard=d.observability();assert.equal(dashboard.enabled,true);assert.equal(dashboard.totals.requests,1);assert.equal(dashboard.providers[0].provider,'Ollama');assert.equal(dashboard.providers[0].averageMs,27);assert.equal(dashboard.recentRequests[0].operation,'garment');assert.ok(!JSON.stringify(dashboard).includes(image));
});
test('Gemini quota exhaustion stops after one call without fallback',async()=>{
 let count=0;const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>{count++;return {ok:false,status:429};}});
 await assert.rejects(d.analyze({image,category:'Shirt'}),/no paid fallback/);assert.equal(count,1);
});
test('a transient provider 503 is retried once without losing the request',async()=>{
 let count=0;const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>{count++;return count===1?{ok:false,status:503}:response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...attr,uncertainty:''})}]}}]});}});
 const out=await d.analyze({image,category:'Shirt'});assert.equal(count,2);assert.equal(out.colour,'pastel blue');
});
test('empty detailed shopping query broadens even when Lens has many results',async()=>{
 let shoppingCalls=0;const d=createDiscovery({env:{SERPAPI_API_KEY:'test',PUBLIC_BASE_URL:'https://preview.example.com'},fetcher:async url=>{const u=new URL(url);if(u.searchParams.get('engine')==='google_lens')return response({visual_matches:results});shoppingCalls++;return shoppingCalls===1?response({error:"Google hasn't returned any results for this query."}):response({shopping_results:results.map(p=>({...p,link:p.link+'/local'}))});},pageFetcher:async()=>''});const data=await d.search({attributes:attr,image,market:'us'});assert.equal(shoppingCalls,2);assert.equal(data.trace.retrieved,12);assert.equal(data.results.length,8);assert.equal(data.trace.usedRelatedFallback,true);assert.ok(data.results.every(p=>p.score===null));assert.ok(!data.warnings.some(w=>w.includes('shopping search failed')));
});

test('vest search retains subtype and rejects screenshot regression cases',()=>{
 const a={category:'Jacket',subtype:'',colour:'dark brown',fit:'regular',pattern:'plain',details:'sleeveless vest with a sherpa fleece-lined collar'};
 assert.ok(searchIntent(a).query.includes('vest'));assert.ok(searchIntent(a).fallback.includes('vest'));assert.ok(!searchIntent(a).fallback.includes('Jacket'));
 assert.ok(titleRejection({title:'Brown full sleeve jacket'},a));assert.ok(titleRejection({title:'Monte Carlo brown SelfDesign vest'},a));assert.equal(titleRejection({title:'Brown sherpa collar workwear vest'},a),'');
});
test('features field extends essential-feature detection beyond the built-in regex vocabulary',()=>{
 const a={category:'Shirt',subtype:'camp-collar shirt',colour:'olive',fit:'relaxed',pattern:'solid',details:'',features:'chest pocket, cropped length'};
 const intent=searchIntent(a);
 assert.ok(intent.essential.includes('chest pocket'));assert.ok(intent.essential.includes('cropped length'));assert.ok(intent.query.includes('chest pocket'));
});
test('wrong type, conflicting details and weak matches are excluded; no unscored padding',async()=>{
 const d=createDiscovery({env:{GEMINI_API_KEY:'test',SERPAPI_API_KEY:'test'},imageFetcher:async()=>({data:image.split(',')[1],mimeType:'image/png'}),pageFetcher:async()=>'',fetcher:async(url,opts)=>{if(!String(url).includes('googleapis'))return response({shopping_results:results});const ids=JSON.parse(opts.body).contents[0].parts.filter(p=>p.text?.startsWith('{')).map(p=>JSON.parse(p.text).id);return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({matches:ids.slice(0,4).map((id,i)=>({id,categoryMatch:i!==0,essentialMismatch:i===1,visual:i===2?0.3:0.9,fit:0.9,colour:0.9,pattern:1,details:1,reason:'Fixture assessment'}))})}]}}]});}});
 const stages=[];const out=await d.search({attributes:attr,image,market:'us'},p=>stages.push(p.percent));assert.equal(out.results.length,1);assert.equal(out.trace.unassessed,2);assert.equal(out.results[0].breakdown.length,5);assert.equal(stages.at(-1),100);assert.deepEqual(stages,[...stages].sort((a,b)=>a-b));
});

test('India excludes import aggregators and foreign storefronts',async()=>{
 const {domesticRetailer}=await import('../lib/discovery.mjs');
 for(const url of ['https://www.desertcart.in/products/123','https://www.ubuy.co.in/product/123','https://amazon.com/dp/123','https://www.hm.com/us/item'])assert.equal(domesticRetailer({url,title:'Suit'}),false);
 for(const url of ['https://www.myntra.com/suits/123','https://amazon.in/dp/123','https://louisphilippe.abfrl.in/p/suit'])assert.equal(domesticRetailer({url,title:'Suit'}),true);
 assert.equal(domesticRetailer({url:'https://amazon.in/dp/123',title:'Imported global store suit'}),false);
});

test('India search retains and ranks a stronger global fallback',async()=>{
 const domestic={title:'Pastel blue relaxed shirt India',link:'https://www.myntra.com/shirt/india',thumbnail:'https://images.example.com/india.jpg',source:'Myntra'};
 const worldwide={title:'Pastel blue relaxed shirt Global',link:'https://global.example.com/shirt',thumbnail:'https://images.example.com/global.jpg',source:'Global Shop'};
 const d=createDiscovery({env:{GEMINI_API_KEY:'test',SERPAPI_API_KEY:'test'},imageFetcher:async()=>({data:image.split(',')[1],mimeType:'image/png'}),pageFetcher:async url=>url.includes('myntra.com')?schemaPage():'',fetcher:async(url,opts)=>{
  if(!String(url).includes('googleapis')){const q=new URL(url).searchParams.get('q')||'';return response({images_results:[q.includes('site:')?domestic:worldwide]});}
  const pieces=JSON.parse(opts.body).contents[0].parts.filter(p=>p.text?.startsWith('{')).map(p=>JSON.parse(p.text));
  return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({matches:pieces.map(p=>({id:p.id,categoryMatch:true,essentialMismatch:false,visual:p.title.includes('Global')?1:.8,fit:.9,colour:1,pattern:1,details:.9,reason:'Fixture comparison'}))})}]}}]});
 }});
 const out=await d.search({attributes:attr,image,market:'in'});
 assert.equal(out.results[0].market,'in');assert.ok(out.results.some(p=>p.market==='global'));assert.equal(out.results.filter(p=>p.market==='global').length,1);assert.ok(out.warnings.some(w=>w.includes('Global matches')));
 assert.equal(out.results.find(p=>p.market==='in').verified,true);
});

test('slow fast-path providers get a longer Lens rescue and return visual leads',async()=>{
 let lensCalls=0;const d=createDiscovery({env:{SERPAPI_API_KEY:'test',PUBLIC_BASE_URL:'https://preview.example.com'},pageFetcher:async()=>'',fetcher:async url=>{
  const engine=new URL(url).searchParams.get('engine');if(engine==='google_lens'&&++lensCalls===2)return response({visual_matches:results});return {ok:false,status:504,json:async()=>({})};
 }});
 const out=await d.search({attributes:attr,image,market:'in'});
 assert.equal(lensCalls,2);assert.equal(out.trace.lensRescue,true);assert.equal(out.trace.usedRelatedFallback,true);assert.ok(out.results.length);assert.ok(out.results.every(p=>p.match==='Similar shape'));
});
test('India provider outage returns domestic retailer searches instead of US products',async()=>{
 const d=createDiscovery({env:{SERPAPI_API_KEY:'test'},pageFetcher:async()=>'',fetcher:async()=>{throw Error('timeout')}});const out=await d.search({attributes:attr,market:'in'});assert.equal(out.trace.retailerShortcuts,true);assert.equal(out.results.length,3);assert.ok(out.results.every(p=>p.market==='in'&&['www.myntra.com','www.amazon.in','www.flipkart.com'].includes(new URL(p.url).hostname)));
});

test('auto mode records a result and replay mode uses it without provider calls',async()=>{
 const saved=new Map(),replayStore={get:async key=>saved.get(key)||null,set:async(key,value)=>saved.set(key,value)};
 const global={title:'Pastel blue relaxed shirt Global',link:'https://global.example.com/shirt',thumbnail:'https://images.example.com/global.jpg',source:'Global Shop'};
 const record=createDiscovery({env:{SERPAPI_API_KEY:'test',DISCOVERY_DATA_MODE:'auto'},replayStore,pageFetcher:async()=>'',fetcher:async url=>{const q=new URL(url).searchParams.get('q')||'';return response({images_results:q.includes('site:')?results:[global]});}});
 const first=await record.search({attributes:attr,image,market:'in'});assert.ok(first.results.length);assert.equal(saved.size,1);
 const replay=createDiscovery({env:{DISCOVERY_DATA_MODE:'replay'},replayStore,fetcher:()=>assert.fail('Replay must not call a provider')});const second=await replay.search({attributes:attr,image,market:'in'});assert.equal(second.trace.replayHit,true);assert.equal(second.results[0].url,first.results[0].url);
});
