import {load} from 'cheerio';
import {LOOKS} from './looks.mjs';

const httpsUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
export function parseLookPhotos(html){
 const $=load(html),photos=[];
 $('a.iusc').each((_,el)=>{try{const data=JSON.parse($(el).attr('m'));const image=httpsUrl(data.turl)||httpsUrl(data.murl),source=httpsUrl(data.purl);if(image&&source)photos.push({image,source,title:String(data.t||'Web photo reference').slice(0,240)});}catch{}});
 return photos;
}
// Public image search, independent of the paid garment discovery pipeline.
export function createLookPhotos({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return {async search(query){
  const q=String(query).trim().replace(/\s+/g,' ').slice(0,300),key=q.toLowerCase();
  if(q.length<3)return {image:null,source:null};
  const hit=cache.get(key);if(hit&&hit.expires>now())return hit.value;
  if(pending.has(key))return pending.get(key);
  if(pending.size>=8)return {image:null,source:null};
  const task=(async()=>{let value={image:null,source:null};try{
   const response=await fetchImpl('https://www.bing.com/images/search?'+new URLSearchParams({q,adlt:'strict',form:'HDRSC2'}),{signal:AbortSignal.timeout(10000)});
   if(response.ok){const candidates=parseLookPhotos(await response.text()),tokens=key.split(/[^a-z0-9]+/).filter(t=>t.length>3);value=candidates.find(p=>tokens.filter(t=>(p.title+' '+p.source).toLowerCase().includes(t)).length>=Math.min(3,tokens.length))||value;}
  }catch{}
  if(!value.image)try{
   const person=(q.includes(' · ')?q.split(' · ')[0]:LOOKS.find(look=>look.aliases.test(q))?.who.split(' · ')[0]||q).trim();
   const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:person,gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url',iiurlwidth:'500'});
   const response=await fetchImpl(url,{signal:AbortSignal.timeout(10000)});
   if(response.ok){const data=await response.json(),pages=Object.values(data.query?.pages||{}).sort((a,b)=>a.index-b.index);const page=pages.find(p=>person.toLowerCase().split(/\s+/).every(t=>p.title.toLowerCase().includes(t)));const info=page?.imageinfo?.[0];if(info&&httpsUrl(info.thumburl||info.url)&&httpsUrl(info.descriptionurl))value={image:httpsUrl(info.thumburl||info.url),source:httpsUrl(info.descriptionurl),title:page.title,portrait:true};}
  }catch{}
  pending.delete(key);
  if(cache.size>=200)cache.delete(cache.keys().next().value);
  cache.set(key,{value,expires:now()+(value.image?3600000:60000)});return value;})();
  pending.set(key,task);return task;
 }};
}
