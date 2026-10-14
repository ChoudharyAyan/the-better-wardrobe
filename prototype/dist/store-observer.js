// Runs in the store's own page (MAIN world, document_start) on Slikk, Tata CLiQ and Nykaa
// Fashion. These sites attach a login token to their order requests, so instead of
// reading or replaying that token, we keep the JSON the page itself receives for its
// order list. Only the response body and URL path are kept: never headers or query strings.
(()=>{
 const ORDER_RESPONSES=[/api\.slikkclub\.com\/user\/order(\?|$)/,/\/orderhistorylist_V2(\?|$)/,/\/fe-api\/omsApis\/v2\/orders(\?|$)/];
 const wanted=url=>ORDER_RESPONSES.some(p=>p.test(url));
 const keep=(url,body)=>{
  try{const data=typeof body==='string'?JSON.parse(body):body;if(data&&typeof data==='object')(window.__tbwCaptured||=[]).push({path:new URL(url,location.href).pathname,data});}catch{}
 };
 const open=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method,url){
  const target=String(url);
  if(wanted(target))this.addEventListener('load',()=>keep(target,this.responseType==='json'?this.response:this.responseText));
  return open.apply(this,arguments);
 };
 const fetch=window.fetch;
 window.fetch=async function(input){
  const response=await fetch.apply(this,arguments);
  const target=String(input?.url||input);
  if(wanted(target))response.clone().text().then(text=>keep(target,text)).catch(()=>{});
  return response;
 };
})();
