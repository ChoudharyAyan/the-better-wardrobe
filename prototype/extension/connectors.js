// One entry per store. extract() is injected into the owner's own logged-in tab
// (chrome.scripting, MAIN world), so it must be self-contained: no imports or closures.
// Each extract() keeps product fields only (name, brand, size, image, date, status)
// in the store's tab; addresses, payments, phone numbers and IDs never leave it.
// Normalisation into wardrobe items happens in the app (dist/order-import.js).
//
// verified: mapped against real orders on 2026-09-30.
// unverified: order endpoint found, but the test account had no orders, so item
// fields are found by shape (see normalizeGeneric) until someone with orders tests it.

export const connectors=[
 {
  id:'myntra',label:'Myntra',verified:true,ordersUrl:'https://www.myntra.com/my/orders',
  extract:async function(){
   // /my/orders is server-rendered; each page embeds window.__myx. Pagination is ?p=N (?page=N is ignored).
   const page=async n=>{
    const html=await (await fetch('/my/orders?p='+n,{credentials:'include'})).text();
    const m=html.match(/window\.__myx = (\{[\s\S]*?\});?\s*<\/script>/);
    return m?JSON.parse(m[1]).omsServiceResponse?.orderResponse||null:null;
   };
   const pick=i=>{const p=i.product||{};return {createdOn:i.createdOn,statusCode:i.status?.code||'',returned:!!i.return,cancelled:!!i.cancellationStatus,
    product:{id:p.id,name:p.name,brand:p.brand?.name||'',articleType:p.articleType||'',masterCategory:p.masterCategory||'',gender:p.gender||'',
     images:(p.images||[]).map(x=>({view:x.view,src:x.secureSrc||x.src})),size:(p.sizes||[]).find(s=>s.skuId===p.skuId)?.label||''}};};
   try{
    const first=await page(1);
    if(!first)return {error:/login/.test(location.pathname)?'login':'layout'};
    const lines=first.items.map(pick),pages=Math.min(Number(first.totalPages)||1,80);
    for(let n=2;n<=pages;n++){await new Promise(r=>setTimeout(r,350));const o=await page(n);if(!o?.items?.length)break;lines.push(...o.items.map(pick));}
    return {lines};
   }catch(e){return {error:'layout',detail:String(e).slice(0,200)};}
  }
 },
 {
  id:'flipkart',label:'Flipkart',verified:true,ordersUrl:'https://www.flipkart.com/account/orders',
  extract:async function(){
   // The order list comes from the rome API. X-User-Agent is the site's client identifier, not a credential.
   const base='https://2.rome.api.flipkart.com/api/5/self-serve/orders/';
   const headers={'X-User-Agent':navigator.userAgent+' FKUA/website/42/website/Desktop'};
   const pick=o=>{
    const bag=o.productDataBag||{},keys=Object.keys(bag);
    // Each product is listed twice, under its listing id (LST…) and its FSN. Keep the FSN copy.
    const ids=keys.filter(k=>!k.startsWith('LST'));
    const products=(ids.length?ids:keys).map(k=>{const b=bag[k].productBasicData||{},a=bag[k].productAttribute||{},loc=b.imageLocation||{};
     return {id:k,title:b.title||'',vertical:b.vertical||'',category:b.category||'',url:b.url||'',brand:a.brand||'',color:a.color||'',size:a.size||'',image:loc['400x400']||loc['700x700']||Object.values(loc)[0]||''};});
    // A unit is gone when its status is Returned/Cancelled and it wasn't a replacement (a replacement means the item was kept).
    const units=Object.values(o.units||{});
    const returned=units.length>0&&units.every(u=>/return|cancel/i.test(u.metaData?.status?.key||'')&&!(u.reverseLegDataBag?.returnTracking||[]).some(t=>/replace/i.test(t.returnType||'')));
    return {orderDate:o.orderMetaData?.orderDate||null,returned,products};
   };
   try{
    const orders=[];let query=new URLSearchParams({page:'1',filterType:'PREORDER_UNITS'});
    for(let n=1;n<=60;n++){
     const r=await fetch(base+'?'+query,{credentials:'include',headers});
     if(r.status===401||r.status===403)return {error:'login'};
     const view=(await r.json())?.RESPONSE?.multipleOrderDetailsView;
     if(!view)return orders.length?{orders}:{error:'layout'};
     orders.push(...(view.orders||[]).map(pick));
     if(!view.moreOrder)break;
     query=new URLSearchParams({page:String(n+1),filterType:'PREORDER_UNITS'});
     for(const p of view.nextCallParams||[])if(p?.key)query.set(p.key,p.value);
     await new Promise(r=>setTimeout(r,400));
    }
    return {orders};
   }catch(e){return {error:'layout',detail:String(e).slice(0,200)};}
  }
 },
 {
  id:'slikk',label:'Slikk',verified:true,ordersUrl:'https://www.slikk.club/orders',
  extract:async function(){
   // observer.js captured the page's own /user/order responses; scrolling loads further pages.
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const pages=()=>(window.__tbwCaptured||[]).filter(c=>/\/user\/order$/.test(c.path)).map(c=>c.data?.data).filter(Boolean);
   let seen=-1,idle=0;
   for(let i=0;i<60&&idle<4;i++){
    const got=pages();
    if(!got.length&&i>=8)return {error:/login|signin/.test(location.pathname)?'login':'layout'};
    if(got.length&&got.at(-1).next===false)break;
    idle=got.length===seen?idle+1:0;seen=got.length;
    window.scrollTo(0,document.body.scrollHeight);await wait(1200);
   }
   const byId=new Map();
   for(const o of pages().flatMap(p=>p.results||[]))byId.set(o.uuid||o.order_id,o);
   return {orders:[...byId.values()].map(o=>({status:String(o.status||''),date:o.create_date||null,returned:Array.isArray(o.return_orders)&&o.return_orders.length>0,
    items:(o.order_items||[]).map(i=>({name:i.name||'',image:i.image||'',price:i.final_price||''}))}))};
  }
 },
 {
  id:'ajio',label:'AJIO',verified:false,ordersUrl:'https://www.ajio.com/my-account/orders',
  extract:async function(){
   // POST /api/my-account/get-user-orders/{page}/{size}/{range} answers with the session cookie alone.
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const get=async(page,range)=>{const r=await fetch(`/api/my-account/get-user-orders/${page}/10/${range}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:'{}'});if(r.status===401||r.status===403)throw Object.assign(new Error('login'),{login:true});return r.json();};
   try{
    const pages=[];
    for(const range of ['LAST_6_MONTHS','CURRENT_YEAR','CURRENT_YEAR-1','CURRENT_YEAR-2','CURRENT_YEAR-3','CURRENT_YEAR-4','CURRENT_YEAR-5']){
     for(let page=0;page<30;page++){
      const data=await get(page,range);pages.push(data);
      if(!(Number(data.totalPages)>page+1))break;
      await wait(400);
     }
    }
    return {pages};
   }catch(e){return {error:e.login?'login':'layout',detail:String(e).slice(0,200)};}
  }
 },
 {
  id:'tatacliq',label:'Tata CLiQ',verified:false,ordersUrl:'https://www.tatacliq.com/my-account/orders',
  extract:async function(){
   // The page loads one period at a time; step the period filter so it fetches each year, and observer.js keeps each response.
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const captured=()=>(window.__tbwCaptured||[]).filter(c=>/orderhistorylist_V2$/.test(c.path));
   for(let i=0;i<10&&!document.querySelector('select');i++)await wait(500);
   const select=document.querySelector('select');
   if(select){
    const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
    for(let i=0;i<select.options.length;i++){const before=captured().length;set.call(select,select.options[i].value);select.dispatchEvent(new Event('change',{bubbles:true}));for(let t=0;t<12&&captured().length===before;t++)await wait(250);
     for(let s=0;s<6;s++){window.scrollTo(0,document.body.scrollHeight);await wait(700);}}
   }
   const pages=captured().map(c=>c.data);
   if(!pages.length)return {error:/login/.test(location.pathname)?'login':'layout'};
   return {pages};
  }
 },
 {
  id:'nykaafashion',label:'Nykaa Fashion',verified:false,ordersUrl:'https://www.nykaafashion.com/my/orders',
  extract:async function(){
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const captured=()=>(window.__tbwCaptured||[]).filter(c=>/omsApis\/v2\/orders$/.test(c.path));
   let seen=-1,idle=0;
   for(let i=0;i<40&&idle<4;i++){const n=captured().length;idle=n===seen?idle+1:0;seen=n;window.scrollTo(0,document.body.scrollHeight);await wait(1000);}
   const pages=captured().map(c=>c.data);
   if(!pages.length)return {error:/login/.test(location.pathname)?'login':'layout'};
   return {pages};
  }
 }
];
