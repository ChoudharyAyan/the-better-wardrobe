import {createCanvas,validateCanvas} from './canvas.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={top:'Shirts & tops',bottom:'Trousers & bottoms',onePiece:'One-piece outfits',shoes:'Shoes',outerwear:'Layers',accessory:'Accessories'};
const paths={top:'M18 10 8 16l5 12 7-3v29h24V25l7 3 5-12-10-6-8 6h-8Z',bottom:'M20 10h24l4 45H35l-3-31-3 31H16Z',onePiece:'M23 8h18l-3 18 12 30H14l12-30Z',shoes:'M12 31h15l8 10 17 5v9H10V40Z',outerwear:'M22 9h20l12 9-5 16-7-4v25H22V30l-7 4-5-16Z',accessory:'M18 26h28v27H18ZM23 26v-8a9 9 0 0 1 18 0v8'};
const colours={white:'#eee9df',ivory:'#eee4c7',navy:'#273752',black:'#363039',charcoal:'#4e4c53',beige:'#d5bb99',tan:'#bd9165',blue:'#587f9d',brown:'#986e50'};
const glyph=i=>{
 const name=String(i.name||'').toLowerCase();
 const shape=i.slot==='accessory'?( /watch/.test(name)?'M26 6h12v14H26Z M20 20h24v24H20Z M26 44h12v14H26Z':/glass|sunglass/.test(name)?'M8 26h19v15H8Z M37 26h19v15H37Z M27 31h10':/belt/.test(name)?'M8 27h48v10H8Z M14 24h12v16H14Z':/ring|bracelet/.test(name)?'M32 14a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z M32 20a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z':paths.accessory):paths[i.slot]||paths.accessory;
 const colour=String(i.colour||'').toLowerCase(),key=Object.keys(colours).find(c=>colour.includes(c));
 return `<svg class="sm-garment" viewBox="0 0 64 64" aria-hidden="true"><path d="${shape}" fill="${key?colours[key]:/silver/.test(colour)?'#bfc2c5':'#c9c4c1'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
};
const uuid=()=>crypto.randomUUID();
const normalize=i=>({id:String(i.id),name:i.name,slot:i.slot||({Shirts:'top',Trousers:'bottom',Footwear:'shoes',Dresses:'onePiece',Suits:'onePiece',Outerwear:'outerwear',Kurta:'top',Kurtas:'top',Sarees:'onePiece',Lehengas:'onePiece'}[i.category]||'accessory'),colour:i.colour||i.tags?.[0]||'',source:'described',ownership:'user-described',available:i.available!==false,assetVersion:String(i.revision||'1')});
export function createStyleUI({refresh,wardrobe=()=>[],notify=()=>{}}) {
 let preferences={},config=null,session=null,sessions=[],loading=true,busy=false,canvasOpen=false,editingItemId=null,filter='top',provisional=false,photo=null,photoName='',frozenId=null,activePreviewJob=null,error='',draftBrief={mode:'from-scratch',occasion:'',location:'',weather:'',aesthetic:'',exclusions:'',budget:'',request:''},pollTimer;
 let wardrobeProvider=wardrobe;
 const announce=msg=>{notify(msg);};
 const api=async(path,body,method=body?'POST':'GET',progress=()=>{})=>{
  const res=await fetch('/api/style/'+path,{method,headers:{'Content-Type':'application/json',...(path.endsWith('/generate')?{Accept:'application/x-ndjson'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data;
  if(res.headers.get('content-type')?.includes('application/x-ndjson')){
   const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',failure;
   const consume=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='result')data=event.data;else if(event.type==='error')failure=Object.assign(new Error(event.error),{status:event.status});else progress(event);};
   while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)consume(line);}buffer+=decoder.decode();if(buffer.trim())consume(buffer);
   if(failure)throw failure;if(!data)throw new Error('The connection ended. Your starter draft is saved; resume this session.');return data;
  }
  try{data=await res.json();}catch{throw new Error('The server could not answer. Your current design is kept.');}
  if(!res.ok){const e=new Error(data.error||'Please retry.');e.status=res.status;throw e;}return data;
 };
 const remember=()=>{try{localStorage.setItem('wos-style-session',session.id);}catch{announce('This browser cannot remember the session. Keep its URL to resume.');}};
 const draw=()=>{
  const el=document.activeElement,previousPanel=document.querySelector('.sm-canvas');
  const panelScroll=previousPanel?.dataset.session===session?.id?previousPanel.scrollTop:0;
  const selector=el?.dataset?.sm?`[data-sm="${el.dataset.sm}"]${el.dataset.id?`[data-id="${el.dataset.id}"]`:''}`:el?.hasAttribute?.('data-sm-photo')?'[data-sm-photo]':null;
  refresh();const nextPanel=document.querySelector('.sm-canvas');if(nextPanel)nextPanel.scrollTop=panelScroll;if(selector)document.querySelector(selector)?.focus({preventScroll:true});
 };
 const currentBrief=()=>({...draftBrief,...Object.fromEntries([...document.querySelectorAll('[data-sm-brief]')].map(el=>[el.dataset.smBrief,el.value]))});
 async function load(id){session=await api('sessions/'+id);draftBrief={...session.canvas.brief};frozenId=session.frozen.at(-1)?.id||null;remember();}
 async function start(){
  clearTimeout(pollTimer);photo=null;photoName='';frozenId=null;
  session=await api('sessions',{id:uuid(),brief:{...draftBrief,...preferences,mode:preferences.mode||(wardrobeProvider().length?'mixed':'from-scratch')}});draftBrief={...session.canvas.brief};remember();
 }
 async function init(){
  try{config=await api('status');preferences=(await api('preferences')).preferences;draftBrief={...draftBrief,...preferences};sessions=(await api('sessions')).sessions;
   let id;try{id=localStorage.getItem('wos-style-session');}catch{}
   if(id){try{await load(id);}catch{await start();}}else await start();
  }catch(e){error=e.message;}finally{loading=false;draw();}
 }
 const garmentImage=i=>{
  const original=wardrobeProvider().find(x=>String(x.id)===i.id);
  const src=session?.assets?.[i.id]?.image||original?.image;
  return src&&/^(?:assets\/|https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/.test(src)?`<img src="${esc(src)}" alt="${esc(i.name)}" loading="lazy">`:glyph(i);
 };
 const badge=i=>i.ownership==='unowned'?'Suggested concept':'You described as owned';
 const piece=i=>`<div class="sm-piece" draggable="true" data-sm-drag="${esc(i.id)}">${garmentImage(i)}<strong>${esc(i.name)}</strong><span>${badge(i)}</span></div>`;
 const frozen=()=>session?.frozen.find(f=>f.id===frozenId);
 const field=(name,label,placeholder='')=>`<label>${label}<input data-sm-brief="${name}" value="${esc(draftBrief[name]||'')}" placeholder="${esc(placeholder)}" ${name==='budget'?'type="number" min="0"':'maxlength="300"'}></label>`;
 function canvas(){
  const c=session.canvas,issues=validateCanvas(c),f=frozen();
  const inventory=wardrobeProvider().map(normalize).filter(i=>i.available), pool=[...inventory,...(session.referenceItems||[]),...(config?.essentials||[])].filter(i=>i.slot===filter);
  return `<section class="sm-canvas" data-session="${session.id}" aria-label="Canvas inside styling conversation"><div class="sm-section-heading"><div><span class="sm-eyebrow">YOUR PLAYGROUND</span><h2>Canvas</h2><p>Add a piece. Try a pairing. Make it yours.</p></div><button data-sm="close-canvas" class="sm-icon" aria-label="Back to conversation">×</button></div>
   ${error?`<p class="sm-error" role="alert">${esc(error)}</p>`:''}${busy?'<p class="sm-progress" role="status">Working on your request. Your current design is safe.</p>':''}<form data-sm-form="chat" class="sm-canvas-chat"><input name="prompt" placeholder="Ask the stylist to refine this look…" aria-label="Ask the stylist about this canvas" maxlength="2000" required><button type="submit" ${busy?'disabled':''}>Ask ↗</button></form><div class="sm-canvas-toolbar"><span>Draft · revision ${c.revision}</span><button data-sm="undo" ${c.history.length?'':'disabled'}>Undo</button><button data-sm="empty">Clear unpinned</button></div>
   <div class="sm-board" aria-label="Your outfit board">${Object.entries(labels).map(([slot,label])=>`<section class="sm-slot ${slot==='accessory'?'sm-wide':''}" data-sm-drop="${slot}" aria-label="${label}"><span class="sm-slot-label">${label}</span>${c.items.filter(i=>i.slot===slot).map(i=>`<div class="sm-selected">${piece(i)}<div class="sm-piece-actions"><button data-sm="pin" data-id="${esc(i.id)}" aria-pressed="${c.pinned.includes(i.id)}">${c.pinned.includes(i.id)?'Unpin':'Pin'}</button>${['top','outerwear'].includes(slot)?`<label class="sm-layer">Layer<select data-sm-layer="${esc(i.id)}"><option value="0" ${!i.layer?'selected':''}>Inner</option><option value="1" ${i.layer===1?'selected':''}>Middle</option><option value="2" ${i.layer===2?'selected':''}>Outer</option></select></label>`:''}<button data-sm="help" data-slot="${slot}" data-id="${esc(i.id)}">AI help</button><button data-sm="correct" data-id="${esc(i.id)}">Correct</button><button data-sm="remove" data-id="${esc(i.id)}" ${c.pinned.includes(i.id)?'disabled':''} aria-label="Remove ${esc(i.name)}">Remove</button></div></div>`).join('')||'<span class="sm-slot-empty">Drop or add a piece</span>'}</section>`).join('')}</div>
   ${editingItemId?correctionForm():''}<div class="sm-tray"><details class="sm-reference-add"><summary>Add a garment reference photo</summary><p>Choose a photo with one outfit or garment. The shared photo reader sends it to the configured AI provider. Detected pieces remain suggested references until you confirm ownership.</p><label class="sm-consent"><input type="checkbox" data-sm-reference-consent> I agree to AI processing of this garment reference.</label><input type="file" data-sm-reference accept="image/jpeg,image/png,image/webp" aria-label="Garment reference photo"></details><div class="sm-chip-row" role="group" aria-label="Garment categories">${Object.entries(labels).map(([slot,label])=>`<button data-sm="category" data-slot="${slot}" aria-pressed="${slot===filter}">${label}</button>`).join('')}</div><label class="sm-search-label">Find a piece<input data-sm-search placeholder="Search this category"></label><div class="sm-tray-items">${pool.map(i=>`<button class="sm-tray-item" data-sm="add" data-id="${esc(i.id)}" data-sm-name="${esc(i.name.toLowerCase())}" draggable="true" data-sm-drag="${esc(i.id)}" ${c.items.some(x=>x.id===i.id)?'disabled':''}>${garmentImage(i)}<strong>${esc(i.name)}</strong><span>${badge(i)}</span><span class="sm-add-label">+ Add</span></button>`).join('')||'<p>No pieces here yet. Describe one below.</p>'}</div>
   <form data-sm-form="piece" class="sm-custom-piece"><input name="name" maxlength="150" placeholder="Describe a piece, e.g. my navy kurta" aria-label="Garment name" required><select name="ownership" aria-label="Ownership"><option value="unowned">Suggested concept</option><option value="user-described">I own this</option></select><button type="submit">Add ${esc(labels[filter].toLowerCase())}</button></form></div>
   <div class="sm-freeze-summary"><strong>${c.items.length} pieces · ${c.items.filter(i=>i.ownership!=='unowned').length} described as owned</strong><p>${issues.length?esc(issues.map(i=>i.message).join(' ')):'Ready to freeze. This saves the selected pieces and brief as an exact version.'}</p><button class="sm-primary" data-sm="freeze" ${issues.length||busy?'disabled':''}>Freeze design ❄</button></div>
   ${session.frozen.length?`<label class="sm-frozen-picker">Frozen versions<select data-sm-frozen>${session.frozen.map(d=>`<option value="${d.id}" ${d.id===frozenId?'selected':''}>Revision ${d.outfitRevision} · ${d.items.length} pieces</option>`).join('')}</select></label>`:''}${f?`<section class="sm-frozen" aria-label="Frozen outfit design"><span class="sm-eyebrow">FROZEN · REVISION ${f.outfitRevision}</span><h3>Your chosen design</h3><div class="sm-frozen-pieces">${f.items.map(piece).join('')}</div><div class="sm-chip-row"><button data-sm="fork" data-id="${f.id}">Edit a copy</button><button data-sm="save">Save look</button></div>${previewPanel(f)}</section>`:''}</section>`;
 }
 function correctionForm(){
  const i=session.canvas.items.find(item=>item.id===editingItemId);if(!i)return '';
  return `<form data-sm-form="correct" data-id="${esc(i.id)}" class="sm-correction"><h3>Make this piece accurate</h3><label>Name<input name="name" value="${esc(i.name)}" maxlength="150" required></label><label>Category<select name="slot">${Object.entries(labels).map(([slot,label])=>`<option value="${slot}" ${i.slot===slot?'selected':''}>${label}</option>`).join('')}</select></label><label>Colour<input name="colour" value="${esc(i.colour||'')}" maxlength="40"></label><label>Ownership<select name="ownership"><option value="unowned" ${i.ownership==='unowned'?'selected':''}>Suggested reference</option><option value="user-described" ${i.ownership!=='unowned'?'selected':''}>I own this</option></select></label><div class="sm-chip-row"><button type="submit" class="sm-primary">Save correction</button><button type="button" data-sm="cancel-correction">Cancel</button></div><p class="sm-muted">This changes the styling piece. Adding it to My Wardrobe is a separate action.</p></form>`;
 }
 function previewPanel(f){
  const jobs=Object.values(session.jobs).filter(j=>j.designId===f.id);
  return `<div class="sm-preview-panel"><h3>See it on me</h3><p>Upload a clear full-body photo. Your photo goes to Google’s image service only when you confirm generation. Where available, garment references are included. Pieces without references are reconstructed from descriptions and may differ.</p><p class="sm-muted">${esc(config?.retention||'')}</p>
  ${config?.preview?'':`<p class="sm-warning">Personal preview needs provider configuration. Your frozen design is saved; no image has been generated.</p>`}
  <label class="sm-photo-label">${photo?'Change my reference photo':'Choose my reference photo'}<input type="file" data-sm-photo accept="image/jpeg,image/png,image/webp" ${config?.preview?'':'disabled'}></label>${photo?`<div class="sm-reference"><img src="${esc(photo)}" alt="Your chosen original reference photo"><span>${esc(photoName)}</span><button data-sm="clear-photo">Remove photo</button></div>`:''}
  <label class="sm-consent"><input type="checkbox" data-sm-consent ${config?.preview?'':'disabled'}> I agree to send this photo to Google for an illustrative preview and use ${config?.previewCredits||8} preview credits. Retrying after failure is refunded.</label><button class="sm-primary" data-sm="preview" ${!photo||!config?.preview||busy?'disabled':''}>${busy?'Processing…':'Generate on-self preview'}</button>
  ${jobs.map(j=>`<div class="sm-preview-job" role="status"><strong>${esc(j.status==='processing'?'Rendering your frozen outfit…':j.status)}</strong>${j.error?`<p>${esc(j.error)}</p>`:''}${j.result?`<img src="${esc(j.result.image)}" alt="Illustrative on-self preview of frozen revision ${f.outfitRevision}"><p>${esc(j.result.label)}</p>`:''}<button data-sm="delete-preview" data-id="${j.id}">${['queued','processing'].includes(j.status)?'Cancel and delete':'Delete preview'}</button></div>`).join('')}</div>`;
 }
 function render(){
  if(loading)return '<section class="sm-root"><h1>Style Me</h1><p role="status">Opening your styling studio…</p></section>';
  if(!session)return `<section class="sm-root"><h1>Style Me</h1><p role="alert">${esc(error)}</p><button data-sm="retry-init">Retry</button></section>`;
  return `<section class="sm-root"><header class="sm-header"><div><span class="sm-eyebrow">STYLE ME · PERSONAL STUDIO</span><h1>What are we dressing for?</h1><p>Use what you have. Explore what you could wear.</p></div><button data-sm="new" ${busy?'disabled':''}>New session</button></header>
   <div class="sm-workspace ${canvasOpen?'has-canvas':''}"><div class="sm-conversation"><div class="sm-brief"><label>Style with<select data-sm-brief="mode"><option value="from-scratch" ${draftBrief.mode==='from-scratch'?'selected':''}>Start from scratch</option><option value="mixed" ${draftBrief.mode==='mixed'?'selected':''}>Owned + new</option><option value="owned-only" ${draftBrief.mode==='owned-only'?'selected':''}>Only what I own</option></select></label><details><summary>Your styling brief</summary><div class="sm-brief-fields">${field('occasion','Occasion','Office, wedding, beach…')}${field('location','Place','City or venue')}${field('weather','Conditions','Warm, rainy, air-conditioned…')}${field('aesthetic','Aesthetic','Relaxed, tailored, festive…')}${field('exclusions','Avoid','Heels, leather, jackets…')}${field('budget','New-piece budget · ₹','Optional')}</div><p class="sm-muted">Weather is user-provided. Concept suggestions have no verified prices.</p><div class="sm-chip-row"><button data-sm="remember-preferences">Remember these preferences</button><button data-sm="reset-preferences">Reset remembered preferences</button></div></details></div>
   <div class="sm-messages" aria-label="Styling conversation">${session.messages.length?session.messages.map(m=>`<div class="sm-message ${m.role==='user'?'sm-user':'sm-agent'}"><span>${m.role==='user'?'YOU':m.provider==='curated'?'STARTER STYLIST':'STYLIST'}</span><p>${esc(m.text)}</p></div>`).join(''):`<div class="sm-welcome"><span class="sm-spark">✦</span><h2>Your next look starts here.</h2><p>Describe an occasion, start with a piece, or play in Canvas. You don’t need a wardrobe to begin.</p><div class="sm-prompts">${['A beach evening in Mangalore','A polished office look','A festive look with a kurta'].map(q=>`<button data-sm="prompt" data-prompt="${esc(q)}">${q} ↗</button>`).join('')}</div></div>`}</div>
   ${provisional?'<p class="sm-muted">Starter draft · editable while the AI works. This is not yet an AI-personalized answer.</p>':''}${error?`<p class="sm-error" role="alert">${esc(error)}</p>`:''}${busy?'<p class="sm-progress" role="status" aria-live="polite">Working on your request. Your current design is kept.</p>':''}
   <div class="sm-options">${session.looks.map(l=>`<article class="sm-look"><div class="sm-mini-board">${l.items.map(piece).join('')}</div><h3>${esc(l.title)}</h3><p>${esc(l.rationale)}</p><p>${esc(l.instructions)}</p><span class="sm-muted">${l.gaps.length?`${l.gaps.length} suggested additions: ${esc(l.gaps.join(', '))}`:'Uses only your described owned pieces.'}</span>${l.assumptions?.length?`<details><summary>Assumptions</summary><ul>${l.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></details>`:''}<button data-sm="select" data-id="${l.id}">Make this mine → Canvas</button></article>`).join('')}</div>
   <div class="sm-chip-row"><button data-sm="open-canvas">${canvasOpen?'Canvas is open':'Open Canvas'} ✦</button>${session.canvas.items.length?'<button data-sm="feedback" data-reason="wearable">I would wear this</button>':''}</div><form data-sm-form="chat" class="sm-composer"><textarea name="prompt" placeholder="Tell me the occasion, or what you want to change…" aria-label="Your styling request" maxlength="2000" required>${esc(draftBrief.request||'')}</textarea><div><span class="sm-muted">${config?.ai?`AI styling · ${config.stylingCredits} credits`:'Curated starter mode · AI is not configured'}</span><button class="sm-primary" type="submit" ${busy?'disabled':''}>Style me ↗</button></div></form>
   <details class="sm-sessions"><summary>Saved sessions & frozen looks</summary>${sessions.map(s=>`<div><button data-sm="load" data-id="${s.id}">${esc(s.title)}</button><button data-sm="delete-session" data-id="${s.id}" aria-label="Delete ${esc(s.title)}">Delete</button></div>`).join('')}<p class="sm-muted">Guest sessions stay with this browser. Sign in to save them to your account; cross-device sync needs database configuration.</p></details></div>${canvasOpen?canvas():''}</div></section>`;
 }
 async function mutate(action,body={}){
  const id=session.id,revision=session.canvas.revision;
  const result=await api(`sessions/${id}/${action}`,{requestId:uuid(),revision,...body});
  if(session.id===id){session=result;remember();draw();}return result;
 }
 async function edit(action){return mutate('edit',{action});}
 async function add(id){
  const pool=[...wardrobeProvider().map(normalize),...(session?.referenceItems||[]),...(config?.essentials||[])],item=pool.find(i=>i.id===id);if(!item)return;
  const existing=session.canvas.items.find(i=>i.slot===item.slot);
  if(existing&&!['accessory','outerwear'].includes(item.slot))await edit({type:'replace',itemId:existing.id,item});else await edit({type:'add',item});
  announce(`${item.name} added to Canvas.`);
 }
 async function generate(request){
  const brief={...currentBrief(),request},id=session.id;draftBrief=brief;
  busy=true;error='';draw();
  try{const result=await api(`sessions/${id}/generate`,{requestId:uuid(),revision:session.canvas.revision,brief,wardrobe:[...wardrobeProvider().map(normalize),...session.canvas.items.filter(i=>i.ownership==='user-described')]},'POST',event=>{if(event.type==='draft'&&session.id===id){session=event.session;provisional=true;draw();}});provisional=false;if(session.id===id){session=result;draftBrief={...result.canvas.brief,request:''};remember();if(canvasOpen&&session.looks[0]){await mutate('select',{lookId:session.looks[0].id});announce('The first styling option is in Canvas. Back to conversation shows all alternatives.');}}}
  finally{busy=false;draw();}
 }
 async function handle(button){
  error=''; const action=button.dataset.sm,id=button.dataset.id;
  if(action==='retry-init'){loading=true;draw();return init();}
  if(action==='new'){await start();canvasOpen=false;draw();return;}
  if(action==='open-canvas'){canvasOpen=true;draw();return;}
  if(action==='close-canvas'){canvasOpen=false;draw();return;}
  if(action==='category'){filter=button.dataset.slot;draw();return;}
  if(action==='prompt'){if(busy)return;return generate(button.dataset.prompt);}
  if(action==='load'){if(busy)return;photo=null;photoName='';await load(id);canvasOpen=true;draw();return;}
  if(action==='select'){await mutate('select',{lookId:id});canvasOpen=true;draw();return;}
  if(action==='add')return add(id);
  if(action==='remove')return edit({type:'remove',itemId:id});
  if(action==='pin')return edit({type:session.canvas.pinned.includes(id)?'unpin':'pin',itemId:id});
  if(action==='undo')return edit({type:'undo'});
  if(action==='empty'){for(const i of [...session.canvas.items])if(!session.canvas.pinned.includes(i.id))await edit({type:'remove',itemId:i.id});return;}
  if(action==='remember-preferences'){preferences=(await api('preferences',currentBrief())).preferences;announce('Mode, aesthetic, exclusions and budget remembered. Your place and weather are session-only.');return;}
  if(action==='reset-preferences'){preferences=(await api('preferences',null,'DELETE')).preferences;announce('Remembered preferences cleared. This session brief is unchanged.');return;}
  if(action==='correct'){editingItemId=id;draw();document.querySelector('.sm-correction input')?.focus();return;}
  if(action==='cancel-correction'){editingItemId=null;draw();return;}
  if(action==='help')return generate(`Suggest a better ${labels[button.dataset.slot].toLowerCase()} choice for this outfit. Preserve pinned pieces. Current pieces: ${session.canvas.items.map(i=>i.name).join(', ')}.`);
  if(action==='freeze'){await edit({type:'brief',patch:currentBrief()});await mutate('freeze');frozenId=session.frozen.at(-1).id;announce('Design frozen. Later edits create a separate version.');draw();document.querySelector('.sm-frozen')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
  if(action==='fork'){await mutate('fork',{designId:id});draftBrief={...session.canvas.brief};frozenId=null;draw();return;}
  if(action==='save'){sessions=(await api('sessions')).sessions;announce('Your look is saved in this private session.');draw();return;}
  if(action==='feedback'){await mutate('feedback',{reason:button.dataset.reason});announce('Feedback saved.');return;}
  if(action==='clear-photo'){if(activePreviewJob)session=await api(`sessions/${session.id}/preview/${activePreviewJob}`,null,'DELETE');photo=null;photoName='';draw();return;}
  if(action==='delete-preview'){session=await api(`sessions/${session.id}/preview/${id}`,null,'DELETE');photo=null;draw();return;}
  if(action==='delete-session'){if(!confirm('Delete this styling session, its frozen looks and preview results?'))return;await api('sessions/'+id,null,'DELETE');sessions=(await api('sessions')).sessions;if(session.id===id)await start();draw();return;}
  if(action==='preview'){
   if(!document.querySelector('[data-sm-consent]')?.checked)throw new Error('Confirm photo processing and credit cost before generation.');
   const sid=session.id,designId=frozenId,input=photo;const garmentImages=frozen().items.map(i=>{const original=wardrobeProvider().find(p=>String(p.id)===i.id);return original?.image?.startsWith('data:image/')&&original.image.length<=300000?{id:i.id,image:original.image}:null;}).filter(Boolean);busy=true;draw();
   const poll=async()=>{try{const fresh=await api('sessions/'+sid);if(session.id===sid){session=fresh;draw();}}catch{}if(busy)pollTimer=setTimeout(poll,2500);};pollTimer=setTimeout(poll,1000);
   try{activePreviewJob=uuid();await api(`sessions/${sid}/preview`,{jobId:activePreviewJob,designId,photo:input,garmentImages,consent:true,costAccepted:true});if(session.id===sid)session=await api('sessions/'+sid);}
   finally{busy=false;activePreviewJob=null;clearTimeout(pollTimer);photo=null;photoName='';draw();}
  }
 }
 const onError=async e=>{error=e.message;if(e.status===409&&session){try{await load(session.id);}catch{}}draw();};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-sm]');if(b&&!b.disabled)handle(b).catch(onError);});
 document.addEventListener('submit',e=>{
  if(!e.target.dataset.smForm)return;e.preventDefault();const data=new FormData(e.target);
  if(e.target.dataset.smForm==='chat')generate(String(data.get('prompt'))).catch(onError);
  if(e.target.dataset.smForm==='correct'){
   const own=data.get('ownership')==='user-described';edit({type:'describe',itemId:e.target.dataset.id,patch:{name:String(data.get('name')).trim(),slot:data.get('slot'),colour:String(data.get('colour')).trim(),ownership:own?'user-described':'unowned',source:own?'described':'concept'}}).then(()=>{editingItemId=null;draw();}).catch(onError);
  }
  if(e.target.dataset.smForm==='piece'){
   const own=data.get('ownership')==='user-described';edit({type:'add',item:{id:'manual-'+uuid(),name:String(data.get('name')).trim(),slot:filter,colour:'',source:own?'described':'concept',ownership:own?'user-described':'unowned',assetVersion:'1'}}).catch(onError);
  }
 });
 document.addEventListener('change',async e=>{
  if(e.target.hasAttribute('data-sm-frozen')){frozenId=e.target.value;draw();return;}
  if(e.target.hasAttribute('data-sm-layer')){edit({type:'layer',itemId:e.target.dataset.smLayer,layer:Number(e.target.value)}).catch(onError);return;}
  if(e.target.dataset.smBrief){draftBrief[e.target.dataset.smBrief]=e.target.value;return;}
  if(e.target.hasAttribute('data-sm-reference')){
   const file=e.target.files?.[0];if(!file)return;
   try{if(!document.querySelector('[data-sm-reference-consent]')?.checked)throw new Error('Confirm garment-photo processing before upload.');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1800000)throw new Error('Choose a supported image under 1.8 MB.');busy=true;draw();const image=await window.Importers.toDataUrl(file,1200);session=await api(`sessions/${session.id}/reference`,{requestId:uuid(),image,consent:true});announce('Reference pieces added to the tray. Check their categories and ownership.');}catch(err){onError(err);}finally{busy=false;draw();}return;
  }
  if(!e.target.hasAttribute('data-sm-photo'))return;
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1_800_000)throw new Error('Choose a JPEG, PNG or WebP photo under 1.8 MB.');
   photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Photo could not be read.'));reader.readAsDataURL(file);});photoName=file.name;draw();
  }catch(err){onError(err);}
 });
 document.addEventListener('input',e=>{if(e.target.hasAttribute('data-sm-search'))document.querySelectorAll('[data-sm-name]').forEach(card=>{card.hidden=!card.dataset.smName.includes(e.target.value.toLowerCase());});});
 document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-sm-drag]');if(card)e.dataTransfer.setData('application/x-wos-garment',card.dataset.smDrag);});
 document.addEventListener('dragover',e=>{if(e.target.closest('[data-sm-drop]'))e.preventDefault();});
 document.addEventListener('drop',e=>{const slot=e.target.closest('[data-sm-drop]');if(!slot)return;e.preventDefault();const id=e.dataTransfer.getData('application/x-wos-garment');const candidate=[...wardrobeProvider().map(normalize),...(session?.referenceItems||[]),...(config?.essentials||[])].find(i=>i.id===id);if(candidate&&candidate.slot===slot.dataset.smDrop)add(id).catch(onError);else announce('Choose a piece for that garment category.');});
 window.addEventListener('account-change',()=>{if(session)api('sessions/'+session.id).then(data=>{session=data;draw();}).catch(()=>{session=null;init();});});
 setTimeout(init,0);
 return {render,async styleItem(item){try{if(loading)await init();canvasOpen=true;const piece=normalize(item),existing=session.canvas.items.find(i=>i.slot===piece.slot);await edit(existing?{type:'replace',itemId:existing.id,item:piece}:{type:'add',item:piece});draw();}catch(e){onError(e);}},registerWardrobeAdapter(provider){wardrobeProvider=provider;draw();}};
}
