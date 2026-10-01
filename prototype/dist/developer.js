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
  </form>
  <div class="dev-title qa-history-title"><div><span class="eyebrow">QA history</span><h2>What you have reported</h2></div><button class="link-btn" data-qa-refresh>Refresh</button></div>
  <div id="qa-history"><div class="dev-empty"><p>Loading your QA notes…</p></div></div>`;
 const stamp=v=>{try{return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return '—';}};
 const qaTable=items=>items.length?`<div class="dev-table-wrap"><table class="dev-table qa-table"><thead><tr><th>Screenshot</th><th>Note</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${items.map(q=>`<tr><td><a href="/api/developer/qa/${esc(q.id)}/image" target="_blank" rel="noopener" aria-label="Open screenshot full size"><img class="qa-thumb" src="/api/developer/qa/${esc(q.id)}/image" alt="" loading="lazy"></a></td><td class="qa-note">${esc(q.note)}${q.resolution?`<small>Resolution: ${esc(q.resolution)}</small>`:''}</td><td>${stamp(q.createdAt)}</td><td><span class="dev-status ${q.status==='resolved'?'healthy':'warn'}">${q.status==='resolved'?'Resolved':'Open'}</span></td></tr>`).join('')}</tbody></table></div>`:empty('No QA notes yet','Send your first screenshot above; it will be listed here.');
 async function loadQa(){const el=document.getElementById('qa-history');if(!el)return;try{const r=await fetch('/api/developer/qa',{headers:{Accept:'application/json'}});if(!r.ok)throw Error('QA history could not be loaded.');const {items}=await r.json();if(document.getElementById('qa-history'))document.getElementById('qa-history').innerHTML=qaTable(items);}catch(e){if(document.getElementById('qa-history'))document.getElementById('qa-history').innerHTML=empty('QA history unavailable',e.message);}}

 // Model lab: published runs are static files (dist/evals), so they show on any host; starting a run needs the local server.
 const lab={runs:[],status:null,selected:'',summary:null,poll:null};
 const pc=v=>v===null||v===undefined?'—':(v*100).toFixed(1)+'%';
 const money=v=>v===null||v===undefined?'—':v===0?'$0':v<0.01?'$'+v.toFixed(4):v<10?'$'+v.toFixed(2):'$'+Math.round(v);
 const labView=()=>`<div class="dev-head"><div><div class="eyebrow">Model lab</div><h1>Which model should <em>read</em> the screenshot?</h1><p>Every candidate model scored on the same labelled screenshots and Indian shopping queries: accuracy, failures, speed and cost per 1,000 calls.</p></div></div><div id="lab-root"><div class="dev-loading"><span class="dev-pulse"></span><div><strong>Loading model lab…</strong></div></div></div>`;
 async function getJson(url){try{const r=await fetch(url,{headers:{Accept:'application/json'}});return r.ok?await r.json():null;}catch{return null;}}
 function runForm(st){
  const byTier=st.tiers.map(t=>({...t,models:st.models.filter(m=>m.tier===t.id)})).filter(t=>t.models.length);
  return `<form id="lab-form" class="lab-form"><fieldset><legend>Models</legend><div class="lab-tiers">${byTier.map(t=>`<label class="lab-check"><input type="checkbox" name="tier" value="${esc(t.id)}" ${t.id==='cheap'?'checked':''}><span><strong>${esc(t.label)}</strong><small>${t.models.map(m=>esc(m.label)+(m.keyReady?'':' (no key)')+(m.enabled?'':' (opt-in)')).join(' · ')}</small></span></label>`).join('')}</div></fieldset>
  <div class="lab-row"><label class="lab-check"><input type="checkbox" name="task" value="look" checked><span>Screenshots</span></label><label class="lab-check"><input type="checkbox" name="task" value="query" checked><span>Keyword queries</span></label>
  <label>Items per task<input type="number" name="limit" min="1" max="500" placeholder="all"></label><label>Repeats<select name="repeat"><option>1</option><option>2</option><option>3</option></select></label><label>Spend cap (USD)<input type="number" name="maxUsd" min="0.05" max="25" step="0.05" value="2"></label></div>
  <button type="submit" class="btn">Start run</button><p class="qa-status" data-lab-status hidden></p></form>`;
 }
 function progress(r){const p=r.total?Math.round(r.done/r.total*100):0;return `<div class="lab-progress"><div class="row between"><strong>${r.finishedAt?(r.error?'Run failed':'Run finished'):'Running '+esc(r.runId)}</strong><span class="note">${r.done}/${r.total} calls · spent ${money(r.spentUsd)} of ≈${money(r.estimateUsd)}</span></div><div class="lab-bar"><i style="width:${p}%"></i></div>${r.error?`<p class="qa-status error">${esc(r.error)}</p>`:''}${r.last&&!r.last.ok?`<p class="note">Last failure: ${esc(r.last.model)} · ${esc(r.last.error)}</p>`:''}${r.finishedAt?'':'<button class="link-btn" data-lab-cancel>Stop after in-flight calls</button>'}</div>`;}
 const board=(rows,task)=>`<div class="dev-table-wrap"><table class="dev-table"><thead><tr><th>#</th><th>Model</th><th>Tier</th><th>Score</th>${task==='look'?'<th>Items found</th><th>Precision</th>':''}<th>Failures</th><th>p50</th><th>$ / 1k</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${esc(r.label)}</strong><small>${esc(r.provider)}${r.openWeights?' · open weights':''}${r.priceVerified?'':' · price unverified'}</small></td><td>${esc(r.tier)}</td><td>${pc(r.score)}${r.scoreSe?`<small>±${(1.96*r.scoreSe*100).toFixed(1)}</small>`:''}</td>${task==='look'?`<td>${pc(r.recall)}</td><td>${pc(r.precision)}</td>`:''}<td><span class="dev-status ${r.okRate<0.97?'warn':'healthy'}">${pc(1-r.okRate)}</span></td><td>${duration(r.latencyP50)}</td><td>${money(r.costPer1k)}</td></tr>`).join('')}</tbody></table></div>`;
 function labBody(){
  const st=lab.status,s=lab.summary,run=lab.runs.find(r=>r.runId===lab.selected);
  const chart=t=>run?.source==='local'?`/api/developer/evals/runs/${esc(run.runId)}/frontier-${t}.svg`:`/evals/${esc(lab.selected)}-frontier-${t}.svg`;
  const rows=t=>(s?.rows||[]).filter(r=>r.task===t).sort((a,b)=>(b.score??0)-(a.score??0));
  return `${st?.enabled?`<section class="dev-section"><div class="dev-title"><div><span class="eyebrow">New run</span><h2>Test models on your golden set</h2></div><p>Runs on this machine with your API keys. Cached answers are free; the cap stops spending.</p></div>${st.running&&!st.running.finishedAt?progress(st.running):runForm(st)+(st.running?progress(st.running):'')}</section>`:''}
  <section class="dev-section"><div class="dev-title"><div><span class="eyebrow">Results</span><h2>${s?`${s.config.models.length} models · ${s.dataset.looks} images · ${s.dataset.queries} queries`:'No runs yet'}</h2></div>${lab.runs.length?`<select data-lab-run aria-label="Choose a run">${lab.runs.map(r=>`<option value="${esc(r.runId)}" ${r.runId===lab.selected?'selected':''}>${esc(r.runId)} · ${r.source}${r.mock?' · simulated':''}</option>`).join('')}</select>`:''}</div>
  ${!s?empty('Nothing to show yet',st?.enabled?'Start a small run above, for example the cheap tier with 5 items per task.':'Run `node evals/cli.mjs run` locally, then `publish` it to show it here.'):`${s.mock?'<p class="lab-warning">Simulated data from the mock provider. These numbers are not real model results.</p>':''}
  <div class="dev-kpis"><article><span>Models</span><strong>${s.config.models.length}</strong><small>${[...new Set(s.config.models.map(m=>m.tier))].length} price tiers</small></article><article><span>Golden set</span><strong>${s.dataset.looks+s.dataset.queries}</strong><small>${s.dataset.looks} images · ${s.dataset.queries} queries</small></article><article><span>Spent</span><strong>${money(s.spentUsd)}</strong><small>estimate ${money(s.estimateUsd)}</small></article><article><span>Taxonomy</span><strong class="lab-small-kpi">${esc(s.taxonomyVersion)}</strong><small>prompt ${esc(s.promptVersion)}</small></article></div>
  ${(s.findings||[]).length?`<ul class="lab-findings">${s.findings.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}
  ${rows('look').length?`<h3 class="lab-h">Screenshot understanding</h3><img class="lab-chart" src="${chart('look')}" alt="Accuracy versus cost per model for screenshots">${board(rows('look'),'look')}`:''}
  ${rows('query').length?`<h3 class="lab-h">Keyword understanding</h3>${board(rows('query'),'query')}`:''}`}</section>`;
 }
 function paintLab(){const el=document.getElementById('lab-root');if(el)el.innerHTML=labBody();}
 async function selectRun(id){lab.selected=id;const run=lab.runs.find(r=>r.runId===id);lab.summary=run?await getJson(run.source==='local'?`/api/developer/evals/runs/${encodeURIComponent(id)}`:`/evals/${encodeURIComponent(id)}.json`):null;paintLab();}
 async function loadLab(){
  const [published,status]=await Promise.all([getJson('/evals/index.json'),getJson('/api/developer/evals/status')]);lab.status=status;
  const pub=(published?.runs||[]).map(r=>({...r,source:'published'}));const local=(status?.recent||[]).filter(r=>!pub.some(p=>p.runId===r.runId)).map(r=>({...r,source:'local'}));
  lab.runs=[...pub,...local].sort((a,b)=>String(b.runId).localeCompare(String(a.runId)));
  if(!lab.runs.some(r=>r.runId===lab.selected))lab.selected=lab.runs[0]?.runId||'';
  await selectRun(lab.selected);
  clearTimeout(lab.poll);if(status?.running&&!status.running.finishedAt&&location.hash==='#developer')lab.poll=setTimeout(loadLab,2000);
 }
 document.addEventListener('change',e=>{const sel=e.target.closest('[data-lab-run]');if(sel)selectRun(sel.value);});
 document.addEventListener('click',async e=>{if(!e.target.closest('[data-lab-cancel]'))return;await fetch('/api/developer/evals/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});loadLab();});
 document.addEventListener('submit',async e=>{
  const form=e.target.closest('#lab-form');if(!form)return;e.preventDefault();const statusEl=form.querySelector('[data-lab-status]'),button=form.querySelector('button[type=submit]');
  const fd=new FormData(form);const body={models:fd.getAll('tier'),tasks:fd.getAll('task'),limit:Number(fd.get('limit'))||undefined,repeat:Number(fd.get('repeat'))||1,maxUsd:Number(fd.get('maxUsd'))||2};
  statusEl.hidden=false;statusEl.className='qa-status';
  if(!body.models.length||!body.tasks.length){statusEl.className='qa-status error';statusEl.textContent='Pick at least one tier and one task.';return;}
  statusEl.textContent='Starting…';button.disabled=true;
  try{const r=await fetch('/api/developer/evals/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Could not start the run.');lab.selected=data.runId;await loadLab();}
  catch(err){statusEl.className='qa-status error';statusEl.textContent=err.message;button.disabled=false;}
 });
 const render=()=>`<div class="developer-dashboard"><div class="dev-section">${labView()}</div><div class="dev-section">${qaView()}</div><div id="${rootId}" style="display:contents"><div class="dev-loading"><span class="dev-pulse"></span><div><strong>Loading local telemetry…</strong><p>Reading this app session only.</p></div></div></div></div>`;
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
 function watch(){clearInterval(timer);load();loadQa();loadLab();timer=setInterval(()=>{if(location.hash==='#developer')load();else clearInterval(timer);},5000);}
 document.addEventListener('click',e=>{if(e.target.closest('[data-developer-refresh]'))load();if(e.target.closest('[data-qa-refresh]'))loadQa();});
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
   form.querySelector('[data-qa-filename]').textContent='Choose a screenshot';loadQa();
  }catch(err){statusEl.className='qa-status error';statusEl.textContent=err.message||'Something went wrong. Try again.';}
  finally{button.disabled=false;}
 });
 window.DeveloperDashboard={render,load:watch};
})();
