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
 const d=createDiscovery({env:{},fetcher:()=>assert.fail('No network without keys')});assert.deepEqual(d.status(),{vision:false,visionProvider:'gemini',models:[{id:'gemini-3-flash',label:'Max',note:'Most accurate',credits:15},{id:'gpt-5-nano',label:'Lite',note:'More searches',credits:8}],defaultModel:'gemini-3-flash',shopping:false,lens:false,model:'gemini-3-flash-preview',developerDashboard:false,dataMode:'live'});await assert.rejects(d.analyze({image,category:'Shirt'}),/Gemini/);await assert.rejects(d.search({attributes:attr}),/SerpApi/);
});
test('conversation interpretation accepts text, screenshot, or both without inventing product facts',async()=>{
 const calls=[];const answer={...attr,category:'Blazer',colour:'brown',subtype:'blazer',features:'single button',department:'womenswear',query:'relaxed brown blazer',budget:4000,uncertainty:'Fabric is unclear',question:''};
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async(url,opts)=>{calls.push(JSON.parse(opts.body));return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]});}});
 const textOnly=await d.interpret({text:'Find a brown blazer under ₹4,000'});assert.equal(textOnly.attributes.category,'Blazer');assert.equal(textOnly.budget,4000);assert.equal(textOnly.query,'relaxed brown blazer');assert.equal(calls[0].contents[0].parts.some(p=>p.inlineData),false);
 await d.interpret({text:'Something like this',image});assert.equal(calls[1].contents[0].parts.some(p=>p.inlineData),true);
 await d.interpret({image});assert.equal(calls[2].contents[0].parts.some(p=>p.inlineData),true);
 await d.interpret({text:'show me a cheaper version',previous:textOnly});assert.match(calls[3].contents[0].parts[0].text,/Previous search for conversational context/);
 await assert.rejects(d.interpret({}),/description or a screenshot/);
});
test('conversation asks for a garment type when the request is ambiguous',async()=>{
 const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({category:'',colour:'',fit:'',pattern:'',details:'',subtype:'',features:'',department:'unknown',query:'Cannes 2008',budget:null,uncertainty:'',question:'Which item do you mean?'})}]}}]})});
 const out=await d.interpret({text:'Cannes 2008'});assert.equal(out.attributes,null);assert.equal(out.question,'Which item do you mean?');
});
test('a confirmed conversational phrase reaches shopping search',async()=>{
 const queries=[];const d=createDiscovery({env:{SERPAPI_API_KEY:'test'},fetcher:async url=>{queries.push(new URL(url).searchParams.get('q'));return response({shopping_results:results});},pageFetcher:async()=>''});
 const out=await d.search({attributes:{category:'Dress'},query:'Cannes 2008 inspired black dress',market:'in'});
 assert.equal(out.query,'Cannes 2008 inspired black dress');assert.ok(queries.some(q=>q.includes('Cannes 2008 inspired black dress')));
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
test('India provider outage shows store searches separately, never as fake product cards',async()=>{
 const d=createDiscovery({env:{SERPAPI_API_KEY:'test'},pageFetcher:async()=>'',fetcher:async()=>{throw Error('timeout')}});const out=await d.search({attributes:attr,market:'in'});
 assert.equal(out.results.length,0,'no product came back, so none is shown');
 assert.deepEqual(out.storeSearches.map(s=>s.store),['Myntra','AJIO','Amazon','Flipkart','Nykaa Fashion']);
 assert.ok(out.storeSearches.every(s=>new URL(s.url).protocol==='https:'));
});
test('store search links use each store’s real search URL format',async()=>{
 const {storeSearches}=await import('../lib/discovery.mjs');
 assert.deepEqual(storeSearches('Brown suede jacket').map(s=>s.url),['https://www.myntra.com/brown-suede-jacket','https://www.ajio.com/search/?text=Brown%20suede%20jacket','https://www.amazon.in/s?k=Brown+suede+jacket','https://www.flipkart.com/search?q=Brown%20suede%20jacket','https://www.nykaafashion.com/catalogsearch/result/?q=Brown%20suede%20jacket']);
 assert.deepEqual(storeSearches('  '),[]);
});
test('India shopping searches do not pin location=India and get a realistic time budget',async()=>{
 const seen=[];const d=createDiscovery({env:{SERPAPI_API_KEY:'k',DISCOVERY_DATA_MODE:'live'},pageFetcher:async()=>'',fetcher:async url=>{seen.push(new URL(url).searchParams);return response({shopping_results:[],images_results:[]});}});
 await d.search({attributes:attr,market:'in'});
 const india=seen.filter(p=>p.get('gl')==='in');assert.ok(india.length>=2);assert.ok(india.every(p=>!p.has('location')),'gl=in alone was faster and more Indian in live checks');
});

test('auto mode records a result and replay mode uses it without provider calls',async()=>{
 const saved=new Map(),replayStore={get:async key=>saved.get(key)||null,set:async(key,value)=>saved.set(key,value)};
 const global={title:'Pastel blue relaxed shirt Global',link:'https://global.example.com/shirt',thumbnail:'https://images.example.com/global.jpg',source:'Global Shop'};
 const record=createDiscovery({env:{SERPAPI_API_KEY:'test',DISCOVERY_DATA_MODE:'auto'},replayStore,pageFetcher:async()=>'',fetcher:async url=>{const q=new URL(url).searchParams.get('q')||'';return response({images_results:q.includes('site:')?results:[global]});}});
 const first=await record.search({attributes:attr,image,market:'in'});assert.ok(first.results.length);assert.equal(saved.size,1);
 const replay=createDiscovery({env:{DISCOVERY_DATA_MODE:'replay'},replayStore,fetcher:()=>assert.fail('Replay must not call a provider')});const second=await replay.search({attributes:attr,image,market:'in'});assert.equal(second.trace.replayHit,true);assert.equal(second.results[0].url,first.results[0].url);
});

test('department keeps a menswear search out of womenswear listings',()=>{
 const mens=attributes({category:'Blazer',colour:'light pink',fit:'slim',pattern:'solid',department:"Men's"});
 assert.equal(mens.department,'menswear');
 assert.equal(attributes({category:'Blazer',department:'ladies'}).department,'womenswear');
 assert.equal(attributes({category:'Blazer',department:'anything else'}).department,'');
 assert.ok(searchIntent(mens).query.startsWith("men's"),searchIntent(mens).query);
 // The QA report: a light pink blazer search returned a woman's suit.
 assert.equal(titleRejection({title:"Women's Light Pink Slim Blazer"},mens),'Different department');
 assert.equal(titleRejection({title:'Ladies pink blazer'},mens),'Different department');
 assert.equal(titleRejection({title:'Light pink slim fit blazer'},mens),'');
 assert.equal(titleRejection({title:"Men's light pink blazer"},mens),'');
 // "men" must not match inside "women"; unisex and unknown constrain nothing.
 const womens=attributes({category:'Blazer',colour:'light pink',department:'womenswear'});
 assert.equal(titleRejection({title:"Women's pink blazer"},womens),'');
 assert.equal(titleRejection({title:"Men's pink blazer"},womens),'Different department');
 const unknown=attributes({category:'Blazer',colour:'light pink'});
 assert.equal(titleRejection({title:"Women's pink blazer"},unknown),'');
 assert.equal(searchIntent(unknown).query.includes("men's"),false);
 assert.equal(titleRejection({title:'Unisex pink blazer'},attributes({category:'Blazer',department:'unisex'})),'');
});

test('interpret asks instead of inventing a garment, and keeps budgets across follow-ups',async()=>{
 const reply=(data)=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({category:'',colour:'',fit:'',pattern:'',details:'',subtype:'',features:'',department:'unknown',query:'',budget:null,uncertainty:'',question:'',...data})}]}}]})});
 let next;const d=createDiscovery({env:{GEMINI_API_KEY:'test'},fetcher:async()=>reply(next)});
 next={category:'sweatshirts',subtype:'pullover',colour:'beige',query:'beige sweatshirt'};
 const vague=await d.interpret({text:'something nice'});
 assert.equal(vague.attributes,null,'no garment was named, so none is invented');assert.ok(vague.question);
 next={category:'shirt',subtype:'linen shirt',colour:'black',budget:2000};
 const first=await d.interpret({text:'black linen shirt for a beach wedding, under 2000'});assert.equal(first.attributes.category,'shirt');assert.equal(first.budget,2000);
 next={category:'shirt',subtype:'linen shirt',colour:'navy',budget:null};
 const cheaper=await d.interpret({text:'same but in navy and cheaper',previous:first});
 assert.equal(cheaper.attributes.category,'shirt','follow-up may rely on the earlier garment');assert.equal(cheaper.budget,1500);
 const same=await d.interpret({text:'same in navy',previous:first});assert.equal(same.budget,2000,'budget carries over when not mentioned');
 next={category:'clothing',subtype:'kurta set',colour:'red'};
 assert.equal((await d.interpret({text:'red kurta set for diwali'})).attributes.category,'kurta set','a non-answer category is replaced by the subtype');
 next={category:'kurta sets',subtype:'kurta set',colour:'red'};
 assert.equal((await d.interpret({text:'red kurta for diwali'})).attributes.category,'kurta sets');
});

test('OpenRouter runs both models with strict JSON, falls back to JSON mode, and reports an empty balance',async()=>{
 const sent=[];let mode='ok';
 const d=createDiscovery({env:{OPENROUTER_API_KEY:'or-test'},fetcher:async(url,opts)=>{
  const body=JSON.parse(opts.body);sent.push({url:String(url),auth:opts.headers.Authorization,body});
  if(mode==='broke')return {ok:false,status:402,json:async()=>({})};
  if(mode==='strict-rejected'&&body.response_format.type==='json_schema')return {ok:false,status:400,json:async()=>({error:{message:'schema not supported'}})};
  return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:'```json\n'+JSON.stringify({category:'shirt',colour:'black',fit:'',pattern:'',details:'',subtype:'linen shirt',features:'',department:'menswear',query:'black linen shirt',budget:null,uncertainty:'',question:''})+'\n```'}}]})};
 }});
 assert.equal(d.status().visionProvider,'openrouter');assert.equal(d.status().vision,true);
 await d.interpret({text:'black linen shirt'});
 assert.equal(sent[0].url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(sent[0].auth,'Bearer or-test');
 assert.equal(sent[0].body.model,'google/gemini-3-flash-preview','Gemini 3 Flash is the default');assert.equal(sent[0].body.response_format.type,'json_schema');
 assert.match(sent[0].body.messages[0].content,/never write a person's name/);
 await d.interpret({text:'black linen shirt',model:'gpt-5-nano'});
 assert.equal(sent[1].body.model,'openai/gpt-5-nano');assert.deepEqual(sent[1].body.reasoning,{effort:'low'});
 await d.interpret({text:'black linen shirt',model:'claude-opus-everything'});assert.equal(sent[2].body.model,'google/gemini-3-flash-preview','unknown models fall back to the default');
 mode='strict-rejected';const r=await d.interpret({text:'black linen shirt'});assert.equal(r.attributes.category,'shirt');assert.equal(sent.at(-1).body.response_format.type,'json_object');
 mode='broke';await assert.rejects(d.interpret({text:'black linen shirt'}),/balance for this preview is used up/);
});
test('shopping queries never carry "unknown" fields or a budget phrase',async()=>{
 const urls=[];
 const d=createDiscovery({env:{SERPAPI_API_KEY:'k',DISCOVERY_DATA_MODE:'live'},fetcher:async url=>{urls.push(new URL(url).searchParams.get('q')||'');return {ok:true,status:200,json:async()=>({shopping_results:[],images_results:[]})};},pageFetcher:async()=>'',imageFetcher:async()=>{throw Error('no images');}});
 await d.search({attributes:{category:'shirt',colour:'black',fit:'unknown',pattern:'unknown',details:'linen'},query:'black linen shirt under ₹2,000',budget:2000,market:'in'}).catch(()=>{});
 assert.ok(urls.length>0);
 for(const q of urls){assert.doesNotMatch(q,/unknown/i,q);assert.doesNotMatch(q,/under|2,000/i,q);}
 assert.ok(urls.some(q=>q.startsWith('black linen shirt')));
});

test('Google Shopping India listings with a rupee price survive the domestic filter',async()=>{
 const {indianShoppingListing}=await import('../lib/discovery.mjs');
 const listing=(o)=>({url:'https://www.google.com/shopping/product/123',source:'shopping',market:'in',priceText:'₹1,795',...o});
 assert.equal(indianShoppingListing(listing()),true);
 assert.equal(indianShoppingListing(listing({priceText:'$45'})),false,'a dollar listing is not an Indian offer');
 assert.equal(indianShoppingListing(listing({source:'global'})),false);
 assert.equal(indianShoppingListing(listing({url:'https://evil.example/shopping/product/1'})),false);
 const d=createDiscovery({env:{SERPAPI_API_KEY:'k',DISCOVERY_DATA_MODE:'live'},pageFetcher:async()=>'',fetcher:async url=>{const e=new URL(url).searchParams.get('engine');return response(e==='google_shopping'?{shopping_results:[{title:'WROGN Men Brown Suede Jacket',product_link:'https://www.google.com/shopping/product/9',source:'Myntra',price:'₹2,099',extracted_price:2099,thumbnail:'https://encrypted-tbn0.gstatic.com/x.jpg'}]}:{images_results:[]});}});
 const out=await d.search({attributes:{category:'jacket',colour:'brown',fit:'',pattern:'',details:'suede'},query:'brown suede jacket',market:'in'});
 assert.equal(out.results[0].merchant,'Myntra');assert.equal(out.results[0].priceText,'₹2,099');
});

test('colour gate: a white-shirt search drops blue and pink shirts by title or photo, in under a second',async()=>{
 const {colourGate,colourFamily,titleColourConflict}=await import('../lib/colour.mjs');
 const {default:sharp}=await import('sharp');
 const solid=async rgb=>({data:(await sharp({create:{width:60,height:80,channels:3,background:rgb}}).png().toBuffer()).toString('base64'),mimeType:'image/png'});
 const photos={'w':{r:245,g:245,b:243},'b':{r:168,g:198,b:226},'p':{r:214,g:180,b:206},'k':{r:20,g:20,b:22}};
 assert.equal(colourFamily('white'),'white');assert.equal(colourFamily('navy'),'blue');
 assert.equal(titleColourConflict('Light Blue Oxford Shirt','white'),true);
 assert.equal(titleColourConflict('Blue and White Striped Shirt','white'),false);
 assert.equal(titleColourConflict('Giza Cotton Shirt','white'),false);
 const items=[{title:'French Cuff Giza Cotton Shirt',image:'b'},{title:'French Cuff Giza Cotton Shirt',image:'p'},{title:'Non-Iron Twill Spread Collar Shirt',image:'w'},{title:'Sky Blue Shirt',image:'w'},{title:'Linen Shirt',image:'slow'},{title:'Cotton Shirt',image:'tiny'}];
 const fetchImage=async id=>{if(id==='slow')return new Promise(()=>{});if(id==='tiny')return {data:(await sharp({create:{width:1,height:1,channels:3,background:{r:0,g:0,b:255}}}).png().toBuffer()).toString('base64')};return solid(photos[id]);};
 const started=Date.now();const {items:kept,report}=await colourGate(items,'white',fetchImage,{budgetMs:300});
 assert.ok(Date.now()-started<1000);
 assert.deepEqual(kept.map(p=>p.image),['w','slow','tiny'],'blue and pink photos and a blue title are gone; unchecked pieces stay');
 assert.equal(report.titleRejected,1);assert.equal(report.photoRejected,2);
 const black=await colourGate([{title:'Shirt',image:'k'},{title:'Shirt',image:'w'}],'black',fetchImage);
 assert.deepEqual(black.items.map(p=>p.image),['k']);
 assert.equal((await colourGate(items,'',fetchImage)).items.length,items.length,'no colour asked, nothing filtered');
});
test('a piece picked from the photo is searched even when the model says it cannot see it',async()=>{
 const reply={category:'',colour:'',fit:'',pattern:'',details:'',subtype:'',features:'',department:'unknown',query:'',budget:null,uncertainty:'',question:"I couldn't find any sunglasses in the image."};
 const d=createDiscovery({env:{OPENROUTER_API_KEY:'k',VISION_PROVIDER:'openrouter'},fetcher:async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]})})});
 const r=await d.interpret({text:'',image:image,target:'sunglasses'});
 assert.equal(r.attributes.category,'sunglasses');assert.equal(r.question,'');
});
