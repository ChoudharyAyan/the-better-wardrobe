import {randomUUID,createHash} from 'node:crypto';
import {ApiError} from './discovery.mjs';
import {createStyleStore} from './style-store.mjs';
import {createStyleEngine,essentials,sanitizeBrief,normalizeWardrobe,starterLooks} from './style-engine.mjs';
import {createStylePreview} from './style-preview.mjs';
import {createCanvas,editCanvas,freezeDesign,forkDesign,createPreviewJob,transitionPreview} from '../dist/style-me/canvas.js';
const clone=v=>structuredClone(v);
const ID=/^[a-f0-9-]{36}$/;
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function createStyleMe({env=process.env,store=createStyleStore({env}),engine=createStyleEngine({env}),preview=createStylePreview({env}),now=Date.now}={}) {
 const running=new Map();
 const owner=identity=>createHash('sha256').update('style|'+identity).digest('hex');
 const publicSession=s=>{const copy=clone(s);delete copy.receipts;delete copy.rate;delete copy.inflight;return copy;};
 const get=(rows,id)=>{if(!ID.test(id))throw new ApiError(400,'Invalid styling session.');const s=rows[id];if(!s)throw new ApiError(404,'Styling session not found.');return s;};
 const tx=(who,fn)=>store.transact(owner(who),rows=>{
   for(const s of Object.values(rows))for(const j of Object.values(s.jobs||{})){
     if(now()-Date.parse(j.createdAt)>86400000){delete s.jobs[j.id];continue;}
     if(['queued','processing'].includes(j.status)&&now()-Date.parse(j.createdAt)>95000){j.status='failed';j.error='Preview interrupted. Your design is safe; retry with a new request.';}
   }
   return fn(rows);
 });
 const mutation=async(who,id,body,operation)=>tx(who,rows=>{
   const s=get(rows,id);
   if(!ID.test(body.requestId||''))throw new ApiError(400,'A unique request ID is required.');
   const fingerprint=sha(body), old=s.receipts[body.requestId];
   if(old){if(old.fingerprint!==fingerprint)throw new ApiError(409,'This request ID was already used for a different edit.');return publicSession(s);}
   operation(s);if(s.canvas.items.length>12)throw new ApiError(413,'Use up to 12 pieces in one outfit.');if(JSON.stringify(s).length>3800000)throw new ApiError(413,'This session is full. Delete old previews or start another session.');s.updatedAt=new Date(now()).toISOString();s.receipts[body.requestId]={fingerprint};
   const keys=Object.keys(s.receipts);if(keys.length>100)delete s.receipts[keys[0]];
   return publicSession(s);
 });
 return {
  migrate:async (guest,account)=>{if(!store.migrate)throw new ApiError(503,'Session migration unavailable.');await store.migrate(owner(guest),owner(account));},
  status:()=>({schemaVersion:1,ai:engine.enabled,preview:preview.enabled,previewApproximate:true,previewCredits:8,stylingCredits:engine.enabled?8:0,essentials,retention:'Reference photos are processed for this request only. Saved preview results expire after 24 hours or can be deleted immediately.',storage:env.POSTGRES_URL||env.COMMUNITY_DATABASE_URL?'account-database':env.VERCEL?'unconfigured':'local-file'}),
  async preferences(who,body){return tx(who,rows=>{
   if(body){const clean=sanitizeBrief({...body,mode:body.mode||'from-scratch'});rows._preferences={mode:clean.mode,aesthetic:clean.aesthetic,exclusions:clean.exclusions,budget:clean.budget,currency:'INR'};}
   return {preferences:clone(rows._preferences||{})};
  });},
  async clearPreferences(who){return tx(who,rows=>{delete rows._preferences;return {preferences:{}};});},
  async reserve(who,id,body){return tx(who,rows=>{const s=get(rows,id);if(!ID.test(body.requestId||''))throw new ApiError(400,'A request ID is required.');if(s.canvas.revision!==body.revision)throw new ApiError(409,'Your outfit changed before the styling request.');if(s.inflight&&now()-s.inflight.started<60000)throw new ApiError(409,'A styling request is already running. Your current outfit is safe.');s.inflight={requestId:body.requestId,started:now()};});},
  async release(who,id,requestId){return tx(who,rows=>{const s=rows[id];if(s?.inflight?.requestId===requestId)delete s.inflight;});},
  async replay(who,id,body){return tx(who,rows=>{const s=get(rows,id),old=s.receipts[body.requestId];if(!old)return null;if(old.fingerprint!==sha(body))throw new ApiError(409,'Request ID already used for another operation.');return publicSession(s);});},
  async list(who){return tx(who,rows=>Object.values(rows).filter(s=>ID.test(s.id||'')).map(s=>({id:s.id,title:s.title,updatedAt:s.updatedAt})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));},
  async get(who,id){return tx(who,rows=>publicSession(get(rows,id)));},
  async create(who,body){return tx(who,rows=>{
   const id=body.id;if(!ID.test(id||''))throw new ApiError(400,'A session ID is required.');
   if(rows[id])return publicSession(rows[id]);
   if(Object.keys(rows).filter(id=>ID.test(id)).length>=20)throw new ApiError(409,'Delete an old styling session before creating another.');
   const brief=sanitizeBrief(body.brief||{mode:'from-scratch'});
   const s={id,title:'Your styling session',updatedAt:new Date(now()).toISOString(),canvas:createCanvas({id,brief}),frozen:[],jobs:{},assets:{},referenceItems:[],messages:[],looks:[],receipts:{},feedback:[]};rows[id]=s;return publicSession(s);
  });},
  async remove(who,id){for(const [key,controller] of running)if(key.startsWith(owner(who)+'|'+id+'|'))controller.abort();return tx(who,rows=>{get(rows,id);delete rows[id];return {ok:true};});},
  async edit(who,id,body){return mutation(who,id,body,s=>{
   const action=body.action;
   if(action?.type==='brief')action.patch=sanitizeBrief({...s.canvas.brief,...action.patch});
   s.canvas=editCanvas(s.canvas,body.revision,action);
  });},
  async select(who,id,body){return mutation(who,id,body,s=>{
   if(s.canvas.revision!==body.revision)throw new ApiError(409,'Your outfit changed. Reload before selecting a look.');
   const look=s.looks.find(l=>l.id===body.lookId);if(!look)throw new ApiError(404,'Outfit not found.');
   const next=createCanvas({id:s.id,brief:s.canvas.brief,items:look.items});next.revision=s.canvas.revision+1;next.pinned=s.canvas.pinned.filter(id=>next.items.some(i=>i.id===id));next.history=[...s.canvas.history,{brief:clone(s.canvas.brief),items:clone(s.canvas.items),pinned:clone(s.canvas.pinned),layout:clone(s.canvas.layout)}].slice(-100);
   s.canvas=next;s.title=look.title;
  });},
  async freeze(who,id,body){return mutation(who,id,body,s=>{
   if(s.frozen.length>=30)throw new ApiError(409,'This session already has 30 frozen designs. Start another session.');
   s.frozen.push(freezeDesign(s.canvas,body.revision,{id:randomUUID(),createdAt:new Date(now()).toISOString(),validate:state=>{const terms=String(state.brief.exclusions||'').toLowerCase().split(/[,;\n]/).map(x=>x.trim().replace(/^(no|avoid|without)\s+/, '')).filter(Boolean);return state.items.some(i=>terms.some(t=>(i.name+' '+(i.colour||'')).toLowerCase().includes(t)))?[{message:'Replace excluded garments or explicitly amend your brief before freezing.'}]:[];}}));
  });},
  async fork(who,id,body){return mutation(who,id,body,s=>{
   if(s.canvas.revision!==body.revision)throw new ApiError(409,'The draft changed. Reload before editing a frozen design.');
   const frozen=s.frozen.find(f=>f.id===body.designId);if(!frozen)throw new ApiError(404,'Frozen design not found.');
   const next=forkDesign(frozen,s.id);next.revision=s.canvas.revision+1;s.canvas=next;
  });},
  async feedback(who,id,body){return mutation(who,id,body,s=>{
   if(!['wearable','too-formal','not-my-style','too-expensive','uncomfortable'].includes(body.reason))throw new ApiError(400,'Choose a feedback reason.');
   s.feedback.push({reason:body.reason,revision:s.canvas.revision,date:new Date(now()).toISOString()});s.feedback=s.feedback.slice(-100);
  });},
  async generate(who,id,body,signal,progress=()=>{}){
   const replay=await this.replay(who,id,body);if(replay)return replay;
   const s=await this.get(who,id);
   if(s.canvas.revision!==body.revision)throw new ApiError(409,'The outfit changed before this request.');
   const brief=sanitizeBrief(body.brief),wardrobe=normalizeWardrobe(body.wardrobe||[]);
   const pinned=s.canvas.items.filter(i=>s.canvas.pinned.includes(i.id));
   const provisional=starterLooks(brief,wardrobe,pinned);
   const provisionalSession=await tx(who,rows=>{const current=get(rows,id);if(current.canvas.revision!==body.revision)throw new ApiError(409,'A newer edit arrived.');current.canvas=editCanvas(current.canvas,body.revision,{type:'brief',patch:brief});current.looks=provisional;current.messages.push({role:'user',text:brief.request});current.messages=current.messages.slice(-40);current.updatedAt=new Date(now()).toISOString();return publicSession(current);});
   progress({type:'draft',session:provisionalSession,label:'Editable starter direction · AI is still working.'});
   const result=await engine.generate({brief,wardrobe,pinned,current:s.canvas.items},signal);
   return mutation(who,id,body,current=>{
    if(current.canvas.revision!==provisionalSession.canvas.revision)throw new ApiError(409,'A newer edit arrived. Your current outfit has been kept.');
    current.looks=result.looks;
    current.messages.push({role:'assistant',text:result.message,provider:result.provider});current.messages=current.messages.slice(-40);current.title=brief.occasion||brief.request.slice(0,60)||'Your styling session';
   });
  },
  async reference(who,id,body,detected){
   if(body.consent!==true)throw new ApiError(400,'Confirm image processing first.');
   const {default:sharp}=await import('sharp');
   const encoded=/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.image||'');
   if(!encoded)throw new ApiError(400,'Choose a supported garment image.');
   const raw=Buffer.from(encoded[1],'base64'),metadata=await sharp(raw,{limitInputPixels:24000000}).metadata();
   const references=[];
   for(const candidate of (detected.items||[]).slice(0,6)){
    const c=candidate.crop;if(!c||![c.left,c.top,c.width,c.height].every(Number.isFinite))continue;
    const left=Math.max(0,Math.floor(metadata.width*c.left/100)),top=Math.max(0,Math.floor(metadata.height*c.top/100));
    const width=Math.min(metadata.width-left,Math.ceil(metadata.width*c.width/100)),height=Math.min(metadata.height-top,Math.ceil(metadata.height*c.height/100));if(width<1||height<1)continue;
    const image=await sharp(raw).extract({left,top,width,height}).resize({width:450,height:450,fit:'inside'}).jpeg({quality:75}).toBuffer();if(image.length>100000)continue;
    const name=String(candidate.label).slice(0,150),lower=name.toLowerCase();
    const slot=/shoe|sneaker|sandal|jutt|heel|loafer/.test(lower)?'shoes':/trouser|jean|short|salwar|skirt|pant/.test(lower)?'bottom':/dress|saree|lehenga|suit/.test(lower)?'onePiece':/jacket|coat|blazer|outerwear/.test(lower)?'outerwear':/shirt|tee|kurta|top|blouse/.test(lower)?'top':'accessory';
    references.push({id:'reference-'+randomUUID(),name,slot,source:'concept',ownership:'unowned',assetVersion:'1',image:'data:image/jpeg;base64,'+image.toString('base64')});
   }
   return mutation(who,id,body,s=>{
    s.assets??={};s.referenceItems??=[];
    if(Object.keys(s.assets).length+references.length>20)throw new ApiError(409,'Use another session for more reference photos.');
    for(const {image,...item} of references){s.assets[item.id]={image,version:'1'};s.referenceItems.push(item);}
   });
  },
  async render(who,id,body,signal){
   if(!preview.enabled)throw new ApiError(503,'On-self preview is not configured yet. Your frozen design is saved.');
   if(body.consent!==true||body.costAccepted!==true||!ID.test(body.jobId||''))throw new ApiError(400,'Confirm photo processing, credit cost and a unique preview request.');
   const fingerprint=sha({designId:body.designId,photo:body.photo,garmentImages:body.garmentImages||[]});
   const job=await tx(who,rows=>{
    const s=get(rows,id),existing=s.jobs[body.jobId];
    if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError(409,'This preview ID belongs to another design or photo.');return {...clone(existing),replayed:true};}
    if(Object.keys(s.jobs).length>=5)throw new ApiError(409,'Delete an old preview before creating another.');
    const frozen=s.frozen.find(f=>f.id===body.designId);if(!frozen)throw new ApiError(404,'Freeze the design before previewing.');
    const photo={id:randomUUID(),version:fingerprint,consentId:randomUUID()};
    const job=createPreviewJob(frozen,photo,{id:body.jobId,supportedSlots:['top','bottom','onePiece','shoes','outerwear','accessory'],now:new Date(now()).toISOString()});
    s.jobs[job.id]={...transitionPreview(job,'processing'),fingerprint,referenceIds:frozen.items.filter(i=>s.assets?.[i.id]).map(i=>i.id)};return clone(s.jobs[job.id]);
   });
   if(job.replayed)return job;
   const controller=new AbortController(),runningKey=owner(who)+'|'+id+'|'+job.id;running.set(runningKey,controller);
   try{
    const latest=await this.get(who,id);if(!latest.jobs[job.id])throw new ApiError(409,'Preview was deleted before rendering.');const assets=latest.assets||{};
    const result=await preview.render(job.snapshot,body.photo,signal?AbortSignal.any([signal,controller.signal]):controller.signal,[...(job.referenceIds||[]).map(id=>({id,image:assets[id].image})),...(body.garmentImages||[]).filter(i=>!(job.referenceIds||[]).includes(i.id))]);
    return await tx(who,rows=>{
     const s=get(rows,id),current=s.jobs[job.id];if(!current||current.status!=='processing')throw new ApiError(409,'Preview was cancelled or deleted.');
     s.jobs[job.id]=transitionPreview(current,'completed',{...result,assetId:randomUUID(),designId:job.designId,photoVersion:job.photoVersion});if(JSON.stringify(s).length>3800000)throw new ApiError(413,'This session is full. Delete an old preview before retrying.');return clone(s.jobs[job.id]);
    });
   }catch(e){await tx(who,rows=>{const j=rows[id]?.jobs[job.id];if(j?.status==='processing'){j.status='failed';j.error=e.status?e.message:'Preview interrupted. Your design is saved; please retry.';}}).catch(()=>{});throw e;}finally{running.delete(runningKey);}
  },
  async deletePreview(who,id,jobId){running.get(owner(who)+'|'+id+'|'+jobId)?.abort();return tx(who,rows=>{const s=get(rows,id);delete s.jobs[jobId];return publicSession(s);});}
 };
}
