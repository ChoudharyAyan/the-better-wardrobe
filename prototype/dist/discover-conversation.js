(() => {
  // Discover search: ask in words, a screenshot or both, and get results straight away.
  // One question costs the chosen model's credits (120 = 8 Max or 15 Lite searches) and unlocks two
  // shopping searches: the first, plus one free refine. Chats are saved per guest (three in the beta).
  const state = {
    messages:[],draft:'',pending:null,busy:false,stage:'start',choices:[],source:null,followup:null,
    current:null,results:null,turn:null,controller:null,progress:'',loadingSince:0,showMallHint:false,
    model:'',wallet:null,menuOpen:false,editing:false,listening:false,
    chats:[],chatId:null,chatTitle:'',chatLimit:null,readyPill:false
  };
  const FALLBACK_MODELS=[{id:'gemini-3-flash',label:'Max',note:'Most accurate',credits:15},{id:'gpt-5-nano',label:'Lite',note:'More searches',credits:8}];
  const LOADING_LINES=['Reading your vibe…','Searching Myntra, AJIO and Amazon…','Checking Flipkart and Nykaa Fashion…','Comparing cuts, colours and details…','Finding the right fashion for you…'];
  const examples=['Find a relaxed brown blazer under ₹4,000','Show me a similar outfit from this screenshot','Where can I find a dress like the one at Cannes?'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const known = value => /^(unknown|n\/?a|none|not visible|unclear)$/i.test(String(value??'').trim())?'':String(value??'');
  const root = () => document.getElementById('discover-conversation');
  const hasFetch = () => typeof window.fetch==='function';
  const uuid = () => globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>Math.floor(Math.random()*16).toString(16));
  try{state.model=localStorage.getItem('tbw-discover-model')||'';}catch{}

  const models = () => state.wallet?.models?.length?state.wallet.models:FALLBACK_MODELS;
  const currentModel = () => models().find(m=>m.id===state.model)||models().find(m=>m.id===state.wallet?.defaultModel)||models()[0];
  const searchesLeft = model => state.wallet?Math.floor(state.wallet.remaining/model.credits):null;
  // The subtype ("suede jacket") is what people asked for; the category ("outerwear") is the shelf it sits on.
  const describe = a => [known(a?.colour),known(a?.subtype)||[known(a?.fit),known(a?.category)].filter(Boolean).join(' ')].filter(Boolean).join(' ');
  // Size variants of one product ("Cargos (36)", "Cargos (34)") are one match, not three.
  const variantKey = item => tidyTitle(item.title).toLowerCase().replace(/\(\s*(\d{2,3}|xs|s|m|l|xl|xxl|\d?xl)\s*\)/g,'').replace(/\bby myntra\b/g,'').replace(/[^a-z0-9]+/g,' ').trim()+'|'+String(item.merchant||'').toLowerCase();
  const distinct = list => {const seen=new Set();return list.filter(item=>{const k=variantKey(item);if(seen.has(k))return false;seen.add(k);return true;});};
  const tidyTitle = t => String(t||'').replace(/^buy\s+/i,'').replace(/\s*[-|]\s*(myntra|ajio|amazon\.in|flipkart|nykaa fashion).*$/i,'');

  // ---- server calls ---------------------------------------------------------------------------
  let walletRequested=false,chatsRequested=false;
  async function loadWallet(){if(walletRequested||!hasFetch())return;walletRequested=true;try{const r=await window.fetch('/api/discover/credits');if(r.ok){state.wallet=await r.json();paint();}}catch{}}
  async function loadChats(){if(chatsRequested||!hasFetch())return;chatsRequested=true;try{const r=await window.fetch('/api/discover/chats');if(r.ok){state.chats=(await r.json()).chats||[];paint();}}catch{}}
  async function request(action,body,signal){
    const response=await fetch(`/api/discover/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,model:currentModel().id,...(action==='search'&&state.turn?{turn:state.turn}:{})}),signal});
    let data;try{data=await response.json();}catch{throw new Error('The search service did not respond. Please retry.');}
    if(!response.ok)throw Object.assign(new Error(data.error||'Could not complete this search.'),{status:response.status});
    if(data.turn)state.turn=data.turn;
    if(data.credits&&state.wallet)state.wallet={...state.wallet,remaining:data.credits.remaining};
    return data;
  }

  // ---- saved chats ----------------------------------------------------------------------------
  // Screenshots are kept as small thumbnails so three chats fit comfortably in the guest's allowance.
  async function thumbnail(src){if(!src||!src.startsWith('data:')||typeof createImageBitmap!=='function')return src||null;try{const bitmap=await createImageBitmap(await (await fetch(src)).blob());const scale=Math.min(1,240/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.7);}catch{return null;}}
  async function snapshot(){
    const messages=await Promise.all(state.messages.slice(-30).map(async m=>({role:m.role,text:m.text||'',meta:m.meta||'',image:m.image?await thumbnail(m.image):null})));
    const results=state.results&&{results:(state.results.results||[]).slice(0,6),storeSearches:state.results.storeSearches||[],trace:state.results.trace||null,warnings:(state.results.warnings||[]).slice(0,2)};
    return {messages,current:state.current,results,stage:state.stage==='results'?'results':'start'};
  }
  async function saveChat(){
    if(!hasFetch()||!state.messages.length)return;
    state.chatId??=uuid();
    state.chatTitle||=(state.messages.find(m=>m.role==='user'&&m.text)?.text||'Screenshot search').slice(0,40);
    try{
      const r=await window.fetch(`/api/discover/chats/${state.chatId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:state.chatTitle,data:await snapshot()})});
      if(r.status===409){state.chatLimit={chats:(await r.json()).chats||[],retrySave:true};paint();return;}
      if(r.ok){const saved=await r.json();state.chats=[saved,...state.chats.filter(c=>c.id!==saved.id)].slice(0,3);paint();}
    }catch{}
  }
  async function openChat(id){
    if(state.busy||id===state.chatId)return;
    try{const r=await window.fetch(`/api/discover/chats/${id}`);if(!r.ok)throw new Error();const chat=await r.json();
      Object.assign(state,{messages:chat.data.messages||[],current:chat.data.current||null,results:chat.data.results||null,stage:chat.data.results?'results':'start',chatId:chat.id,chatTitle:chat.title,turn:null,followup:null,choices:[],editing:false,draft:'',pending:null});paint();}
    catch{state.messages.push({role:'assistant',text:'That chat could not be opened. Please try again.'});paint();}
  }
  function newChat(){
    if(state.busy)return;
    // Three saved chats already: ask which one to replace before starting a fourth.
    if(state.chats.length>=3&&!state.chats.some(c=>c.id===state.chatId&&!state.messages.length)){state.chatLimit={chats:state.chats,retrySave:false};paint();return;}
    startFresh();
  }
  function startFresh(){state.controller?.abort();Object.assign(state,{messages:[],draft:'',pending:null,busy:false,stage:'start',choices:[],source:null,followup:null,current:null,results:null,turn:null,progress:'',editing:false,chatId:null,chatTitle:'',chatLimit:null});paint(true);}
  async function deleteChat(id){
    try{const r=await window.fetch(`/api/discover/chats/${id}`,{method:'DELETE'});if(r.ok)state.chats=(await r.json()).chats||[];}catch{}
    const retry=state.chatLimit?.retrySave;state.chatLimit=null;
    if(id===state.chatId)state.chatId=null;
    if(retry)await saveChat();else startFresh();
  }

  // ---- search flow ----------------------------------------------------------------------------
  let rotation=null,hintTimer=null;
  function startLoading(label){
    state.busy=true;state.progress=label;state.loadingSince=Date.now();state.showMallHint=false;paint();
    let i=0;if(typeof setInterval==='function'){clearInterval(rotation);rotation=setInterval(()=>{i=(i+1)%LOADING_LINES.length;const line=document.getElementById?.('dc-loading-line');if(line)line.textContent=LOADING_LINES[i];},1800);}
    // Long searches: invite people to browse the mall and tell them when results land.
    if(typeof setTimeout==='function'){clearTimeout(hintTimer);hintTimer=setTimeout(()=>{if(state.busy){state.showMallHint=true;paint();}},4000);}
  }
  function stopLoading(){state.busy=false;state.progress='';state.showMallHint=false;if(typeof clearInterval==='function')clearInterval(rotation);if(typeof clearTimeout==='function')clearTimeout(hintTimer);}
  const metaFor = data => data.credits?(data.credits.cost?`${currentModel().label} · ${data.credits.cost} credits · ${data.credits.remaining} left`:`${currentModel().label} · free, nothing to search yet`):'';

  async function ask(text,image,target='',previous=null){
    state.controller=new AbortController();startLoading(LOADING_LINES[0]);
    try{
      const data=await request('interpret',{text,image,target,previous},state.controller.signal);
      if(data.question||!data.attributes){stopLoading();state.stage='clarify';state.followup={text,image,previous};state.messages.push({role:'assistant',meta:metaFor(data),text:data.question||'What kind of item should I look for?'});paint();saveChat();return;}
      state.current={attributes:data.attributes,query:data.query,budget:data.budget,uncertainty:data.uncertainty};state.followup=null;
      state.messages.push({role:'assistant',meta:metaFor(data),text:`Looking for ${describe(data.attributes)||'that piece'}${data.budget?` under ₹${Number(data.budget).toLocaleString('en-IN')}`:''}.`});
      await runSearch();
    }catch(error){stopLoading();if(error.name!=='AbortError')state.messages.push({role:'assistant',text:error.message||'I could not read that. Please try again.'});state.stage=state.results?'results':'start';paint();}
  }
  async function runSearch(){
    if(!state.current?.attributes)return;
    state.stage='loading';state.editing=false;state.controller??=new AbortController();if(!state.busy)startLoading(LOADING_LINES[1]);else paint();
    try{
      const {attributes,query,budget}=state.current;
      state.results=await request('search',{attributes,query,budget,market:'in',image:state.source?.image||undefined},state.controller.signal);
      state.stage='results';
      const found=Math.min(distinct(state.results.results||[]).length,6);
      state.messages.push({role:'assistant',text:found?`Found ${found} ${found===1?'match':'matches'}. Tap a piece to open it at the store.`:'No exact product matched this time. The store searches below are a good next step.'});
    }catch(error){if(error.name!=='AbortError'){state.stage=state.results?'results':'start';state.messages.push({role:'assistant',text:error.status===403?'That search used its free refine. Ask a new question to search again.':error.message||'The product search did not finish. Please retry.'});}}
    finally{stopLoading();state.controller=null;paint();if(state.stage==='results')flagReady();saveChat();}
  }
  async function send(){
    if(state.busy)return;const text=state.draft.trim(),image=state.pending;if(!text&&!image)return;
    stopListening();state.draft='';state.pending=null;state.messages.push({role:'user',text,image});
    const clarification=state.followup,previous=state.current||clarification?.previous||null;state.followup=null;
    const searchText=clarification?[clarification.text,text].filter(Boolean).join('. '):text,searchImage=image||clarification?.image||null;
    state.source={text:searchText,image:searchImage};state.stage='working';state.choices=[];
    if(searchImage&&!searchText){
      state.controller=new AbortController();startLoading('Reading the screenshot…');
      try{const detected=await request('detect',{image:searchImage},state.controller.signal);
        if(detected.items?.length>1){stopLoading();state.choices=detected.items;state.stage='choose';state.controller=null;state.messages.push({role:'assistant',text:'I can see a few pieces. Which one should I search for?'});paint();return;}
        if(detected.items?.length===1){const crop=await cropImage(searchImage,detected.items[0].crop);state.source.image=crop;stopLoading();await ask('',crop,detected.items[0].label);return;}
      }catch(error){if(error.name==='AbortError'){stopLoading();state.controller=null;paint();return;}}
      stopLoading();
    }
    await ask(searchText,searchImage,'',previous);
  }
  function refine(form){
    if(state.busy||!state.current)return;const data=new FormData(form),value=k=>String(data.get(k)||'').trim();
    if(!value('category')){state.messages.push({role:'assistant',text:'Tell me what kind of item it is first.'});paint();return;}
    state.current={...state.current,attributes:{...state.current.attributes,category:value('category'),colour:value('colour'),fit:value('fit'),details:value('details')},query:[value('colour'),value('details'),value('category')].filter(Boolean).join(' ')||state.current.query,budget:value('budget')?Number(value('budget')):null};
    state.messages.push({role:'user',text:`Update: ${describe(state.current.attributes)}${state.current.budget?` under ₹${state.current.budget.toLocaleString('en-IN')}`:''}`});
    runSearch();
  }

  // ---- results-ready pill ---------------------------------------------------------------------
  // Shown when results land while the person is elsewhere (the mall, another tab).
  function flagReady(){
    const section=document.querySelector?.('.dc-results'),onDiscover=!globalThis.location||/^#?(discover)?$/.test(globalThis.location.hash||'');
    const visible=section&&onDiscover&&section.getBoundingClientRect().top<(globalThis.innerHeight||0)&&section.getBoundingClientRect().bottom>0;
    state.readyPill=!visible;renderPill();
  }
  function renderPill(){
    if(!document.body||typeof document.createElement!=='function')return;
    let pill=document.getElementById('dc-ready-pill');
    if(!state.readyPill){pill?.remove();return;}
    if(!pill){pill=document.createElement('button');pill.id='dc-ready-pill';pill.type='button';pill.className='dc-ready-pill';pill.dataset.conversation='show-results';document.body.append(pill);}
    pill.textContent='Your results are ready ✨';
  }
  function showResults(){state.readyPill=false;renderPill();const go=()=>document.querySelector('.dc-results')?.scrollIntoView({behavior:'smooth',block:'start'});if(globalThis.location&&!/^#?(discover)?$/.test(location.hash)){location.hash='discover';setTimeout(go,350);}else go();}

  // ---- voice input (Web Speech API; needs https) -----------------------------------------------
  const Recognition = () => (typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition))||null;
  const voiceReady = () => Boolean(Recognition())&&window.isSecureContext!==false;
  let recognition=null;
  function startListening(){
    const SR=Recognition();if(!SR||state.busy)return;
    recognition=new SR();recognition.lang='en-IN';recognition.interimResults=true;recognition.continuous=false;
    const base=state.draft?state.draft.trim()+' ':'';
    recognition.onresult=e=>{const heard=[...e.results].map(r=>r[0].transcript).join('');state.draft=(base+heard).slice(0,500);const box=document.getElementById('dc-text');if(box)box.value=state.draft;};
    recognition.onerror=e=>{state.listening=false;if(e.error==='not-allowed')state.messages.push({role:'assistant',text:'Microphone access is blocked. Allow it in your browser to speak your search.'});paint();};
    recognition.onend=()=>{state.listening=false;paint(true);};
    try{recognition.start();state.listening=true;paint();}catch{state.listening=false;}
  }
  function stopListening(){try{recognition?.stop();}catch{}state.listening=false;}

  // ---- rendering ------------------------------------------------------------------------------
  const renderMessage = message => `<article class="dc-message ${message.role==='user'?'dc-user':'dc-assistant'}"><span class="dc-speaker">${message.role==='user'?'You':'The Better Wardrobe'}</span><div class="dc-bubble">${message.image?`<img src="${escape(message.image)}" alt="Uploaded fashion reference" class="dc-message-image">`:''}${message.text?`<p>${escape(message.text)}</p>`:''}${message.meta?`<small class="dc-meta">${escape(message.meta)}</small>`:''}</div></article>`;
  const renderChoices = () => state.stage!=='choose'?'':`<div class="dc-choice-panel"><p>Which piece should I look for?</p><div class="dc-choice-list">${state.choices.map((item,index)=>`<button type="button" data-conversation="choice" data-index="${index}">${escape(item.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div></div>`;
  const renderLoading = () => !state.busy?'':`<div class="dc-loading" role="status" aria-live="polite"><div class="dc-loading-orbit" aria-hidden="true"><i></i><i></i><i></i></div><p id="dc-loading-line">${escape(state.progress||LOADING_LINES[0])}</p>${state.showMallHint?`<div class="dc-mall-hint"><span>This one takes a moment. We’ll let you know when it’s ready.</span><button type="button" data-conversation="explore-mall">Explore the mall meanwhile ↓</button></div>`:''}<button type="button" class="dc-cancel" data-conversation="cancel">Cancel</button></div>`;
  const field = (label,name,value,placeholder='') => `<label><span>${label}</span><input name="${name}" value="${escape(known(value))}" placeholder="${escape(placeholder)}"></label>`;
  const renderUnderstood = () => {
    const c=state.current;if(!c?.attributes)return '';const a=c.attributes;
    const chips=[known(a.category),known(a.colour),known(a.fit),known(a.pattern),known(a.details),c.budget?`under ₹${Number(c.budget).toLocaleString('en-IN')}`:''].filter(Boolean);
    if(!state.editing)return `<div class="dc-understood"><span class="dc-kicker">Searched for</span><div class="dc-chips">${chips.map(x=>`<span>${escape(x)}</span>`).join('')}</div><button type="button" class="dc-edit" data-conversation="edit" ${state.busy?'disabled':''}>Edit ✎</button></div>`;
    return `<form id="dc-refine" class="dc-refine"><div class="dc-review-grid">${field('Item','category',a.category,'e.g. blazer')}${field('Colour','colour',a.colour,'Any colour')}${field('Fit','fit',a.fit,'Any fit')}${field('Detail','details',a.details,'Collar, fabric, print…')}${field('Budget in ₹','budget',c.budget??'','Optional')}</div><div class="dc-review-actions"><button type="submit" class="dc-main-button">Update results <span aria-hidden="true">→</span></button><button type="button" class="dc-edit" data-conversation="edit-cancel">Cancel</button><span>Updating is free for this search.</span></div></form>`;
  };
  const renderRetrieval = () => {
    const t=state.results?.trace;if(!t)return '';
    const routes=new Map();for(const entry of t.queries||[]){const [phrase,route]=String(entry).split(' · ');if(!routes.has(phrase))routes.set(phrase,[]);if(route)routes.get(phrase).push(route);}
    const queries=[...routes].slice(0,4),removed=(t.titleRejected||0)+(t.domesticRejected||0),shown=Math.min(distinct(state.results.results||[]).length,6),routeCount=(t.queries||[]).length;
    const seconds=t.elapsedMs?` · ${(t.elapsedMs/1000).toFixed(1)}s`:'';
    const step=(n,title,body)=>`<li><span class="dc-step-n">${n}</span><div><strong>${title}</strong>${body}</div></li>`;
    return `<details class="dc-retrieval"><summary>How I searched · ${routeCount} ${routeCount===1?'search':'searches'}${seconds}</summary><ol>${
      step(1,'Searched',`<div class="dc-queries">${queries.map(([q,via])=>`<span class="dc-query"><code>${escape(q)}</code>${via.length?`<small>${escape(via.join(' · '))}</small>`:''}</span>`).join('')}</div>`)}${
      step(2,'Narrowed down',`<p>${t.retrieved||0} found${removed?` · ${removed} off-topic or outside India removed`:''}${t.visuallyAssessed?` · ${t.visuallyAssessed} compared against your piece`:''} · <b>${shown} shown</b></p>${t.providerFailures?.length?`<p class="dc-result-note">${t.providerFailures.length} source${t.providerFailures.length===1?' was':'s were'} slow and skipped.</p>`:''}`)}</ol></details>`;
  };
  const renderResults = () => {
    if(!state.results||!['results','loading'].includes(state.stage))return '';
    const {storeSearches=[]}=state.results,results=distinct(state.results.results||[]);
    const matches=results.length?`<div class="dc-result-grid">${results.slice(0,6).map(item=>`<a class="dc-result" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer"><div class="dc-result-image">${item.image?`<img src="${escape(item.image)}" alt="${escape(tidyTitle(item.title))}" loading="lazy">`:'<span>View at store</span>'}</div><div class="dc-result-copy"><small>${escape(item.merchant||'Store')}${item.market==='global'?' · Global':''}</small><strong>${escape(tidyTitle(item.title))}</strong><span>${escape(item.priceText||'See price at store')} ↗</span></div></a>`).join('')}</div>`:`<p class="dc-empty">No exact product matched this time. Try the stores below, or edit the details above.</p>`;
    const stores=storeSearches.length?`<div class="dc-stores"><span class="dc-kicker">Search it on</span><div class="dc-store-row">${storeSearches.map(s=>`<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.store)} ↗</a>`).join('')}</div></div>`:'';
    return `<section class="dc-results" aria-label="Shopping results">${renderUnderstood()}<div class="dc-results-head"><span class="dc-kicker">Matches</span><h3>${results.length?'Pieces that match':'Keep looking'}</h3></div>${matches}${stores}${renderRetrieval()}<p class="dc-result-note">Suggestions, not verified exact matches. Confirm size, delivery and availability with the store.</p></section>`;
  };
  const renderChats = () => {
    const list=state.chats;if(!list.length&&!state.messages.length)return '';
    const unsaved=state.messages.length&&!list.some(c=>c.id===state.chatId);
    return `<nav class="dc-chats" aria-label="Saved chats">${unsaved?`<span class="dc-chat active">${escape((state.chatTitle||state.messages.find(m=>m.role==='user'&&m.text)?.text||'New search').slice(0,24))}</span>`:''}${list.map(c=>`<button type="button" class="dc-chat ${c.id===state.chatId?'active':''}" data-conversation="open-chat" data-id="${escape(c.id)}">${escape(c.title.slice(0,24))}</button>`).join('')}<button type="button" class="dc-chat new" data-conversation="new-chat">＋ New chat</button></nav>`;
  };
  const renderChatLimit = () => !state.chatLimit?'':`<div class="dc-chat-limit" role="dialog" aria-label="Chat limit"><strong>You can keep 3 chats in the beta.</strong><p>${state.chatLimit.retrySave?'Delete one to save this chat.':'Delete one to start a new chat.'}</p><ul>${state.chatLimit.chats.map(c=>`<li><span>${escape(c.title)}</span><button type="button" data-conversation="delete-chat" data-id="${escape(c.id)}">Delete</button></li>`).join('')}</ul><button type="button" class="dc-edit" data-conversation="limit-cancel">Keep all</button></div>`;
  const renderModelMenu = () => {
    const m=currentModel();
    return `<div class="dc-model"><button type="button" class="dc-model-chip" data-conversation="model-menu" aria-haspopup="listbox" aria-expanded="${state.menuOpen}" ${state.busy?'disabled':''}>${escape(m.label)} · ${m.credits} credits <span aria-hidden="true">▾</span></button>${state.menuOpen?`<ul class="dc-model-menu" role="listbox" aria-label="Search model">${models().map(x=>`<li role="option" aria-selected="${x.id===m.id}"><button type="button" data-conversation="pick-model" data-id="${escape(x.id)}"><span><b>${escape(x.label)}</b><small>${escape(x.note)}${state.wallet?` · ${searchesLeft(x)} left`:''}</small></span><em>${x.credits} credits</em>${x.id===m.id?'<i aria-hidden="true">✓</i>':''}</button></li>`).join('')}</ul>`:''}</div>`;
  };
  const renderWallet = () => {if(!state.wallet)return '';const m=currentModel(),left=searchesLeft(m);return `<span class="dc-wallet ${state.wallet.remaining<m.credits?'empty':''}"><b>${state.wallet.remaining}</b> credits · ${left} ${left===1?'search':'searches'} left</span>`;};
  function content(){
    const voice=voiceReady()?`<button type="button" class="dc-mic ${state.listening?'on':''}" data-conversation="voice" aria-pressed="${state.listening}" aria-label="${state.listening?'Stop listening':'Speak your search'}" ${state.busy?'disabled':''}>${state.listening?'■':'🎙'}</button>`:'';
    const empty=!state.messages.length;
    return `<section id="discover-conversation" class="dc-shell"><div class="dc-intro"><div><span class="dc-kicker">Discover / search</span><h1>Tell me what you’re looking for.</h1><p>Describe a piece, add a screenshot, or use both. We’ll narrow it down together.</p></div></div>${renderChats()}${renderChatLimit()}<div class="dc-panel"><div class="dc-thread" aria-live="polite">${empty?`<div class="dc-welcome"><span class="dc-spark" aria-hidden="true">✳</span><h2>What caught your eye?</h2><p>A photo, a specific piece, even half a thought. Start anywhere.</p></div><div class="dc-examples">${examples.map((x,i)=>`<button type="button" data-conversation="example" data-index="${i}">${escape(x)} <span aria-hidden="true">↗</span></button>`).join('')}</div>`:state.messages.map(renderMessage).join('')}${renderChoices()}${renderResults()}${renderLoading()}</div><form id="dc-compose" class="dc-composer"><input id="dc-image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="dc-attachment">${state.pending?`<div class="dc-pending"><img src="${escape(state.pending)}" alt="Screenshot ready to send"><span>Screenshot attached</span><button type="button" data-conversation="remove-image" aria-label="Remove screenshot">×</button></div>`:''}</div><div class="dc-compose-row"><button type="button" class="dc-attach" data-conversation="attach" aria-label="Attach a screenshot" title="Attach screenshot">＋</button><label class="dc-text-wrap"><span class="sr-only">Describe what you are looking for</span><textarea id="dc-text" rows="2" maxlength="500" placeholder="${state.listening?'Listening… speak now':'Describe it, ask a question, or add a screenshot…'}" ${state.busy?'disabled':''}>${escape(state.draft)}</textarea></label>${voice}</div><div class="dc-compose-bar">${renderModelMenu()}${renderWallet()}<button type="submit" class="dc-send" ${state.busy||(state.wallet&&state.wallet.remaining<currentModel().credits)?'disabled':''}>Search <span aria-hidden="true">→</span></button></div><p class="dc-compose-help">${escape(currentModel().note)} · JPG, PNG or WebP · Your image is sent for analysis only when you press search.</p></form></div><div class="dc-below"><span>01 / Search by conversation</span><span>Keep exploring the mall and community below ↓</span></div></section>`;
  }
  function paint(focus=false){const target=root();if(!target)return;target.outerHTML=content();const thread=document.querySelector?.('.dc-thread');if(thread&&state.stage!=='results')thread.scrollTop=thread.scrollHeight;if(focus)document.getElementById('dc-text')?.focus();}

  // ---- images ---------------------------------------------------------------------------------
  async function toImage(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP screenshot.');if(file.size>10*1024*1024)throw new Error('Choose an image under 10 MB.');const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);let quality=.86,data=canvas.toDataURL('image/jpeg',quality);while(data.length>3_700_000&&quality>.45){quality-=.12;data=canvas.toDataURL('image/jpeg',quality);}if(data.length>4_100_000)throw new Error('This image is still too large. Try a tighter crop.');return data;}finally{bitmap.close();}}
  async function cropImage(src,crop){const bitmap=await createImageBitmap(await (await fetch(src)).blob());try{const x=Math.max(0,Math.round(bitmap.width*crop.left/100)),y=Math.max(0,Math.round(bitmap.height*crop.top/100));const w=Math.max(1,Math.min(bitmap.width-x,Math.round(bitmap.width*crop.width/100))),h=Math.max(1,Math.min(bitmap.height-y,Math.round(bitmap.height*crop.height/100)));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,w,h);return canvas.toDataURL('image/jpeg',.84);}finally{bitmap.close();}}

  // ---- events ---------------------------------------------------------------------------------
  document.addEventListener('click',async event=>{
    if(state.menuOpen&&!event.target.closest?.('.dc-model')){state.menuOpen=false;paint();}
    const button=event.target.closest('[data-conversation]');if(!button)return;const action=button.dataset.conversation;
    if(action==='attach')document.getElementById('dc-image-input')?.click();
    else if(action==='remove-image'){state.pending=null;paint(true);}
    else if(action==='example'){state.draft=examples[Number(button.dataset.index)]||'';paint(true);}
    else if(action==='cancel'){state.controller?.abort();stopLoading();state.stage=state.results?'results':'start';paint();}
    else if(action==='choice'){const item=state.choices[Number(button.dataset.index)];if(!item||!state.source?.image)return;state.choices=[];try{const crop=await cropImage(state.source.image,item.crop);state.source.image=crop;await ask(state.source.text||'',crop,item.label);}catch{state.messages.push({role:'assistant',text:'That crop could not be read. Please attach the image again.'});state.stage='start';paint();}}
    else if(action==='model-menu'){state.menuOpen=!state.menuOpen;paint();}
    else if(action==='pick-model'){state.model=button.dataset.id;state.menuOpen=false;try{localStorage.setItem('tbw-discover-model',state.model);}catch{}paint();}
    else if(action==='edit'){state.editing=true;paint();}
    else if(action==='edit-cancel'){state.editing=false;paint();}
    else if(action==='explore-mall'){const next=root()?.nextElementSibling;next?.scrollIntoView({behavior:'smooth',block:'start'});}
    else if(action==='show-results')showResults();
    else if(action==='voice'){state.listening?stopListening():startListening();paint();}
    else if(action==='new-chat')newChat();
    else if(action==='open-chat')openChat(button.dataset.id);
    else if(action==='delete-chat')deleteChat(button.dataset.id);
    else if(action==='limit-cancel'){state.chatLimit=null;paint();}
  });
  document.addEventListener('change',async event=>{if(event.target.id!=='dc-image-input')return;const file=event.target.files?.[0];if(!file)return;try{state.pending=await toImage(file);paint(true);}catch(error){state.messages.push({role:'assistant',text:error.message});paint();}});
  document.addEventListener('input',event=>{if(event.target.id==='dc-text')state.draft=event.target.value;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.menuOpen){state.menuOpen=false;paint();}if(event.target.id==='dc-text'&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();send();}});
  document.addEventListener('submit',event=>{if(event.target.id==='dc-compose'){event.preventDefault();send();}else if(event.target.id==='dc-refine'){event.preventDefault();refine(event.target);}});
  window.DiscoverConversation={render:()=>{loadWallet();loadChats();return content();}};
})();
