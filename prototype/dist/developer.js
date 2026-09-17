(()=>{
 const rootId='developer-dashboard-root';let timer=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=v=>{try{return new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v));}catch{return '—';}};
 const duration=v=>Number.isFinite(v)?(v<1000?`${v} ms`:`${(v/1000).toFixed(1)} s`):'—';
 const empty=(title,copy)=>`<div class="dev-empty"><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`;
 const qaView=()=>`<div class="dev-head"><div><div class="eyebrow">Mobile QA</div><h1>Report from your <em>phone.</em></h1><p>Pick a screenshot, add a note, send it. Claude reads it locally from this Mac to work through with you — nothing else uses it.</p></div></div>
  <form id="qa-form" class="qa-form">
   <label class="qa-file"><input type="file" name="image" accept="image/*" required><span data-qa-filename>Choose a screenshot</span></label>
   <textarea name="note" placeholder="What did you notice?" maxlength="2000" required></textarea>
   <button type="submit" class="btn full">Send to QA</button>
   <p class="qa-status" data-qa-status hidden></p>
  </form>`;
 const render=()=>`<div class="developer-dashboard"><div class="dev-section">${qaView()}</div><div id="${rootId}" style="display:contents"><div class="dev-loading"><span class="dev-pulse"></span><div><strong>Loading local telemetry…</strong><p>Reading this app session only.</p></div></div></div></div>`;
 function view(data){
  const providers=data.providers||[],requests=[...(data.recentRequests||[])].reverse(),searches=[...(data.recentSearches||[])].reverse(),avoided=(data.totals.replays||0)+(data.totals.cacheHits||0);
  return `<div class="dev-head"><div><div class="eyebrow">Local developer tools</div><h1>Developer <em>observability.</em></h1><p>Live health, timings and search outcomes for this server session. Images, credentials and product URLs are excluded.</p></div><button class="btn secondary" data-developer-refresh>Refresh now</button></div>
  <div class="dev-config"><span class="dev-badge"><i class="ok"></i>${esc(data.config.visionProvider)} · ${esc(data.config.visionModel)}</span><span class="dev-badge">Search · ${data.config.shoppingConfigured?'configured':'not configured'}</span><span class="dev-badge">Lens · ${data.config.lensConfigured?'configured':'not configured'}</span><span class="dev-badge">Data · ${esc(data.config.dataMode)}</span><span class="dev-generated">Updated ${time(data.generatedAt)}</span></div>
  <div class="dev-kpis"><article><span>Provider calls</span><strong>${data.totals.requests}</strong><small>LLM + search requests</small></article><article><span>Failures</span><strong class="${data.totals.failures?'bad':''}">${data.totals.failures}</strong><small>Non-success responses</small></article><article><span>Searches</span><strong>${data.totals.searches}</strong><small>Current server session</small></article><article><span>Provider calls avoided</span><strong>${avoided}</strong><small>${data.totals.replays} replay · ${data.totals.cacheHits} cache</small></article></div>
  <section class="dev-section"><div class="dev-title"><div><span class="eyebrow">Provider health</span><h2>What is answering?</h2></div><p>p95 is the slowest typical request in this session.</p></div>${providers.length?`<div class="dev-provider-grid">${providers.map(p=>`<article><div class="row between"><strong>${esc(p.provider)}</strong><span class="dev-status ${p.failures?'warn':'healthy'}">${p.failures?'Needs attention':'Healthy'}</span></div><dl><div><dt>Calls</dt><dd>${p.requests}</dd></div><div><dt>Success</dt><dd>${p.requests?Math.round(p.successes/p.requests*100):0}%</dd></div><div><dt>Average</dt><dd>${duration(p.averageMs)}</dd></div><div><dt>p95</dt><dd>${duration(p.p95Ms)}</dd></div></dl></article>`).join('')}</div>`:empty('No provider calls yet','Analyze a screenshot or run a search to populate provider health.')}</section>
  <section class="dev-section"><div class="dev-title"><div><span class="eyebrow">API requests</span><h2>Recent provider activity</h2></div><p>Attempts are shown separately so retries remain visible.</p></div>${requests.length?`<div class="dev-table-wrap"><table class="dev-table"><thead><tr><th>Time</th><th>Provider</th><th>Operation</th><th>Attempt</th><th>Status</th><th>Duration</th></tr></thead><tbody>${requests.map(r=>`<tr><td>${time(r.at)}</td><td>${esc(r.provider)}</td><td><code>${esc(r.operation)}</code></td><td>${r.attempt}</td><td><span class="dev-code ${r.ok?'success':'failure'}">${esc(r.status)}</span></td><td>${duration(r.durationMs)}</td></tr>`).join('')}</tbody></table></div>`:empty('No API requests yet','This view will update automatically while the tab is open.')}</section>
  <section class="dev-section"><div class="dev-title"><div><span class="eyebrow">Search history</span><h2>What did discovery return?</h2></div><p>Descriptions and aggregate outcomes only.</p></div>${searches.length?`<div class="dev-table-wrap"><table class="dev-table search-history"><thead><tr><th>Time</th><th>Search</th><th>Market</th><th>Source</th><th>Duration</th><th>Found / kept</th></tr></thead><tbody>${searches.map(s=>`<tr><td>${time(s.at)}</td><td><strong>${esc(s.query||s.category||'Untitled search')}</strong><small>${esc(s.category||'')}</small></td><td>${esc((s.market||'').toUpperCase())}</td><td><span class="dev-source ${esc(s.source)}">${esc(s.source)}</span></td><td>${duration(s.durationMs)}</td><td>${s.retrieved??0} / ${s.results??0}</td></tr>`).join('')}</tbody></table></div>`:empty('No searches in this session','Run Discover once; live, replay and cache outcomes appear here.')}</section>`;
 }
 async function load(){
  const root=document.getElementById(rootId);if(!root)return;
  try{const r=await fetch('/api/developer/observability',{headers:{Accept:'application/json'}});if(!r.ok)throw Error(r.status===404?'Developer dashboard is disabled.':'Telemetry could not be loaded.');const data=await r.json();if(document.getElementById(rootId))document.getElementById(rootId).innerHTML=view(data);}catch(e){if(document.getElementById(rootId))document.getElementById(rootId).innerHTML=empty('Observability unavailable',e.message);}
 }
 function watch(){clearInterval(timer);load();timer=setInterval(()=>{if(location.hash==='#developer')load();else clearInterval(timer);},5000);}
 document.addEventListener('click',e=>{if(e.target.closest('[data-developer-refresh]'))load();});
 async function toJpegDataUrl(file,maxDim=1600,quality=.85){
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();
   const w=image.naturalWidth,h=image.naturalHeight,scale=Math.min(1,maxDim/Math.max(w,h)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
   canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',quality);
  }finally{URL.revokeObjectURL(url);}
 }
 document.addEventListener('change',e=>{const input=e.target.closest('#qa-form input[type=file]');if(!input)return;const label=input.closest('.qa-file').querySelector('[data-qa-filename]');label.textContent=input.files[0]?.name||'Choose a screenshot';});
 document.addEventListener('submit',async e=>{
  const form=e.target.closest('#qa-form');if(!form)return;e.preventDefault();
  const file=form.querySelector('input[type=file]').files[0],note=form.querySelector('textarea').value.trim(),statusEl=form.querySelector('[data-qa-status]'),button=form.querySelector('button[type=submit]');
  if(!file||!note){statusEl.hidden=false;statusEl.className='qa-status error';statusEl.textContent='Add a screenshot and a note first.';return;}
  statusEl.hidden=false;statusEl.className='qa-status';statusEl.textContent='Sending…';button.disabled=true;
  try{
   const image=await toJpegDataUrl(file);
   const r=await fetch('/api/developer/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,note})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Could not send this note.');
   statusEl.className='qa-status success';statusEl.textContent='Sent — Claude can pick this up next.';form.reset();
   form.querySelector('[data-qa-filename]').textContent='Choose a screenshot';
  }catch(err){statusEl.className='qa-status error';statusEl.textContent=err.message||'Something went wrong. Try again.';}
  finally{button.disabled=false;}
 });
 window.DeveloperDashboard={render,load:watch};
})();
