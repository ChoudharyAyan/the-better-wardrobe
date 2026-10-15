(() => {
  // Discover search: ask in words, a screenshot or both, and get results straight away.
  // One question costs the chosen mode's credits (120 = 15 Fast, 10 Balanced or 8 Thinking searches) and unlocks two
  // shopping searches: the first, plus one free refine. Chats are saved per guest (three in the beta).
  const state = {
    messages:[],draft:'',pending:null,busy:false,stage:'start',choices:[],source:null,followup:null,
    current:null,results:null,turn:null,controller:null,progress:'',progressPercent:0,loadingSince:0,showMallHint:false,
    model:'',wallet:null,menuOpen:false,editing:false,listening:false,
    chats:[],chatId:null,chatTitle:'',chatLimit:null,readyPill:false,audience:''
  };
  try{const a=localStorage.getItem('tbw-audience');if(['menswear','womenswear'].includes(a))state.audience=a;}catch{}
  const FALLBACK_MODELS=[{id:'fast',label:'Fast',note:'Quick answers',credits:8},{id:'balanced',label:'Balanced',note:'Best for most searches',credits:12},{id:'thinking',label:'Thinking',note:'Slower, reads more detail',credits:15}];
  // Earlier versions remembered 'gemini-3-flash' or 'gpt-5-nano'.
  const LEGACY={'gemini-3-flash':'balanced','gpt-5-nano':'fast'};
  // Loading lines speak to the person and their piece, never to which stores are searched (design QA #19):
  // the store links come at the end anyway.
  const firstName = () => String(globalThis.window?.TBWAccount?.profile?.name||'').trim().split(/\s+/)[0]||'';
  const loadingLines = () => {
    const piece=describe(state.current?.attributes),you=firstName();
    return [
      you?`On it, ${you}. Reading your vibe…`:'Reading your vibe…',
      `Searching relevant Indian shopping options${piece?` for your ${piece}`:''}…`,
      'Finding the closest match for you…',
      `Comparing cut, colour and the details that matter${you?` to you, ${you}`:''}…`,
      'Preparing your results…'
    ];
  };
  // Trending looks from real people and characters (design QA #14): three at a time, shuffled, leaning to the
  // person's own department when their profile says so. Each one searches from a researched spec on the server.
  let looks=[],shown=[];
  const account = () => globalThis.window?.TBWAccount||null;
  const signedIn = () => Boolean(account()?.signedIn);
  function shuffleLooks(){
    const want=account()?.profile?.gender==='male'?'menswear':account()?.profile?.gender==='female'?'womenswear':'';
    const pool=[...looks].sort(()=>Math.random()-.5).filter(l=>!shown.some(s=>s.id===l.id)||looks.length<=3);
    const mine=want?pool.filter(l=>l.department===want):[],rest=pool.filter(l=>!mine.includes(l));
    shown=(want?[...mine.slice(0,2),...rest.slice(0,1),...mine.slice(2),...rest.slice(1)]:pool).slice(0,window.StickerStudio?4:3);
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const known = value => /^(unknown|n\/?a|none|not visible|unclear)$/i.test(String(value??'').trim())?'':String(value??'');
  const root = () => document.getElementById('discover-conversation');
  const hasFetch = () => typeof window.fetch==='function';
  const uuid = () => globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>Math.floor(Math.random()*16).toString(16));
  try{const saved=localStorage.getItem('tbw-discover-model')||'';state.model=LEGACY[saved]||saved;}catch{}

  const models = () => state.wallet?.models?.length?state.wallet.models:FALLBACK_MODELS;
  const currentModel = () => models().find(m=>m.id===state.model)||models().find(m=>m.id===(state.wallet?.defaultModel||'balanced'))||models()[0];
  const searchesLeft = model => state.wallet?Math.floor(state.wallet.remaining/model.credits):null;
  // The subtype ("suede jacket") is what people asked for; the category ("outerwear") is the shelf it sits on.
  const describe = a => [known(a?.colour),known(a?.subtype)||[known(a?.fit),known(a?.category)].filter(Boolean).join(' ')].filter(Boolean).join(' ');
  // Who the results are for. Unknown means both; the person can say "men's" or "women's" to narrow it.
  const forWhom = a => a?.department==='menswear'?"men's":a?.department==='womenswear'?"women's":'';
  const departmentLine = a => forWhom(a)?`Showing ${forWhom(a)} styles. Say “${forWhom(a)==='men\'s'?'women\'s':'men\'s'}” if you want the other.`:'I’ll show both men’s and women’s styles. Say “men’s” or “women’s” to narrow it.';
  // Size variants of one product ("Cargos (36)", "Cargos (34)") are one match, not three.
  const variantKey = item => tidyTitle(item.title).toLowerCase().replace(/\(\s*(\d{2,3}|xs|s|m|l|xl|xxl|\d?xl)\s*\)/g,'').replace(/\bby myntra\b/g,'').replace(/[^a-z0-9]+/g,' ').trim()+'|'+String(item.merchant||'').toLowerCase();
  const distinct = list => {const seen=new Set();return list.filter(item=>{const k=variantKey(item);if(seen.has(k))return false;seen.add(k);return true;});};
  const tidyTitle = t => String(t||'').replace(/^buy\s+/i,'').replace(/\s*[-|]\s*(myntra|ajio|amazon\.in|flipkart|nykaa fashion).*$/i,'');

  // ---- server calls ---------------------------------------------------------------------------
  let walletRequested=false,chatsRequested=false;
  async function loadWallet(){if(walletRequested||!hasFetch())return;walletRequested=true;try{const r=await window.fetch('/api/discover/credits');if(r.ok){state.wallet=await r.json();paint();if(globalThis.location?.hash==='#profile')window.dispatchEvent?.(new Event('account-change'));}}catch{}}
  let looksRequested=false;
  async function loadLooks(){if(looksRequested||!hasFetch())return;looksRequested=true;try{const r=await window.fetch('/api/discover/looks');if(r.ok){looks=(await r.json()).looks||[];shuffleLooks();if(window.StickerStudio){const featured=['kiara-wedding-lehenga','virat-airport-cardigan','thomas-shelby-cap','alia-met-gala-saree'].map(id=>looks.find(look=>look.id===id)).filter(Boolean);if(featured.length===4)shown=featured;}paint();}}catch{}}
  // Saved chats are for people with a profile; guests who explore freely don't get them.
  async function loadChats(){if(chatsRequested||!hasFetch()||!signedIn())return;chatsRequested=true;try{const r=await window.fetch('/api/discover/chats');if(r.ok){state.chats=(await r.json()).chats||[];paint();}}catch{}}
  async function request(action,body,signal){
    const response=await fetch(`/api/discover/${action}`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify({...body,model:currentModel().id,...(action==='interpret'&&state.audience?{audience:state.audience}:{}),...(action==='search'&&state.turn?{turn:state.turn}:{})}),signal});
    let data;try{
      const type=response.headers?.get?.('content-type')||'';
      if(response.ok&&type.includes('application/x-ndjson')&&response.body?.getReader){
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
        const handle=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='progress'){state.progress=event.label||state.progress;state.progressPercent=Math.max(0,Math.min(100,Number(event.percent)||0));paint();}else if(event.type==='error')throw new Error(event.error||'Could not complete this search.');else if(event.type==='result')data=event.data;};
        while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)handle(line);if(done){handle(buffer);break;}}
        if(!data)throw new Error('The search stream ended before results arrived. Please retry.');
      }else data=await response.json();
    }catch(error){if(error instanceof SyntaxError)throw new Error('The search service returned an unreadable response. Please retry.');throw error;}
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
    if(!hasFetch()||!state.messages.length||!signedIn())return;
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
  let rotation=null;
  function startLoading(label){
    if(!state.busy)pickMascot();state.busy=true;state.readyPill=false;state.progress=label;state.progressPercent=0;state.loadingSince=Date.now();paint();
    if(typeof setInterval==='function')clearInterval(rotation);
  }
  function stopLoading(){state.busy=false;state.progress='';state.progressPercent=0;if(typeof clearInterval==='function')clearInterval(rotation);}
  const metaFor = data => data.credits?(data.credits.cost?`${currentModel().label} · ${data.credits.cost} credits · ${data.credits.remaining} left`:`${currentModel().label} · free, nothing to search yet`):'';

  async function ask(text,image,target='',previous=null,look=''){
    state.controller=new AbortController();startLoading(loadingLines()[0]);
    try{
      const data=await request('interpret',look?{text,look}:{text,image,target,previous},state.controller.signal);
      if(data.question||!data.attributes){stopLoading();state.stage='clarify';state.followup={text,image,previous};state.messages.push({role:'assistant',meta:metaFor(data),text:data.question||'What kind of item should I look for?'});paint();saveChat();return;}
      state.current={attributes:data.attributes,query:data.query,budget:data.budget,uncertainty:data.uncertainty,look:data.look?.id||''};state.followup=null;
      state.messages.push({role:'assistant',meta:metaFor(data),text:`${data.look?.note?data.look.note+' ':''}Looking for ${describe(data.attributes)||'that piece'}${data.budget?` under ₹${Number(data.budget).toLocaleString('en-IN')}`:''}. ${departmentLine(data.attributes)}`});
      await runSearch();
    }catch(error){stopLoading();if(error.name!=='AbortError')state.messages.push({role:'assistant',text:error.message||'I could not read that. Please try again.'});state.stage=state.results?'results':'start';paint();}
  }
  async function runSearch(){
    if(!state.current?.attributes)return;
    state.stage='loading';state.editing=false;state.controller??=new AbortController();if(!state.busy)startLoading(loadingLines()[1]);else{state.progress=loadingLines()[1];state.progressPercent=0;paint();}
    try{
      const {attributes,query,budget,look}=state.current;
      state.results=await request('search',{attributes,query,budget,market:'in',image:state.source?.image||undefined,...(look?{look}:{})},state.controller.signal);
      state.stage='results';
      const found=Math.min(distinct(state.results.results||[]).length,6);
      state.messages.push({role:'assistant',text:found?`Found ${found} ${found===1?'match':'matches'}. Tap a piece to open it at the store.`:'No exact product matched this time. The store searches below are a good next step.'});
    }catch(error){if(error.name!=='AbortError'){state.stage=state.results?'results':'start';state.messages.push({role:'assistant',text:error.status===403?'That search used its free refine. Ask a new question to search again.':error.message||'The product search did not finish. Please retry.'});}}
    finally{stopLoading();state.controller=null;paint();if(state.stage==='results'){flagReady();const thread=document.querySelector?.('.dc-pro .dc-thread'),found=thread?.querySelector('.dc-results');if(found)thread.scrollTop=Math.max(0,found.offsetTop-thread.offsetTop-12);}saveChat();}
  }
  let selectedLook=null;
  async function send(){
    if(state.busy)return;const text=state.draft.trim(),image=state.pending;if(!text&&!image){window.StickerStudio?.invalid();return;}
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
    await ask(searchText,searchImage,'',previous,selectedLook?.label===searchText?selectedLook.id:undefined);selectedLook=null;
  }
  function refine(form){
    if(state.busy||!state.current)return;const data=new FormData(form),value=k=>String(data.get(k)||'').trim();
    if(!value('category')){state.messages.push({role:'assistant',text:'Tell me what kind of item it is first.'});paint();return;}
    state.current={...state.current,look:'',attributes:{...state.current.attributes,category:value('category'),colour:value('colour'),fit:value('fit'),details:value('details'),department:['menswear','womenswear'].includes(value('department'))?value('department'):''},query:[value('colour'),value('details'),value('category')].filter(Boolean).join(' ')||state.current.query,budget:value('budget')?Number(value('budget')):null};
    state.messages.push({role:'user',text:`Update: ${describe(state.current.attributes)}${state.current.budget?` under ₹${state.current.budget.toLocaleString('en-IN')}`:''}`});
    runSearch();
  }

  // ---- results-ready pop-up ------------------------------------------------------------------
  // Shown when results land while the person is elsewhere (the mall, another tab, another app).
  // It stays until they see the results or close it.
  const onDiscover = () => !globalThis.location||(window.StickerStudio?globalThis.location.hash==='#discover/ask':/^#?(discover)?$/.test(globalThis.location.hash||''));
  function resultsInView(){
    const r=document.querySelector?.('.dc-results')?.getBoundingClientRect?.(),h=globalThis.innerHeight||0;
    return Boolean(r&&onDiscover()&&r.top<h*.7&&r.bottom>h*.2);
  }
  let watching=false,baseTitle='';
  function flagReady(){
    if(!document.hidden&&resultsInView())return;
    state.readyPill=true;renderPill();
    try{navigator.vibrate?.([40,60,40]);}catch{}
    if(document.hidden){baseTitle||=document.title;document.title='✨ Results ready · '+baseTitle;}
    if(!watching&&typeof addEventListener==='function'){watching=true;const check=()=>{if(state.readyPill&&!document.hidden&&resultsInView())dismissReady();};addEventListener('scroll',check,{passive:true});addEventListener('hashchange',()=>setTimeout(()=>{renderPill();check();},60));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&baseTitle){document.title=baseTitle;baseTitle='';}check();});}
  }
  const readyText = () => {const n=Math.min(distinct(state.results?.results||[]).length,6),what=describe(state.current?.attributes);return n?`${n} ${n===1?'match':'matches'}${what?` for ${what}`:''}`:`Store searches${what?` for ${what}`:''} are ready`;};
  function dismissReady(){state.readyPill=false;renderPill();}
  function renderPill(){
    if(!document.body||typeof document.createElement!=='function')return;
    let pill=document.getElementById('dc-ready-pill');
    const searching=state.busy&&!onDiscover();
    if(!state.readyPill&&!searching){pill?.remove();return;}
    if(!pill){pill=document.createElement('div');pill.id='dc-ready-pill';pill.className='dc-ready-pill';pill.setAttribute('role','alert');document.body.append(pill);}
    if(searching){pill.setAttribute('role','status');pill.innerHTML=`<div class="dc-ready-top"><span class="dc-ready-kicker">Search continues</span></div><div class="dc-ready-body"><div><strong>${escape(state.source?.text||'Finding pieces from your screenshot')}</strong><small>${escape(state.progress||'Finding shopping options…')}${state.progressPercent?` · ${state.progressPercent}%`:''}</small></div></div><button type="button" class="dc-ready-go" data-conversation="show-results">Back to my search <span aria-hidden="true">→</span></button>`;return;}
    pill.setAttribute('role','alert');
    const thumbs=distinct(state.results?.results||[]).filter(x=>x.image).slice(0,3);
    pill.innerHTML=`<div class="dc-ready-top"><span class="dc-ready-kicker">✨ Search complete</span><button type="button" class="dc-ready-close" data-conversation="dismiss-ready" aria-label="Dismiss">×</button></div><div class="dc-ready-body">${thumbs.length?`<span class="dc-ready-stack" aria-hidden="true">${thumbs.map(x=>`<img src="${escape(x.image)}" alt="">`).join('')}</span>`:'<span class="dc-ready-spark" aria-hidden="true">✨</span>'}<div><strong>${firstName()?`${escape(firstName())}, your picks are ready`:'Your picks are ready'}</strong><small>${escape(readyText())}</small></div></div><button type="button" class="dc-ready-go" data-conversation="show-results">See results <span aria-hidden="true">→</span></button>`;
  }
  function showResults(){dismissReady();const go=()=>(document.querySelector(state.busy?'.dc-loading':'.dc-results')||root())?.scrollIntoView({behavior:'smooth',block:'start'});if(!onDiscover()){location.hash=window.StickerStudio?'discover/ask':'discover';setTimeout(go,350);}else go();}

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
  const renderMessage = message => `<article class="dc-message ${message.role==='user'?'dc-user':'dc-assistant'}"><span class="dc-speaker">${message.role==='user'?'You':window.StickerStudio?'Bao':'The Wardrobe OS'}</span><div class="dc-bubble">${message.image?`<img src="${escape(message.image)}" alt="Uploaded fashion reference" class="dc-message-image">`:''}${message.text?`<p>${escape(message.text)}</p>`:''}${message.meta?`<small class="dc-meta">${escape(message.meta)}</small>`:''}</div></article>`;
  const renderChoices = () => state.stage!=='choose'?'':`<div class="dc-choice-panel"><p>Which piece should I look for?</p><div class="dc-choice-list">${state.choices.map((item,index)=>`<button type="button" data-conversation="choice" data-index="${index}">${escape(item.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div></div>`;
  // Loading mascot (owner, 6 Oct 2026): a different friendly face each search: panda, pug, cat or fox.
  // Inline SVG, no image requests; it bobs and blinks, and stays still for reduced motion.
  const eyes=(lx,rx,y,r=4.2)=>`<g class="dc-eyes"><circle cx="${lx}" cy="${y}" r="${r}" fill="#281b22"/><circle cx="${rx}" cy="${y}" r="${r}" fill="#281b22"/><circle cx="${lx+1.4}" cy="${y-1.6}" r="1.3" fill="#fff"/><circle cx="${rx+1.4}" cy="${y-1.6}" r="1.3" fill="#fff"/></g>`;
  const cheeks=(lx,rx,y)=>`<ellipse cx="${lx}" cy="${y}" rx="5" ry="3" fill="#f3a9bf" opacity=".7"/><ellipse cx="${rx}" cy="${y}" rx="5" ry="3" fill="#f3a9bf" opacity=".7"/>`;
  const MASCOTS={
    panda:{name:'Bao the panda',svg:`<circle cx="24" cy="22" r="11" fill="#281b22"/><circle cx="76" cy="22" r="11" fill="#281b22"/><circle cx="50" cy="54" r="36" fill="#fff" stroke="#281b22" stroke-width="2.5"/><ellipse cx="36" cy="50" rx="9" ry="11" fill="#281b22" transform="rotate(-20 36 50)"/><ellipse cx="64" cy="50" rx="9" ry="11" fill="#281b22" transform="rotate(20 64 50)"/>${eyes(37,63,50,3.6).replace(/#281b22/g,'#fff').replace(/r="1.3" fill="#fff"/g,'r="1.3" fill="#281b22"')}<ellipse cx="50" cy="64" rx="5" ry="3.6" fill="#281b22"/><path d="M45 70q5 5 10 0" fill="none" stroke="#281b22" stroke-width="2.2" stroke-linecap="round"/>${cheeks(28,72,66)}`},
    pug:{name:'Momo the pug',svg:`<path d="M18 30q-6 22 8 26l6-24z" fill="#5a3b2e"/><path d="M82 30q6 22-8 26l-6-24z" fill="#5a3b2e"/><circle cx="50" cy="54" r="35" fill="#e7c49a" stroke="#5a3b2e" stroke-width="2.5"/><ellipse cx="50" cy="66" rx="20" ry="15" fill="#4a3128"/><path d="M38 34q12-6 24 0" fill="none" stroke="#b98a5e" stroke-width="2.4" stroke-linecap="round"/>${eyes(36,64,49,5)}<ellipse cx="50" cy="61" rx="6" ry="4" fill="#1d1210"/><path d="M44 70q6 5 12 0" fill="none" stroke="#e7c49a" stroke-width="2.2" stroke-linecap="round"/>${cheeks(25,75,62)}`},
    cat:{name:'Miso the cat',svg:`<path d="M20 40 24 10l22 18z" fill="#f2b880" stroke="#8a5a3c" stroke-width="2.5" stroke-linejoin="round"/><path d="M80 40 76 10 54 28z" fill="#f2b880" stroke="#8a5a3c" stroke-width="2.5" stroke-linejoin="round"/><path d="M27 18l4 12 8-6z" fill="#f7c9d4"/><path d="M73 18l-4 12-8-6z" fill="#f7c9d4"/><circle cx="50" cy="55" r="34" fill="#f2b880" stroke="#8a5a3c" stroke-width="2.5"/><path d="M42 26l4 10M50 24v11M58 26l-4 10" stroke="#d98c52" stroke-width="2.4" stroke-linecap="round"/>${eyes(37,63,52,4.6)}<path d="M47 63h6l-3 3.5z" fill="#e0708f"/><path d="M50 66.5q-4 5-8 2M50 66.5q4 5 8 2" fill="none" stroke="#8a5a3c" stroke-width="2" stroke-linecap="round"/><path d="M20 60h12M21 66l11-2M80 60H68M79 66l-11-2" stroke="#8a5a3c" stroke-width="1.6" stroke-linecap="round"/>${cheeks(29,71,64)}`},
    fox:{name:'Kitsu the fox',svg:`<path d="M18 44 20 10l26 22z" fill="#e8743b" stroke="#8a3d1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M82 44 80 10 54 32z" fill="#e8743b" stroke="#8a3d1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 90 16 50q2-24 34-24t34 24z" fill="#e8743b" stroke="#8a3d1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 90 26 60q12 4 24 0 12 4 24 0z" fill="#fff4ea"/>${eyes(37,63,52,4.4)}<ellipse cx="50" cy="76" rx="5" ry="3.6" fill="#281b22"/>${cheeks(30,70,64)}`}
  };
  let mascot=Object.keys(MASCOTS)[Math.floor(Math.random()*4)];
  const pickMascot = () => {const keys=Object.keys(MASCOTS).filter(k=>k!==mascot);mascot=keys[Math.floor(Math.random()*keys.length)];};
  const renderMascot = () => window.StickerStudio?`<span class="dc-pro-loader" aria-hidden="true">${window.StickerStudio.friend?.('bao',40,'span')||''}</span>`:`<figure class="dc-mascot" aria-label="${escape(MASCOTS[mascot].name)} is searching with you"><svg viewBox="0 0 100 100" aria-hidden="true">${MASCOTS[mascot].svg}</svg><span class="dc-mascot-shadow" aria-hidden="true"></span><figcaption>${escape(MASCOTS[mascot].name)} is on it</figcaption></figure>`;
  // The same friend greets people on an empty Discover (design QA #20: a mascot instead of the star). Tap for another.
  const renderHello = () => {if(window.StickerStudio)return window.StickerStudio.guide('Words, a screenshot, or both. Your call.',84);const m=MASCOTS[mascot];return `<button type="button" class="dc-hello" data-conversation="mascot" aria-label="${escape(m.name)} says hi. Tap to meet another friend."><span class="dc-hello-bubble">Hi, I’m ${escape(m.name.split(' ')[0])} 👋</span><svg viewBox="0 0 100 100" aria-hidden="true">${m.svg}</svg><span class="dc-mascot-shadow" aria-hidden="true"></span></button>`;};
  window.TBWMascot={svg:()=>`<svg viewBox="0 0 100 100" aria-hidden="true">${MASCOTS[mascot].svg}</svg>`,name:()=>MASCOTS[mascot].name};
  const renderLoading = () => !state.busy?'':`<div class="dc-loading" role="status" aria-live="polite">${renderMascot()}<p id="dc-loading-line">${escape(state.progress||loadingLines()[0])}</p><div class="dc-search-progress" role="progressbar" aria-label="Search progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.progressPercent}"><span style="width:${state.progressPercent}%"></span></div>${state.progressPercent?`<small class="dc-search-progress-label">${state.progressPercent}%</small>`:''}<div class="dc-mall-hint"><span>Explore The Mall while I search for you. We’ll let you know when your results are ready.</span><button type="button" data-conversation="explore-mall">Explore The Mall →</button></div><button type="button" class="dc-cancel" data-conversation="cancel">Cancel</button></div>`;
  const field = (label,name,value,placeholder='') => `<label><span>${label}</span><input name="${name}" value="${escape(known(value))}" placeholder="${escape(placeholder)}"></label>`;
  const renderUnderstood = () => {
    const c=state.current;if(!c?.attributes)return '';const a=c.attributes;
    const chips=[known(a.category),known(a.colour),known(a.fit),known(a.pattern),known(a.details),forWhom(a)||'men’s & women’s',c.budget?`under ₹${Number(c.budget).toLocaleString('en-IN')}`:''].filter(Boolean);
    if(!state.editing)return `<div class="dc-understood"><span class="dc-kicker">Searched for</span><div class="dc-chips">${chips.map(x=>`<span>${escape(x)}</span>`).join('')}</div><button type="button" class="dc-edit" data-conversation="edit" ${state.busy?'disabled':''}>Edit ✎</button></div>`;
    return `<form id="dc-refine" class="dc-refine"><div class="dc-review-grid">${field('Item','category',a.category,'e.g. blazer')}${field('Colour','colour',a.colour,'Any colour')}${field('Fit','fit',a.fit,'Any fit')}${field('Detail','details',a.details,'Collar, fabric, print…')}${field('Budget in ₹','budget',c.budget??'','Optional')}<label><span>For</span><select name="department">${[['','Men’s and women’s'],['menswear','Men’s'],['womenswear','Women’s']].map(([v,l])=>`<option value="${v}" ${(a.department||'')===v?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="dc-review-actions"><button type="submit" class="dc-main-button">Update results <span aria-hidden="true">→</span></button><button type="button" class="dc-edit" data-conversation="edit-cancel">Cancel</button><span>Updating is free for this search.</span></div></form>`;
  };
  // Back from a store must land here again (user feedback, 15 Oct). In the Android app, native-auth.js opens
  // store pages in an in-app browser tab with its own close button. On the web a new tab breaks Back (iOS
  // Safari), so links open in this tab and the conversation is kept in sessionStorage to restore on return.
  const native = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());
  const linkTarget = () => native()||!window.StickerStudio?'target="_blank"':'';
  const RESTORE='tbw-ask-restore';
  function keepForBack(){try{sessionStorage.setItem(RESTORE,JSON.stringify({at:Date.now(),messages:state.messages.slice(-12).map(m=>({...m,image:undefined})),current:state.current,results:state.results,stage:state.stage,chatId:state.chatId,chatTitle:state.chatTitle,turn:state.turn}));}catch{}}
  function restoreAfterBack(){
    if(state.messages.length)return;let saved;try{saved=JSON.parse(sessionStorage.getItem(RESTORE)||'null');sessionStorage.removeItem(RESTORE);}catch{return;}
    if(!saved||Date.now()-saved.at>6*3600000||!Array.isArray(saved.messages))return;
    Object.assign(state,{messages:saved.messages,current:saved.current,results:saved.results,stage:saved.results?'results':'start',chatId:saved.chatId,chatTitle:saved.chatTitle||'',turn:saved.turn||null});
  }
  if(typeof document.addEventListener==='function')document.addEventListener('click',e=>{if(e.target.closest?.('[data-leaves]'))keepForBack();},true);
  const renderResults = () => {
    if(!state.results||!['results','loading'].includes(state.stage))return '';
    const {storeSearches=[]}=state.results,results=distinct(state.results.results||[]);
    const matches=results.length?`<div class="dc-result-grid">${results.slice(0,6).map(item=>`<div class="dc-result-wrap"><a class="dc-result" href="${escape(item.url)}" ${linkTarget()} rel="noopener noreferrer" data-leaves><div class="dc-result-image">${item.image?`<img src="${escape(item.image)}" alt="${escape(tidyTitle(item.title))}" loading="lazy">`:'<span>View at store</span>'}</div><div class="dc-result-copy"><small>${escape(item.merchant||'Store')}${item.market==='global'?' · Global':''}</small><strong>${escape(tidyTitle(item.title))}</strong><span>${escape(item.priceText||'See price at store')} ↗</span></div></a>${window.TBWCart?.button({url:item.url,title:tidyTitle(item.title),image:item.image,priceText:item.priceText,store:item.merchant,source:'ask'})||''}</div>`).join('')}</div>`:`<p class="dc-empty">No exact product matched this time. Try the stores below, or edit the details above.</p>`;
    const stores=storeSearches.length?`<div class="dc-stores"><span class="dc-kicker">Search it on</span><div class="dc-store-row">${storeSearches.map(s=>`<a href="${escape(s.url)}" ${linkTarget()} rel="noopener noreferrer" data-leaves>${escape(s.store)} ↗</a>`).join('')}</div></div>`:'';
    return `<section class="dc-results" aria-label="Shopping results">${renderUnderstood()}<div class="dc-results-head"><span class="dc-kicker">Matches</span><h3>${results.length?'Pieces that match':'Keep looking'}</h3></div>${matches}${stores}<p class="dc-result-note">Suggestions, not verified exact matches. Confirm size, delivery and availability with the store.</p></section>`;
  };
  // Saved chats as tabs that stay pinned above the conversation, so earlier searches are one tap away.
  const ago = iso => {const m=Math.round((Date.now()-Date.parse(iso))/60000);return !Number.isFinite(m)?'':m<1?'just now':m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`;};
  const renderChats = () => {
    if(!signedIn())return `<nav class="dc-chats" aria-label="Your chats"><span class="dc-chats-label">Your chats</span><div class="dc-chat-row"><span class="dc-chat-empty">Set up a profile to save and revisit chats</span><button type="button" class="dc-chat new" data-ob="sign-in"><b>Get started →</b></button></div></nav>`;
    const list=state.chats,unsaved=state.messages.length&&!list.some(c=>c.id===state.chatId);
    const tab=(label,sub,active,attrs)=>`<${attrs?'button type="button"':'span'} class="dc-chat ${active?'active':''}" ${attrs||''} ${active?'aria-current="true"':''}><b>${escape(label.slice(0,26))}</b><small>${escape(sub)}</small></${attrs?'button':'span'}>`;
    const tabs=[unsaved?tab(state.chatTitle||state.messages.find(m=>m.role==='user'&&m.text)?.text||'Screenshot search','Now',true,''):'',...list.map(c=>tab(c.title,c.id===state.chatId?'Open now':ago(c.updatedAt),c.id===state.chatId,`data-conversation="open-chat" data-id="${escape(c.id)}"`))].join('');
    return `<nav class="dc-chats" aria-label="Your chats"><span class="dc-chats-label">Your chats <em>${list.length}/3</em></span><div class="dc-chat-row">${tabs||'<span class="dc-chat-empty">Your searches are saved here</span>'}<button type="button" class="dc-chat new" data-conversation="new-chat" ${state.busy?'disabled':''}><b>＋ New chat</b></button></div></nav>`;
  };
  const renderLooks = () => {
    const idea=account()?.profile?.custom;
    if(!shown.length&&!idea)return '';
    return `<div class="dc-looks"><div class="dc-looks-head"><span class="dc-kicker">Trending looks</span>${looks.length>3?`<button type="button" class="dc-shuffle" data-conversation="shuffle">Shuffle ↻</button>`:''}</div><div class="dc-examples">${idea?`<button type="button" class="dc-idea" data-conversation="idea"><small>Your idea</small>${escape(idea)} <span aria-hidden="true">↗</span></button>`:''}${shown.map((x,i)=>`${window.StickerStudio?'<article class="ss-look-card">':''}<button type="button" data-conversation="look" data-index="${i}"><small>${escape(x.who)}</small>${window.StickerStudio?.lookArt(x)||''}<strong>${escape(x.label)}</strong> <span aria-hidden="true">↗</span></button>${window.StickerStudio?`${window.StickerStudio.lookSource?.(x)||''}</article>`:''}`).join('')}</div></div>`;
  };
  const renderChatLimit = () => !state.chatLimit?'':`<div class="dc-chat-limit" role="dialog" aria-label="Chat limit"><strong>You can keep 3 chats in the beta.</strong><p>${state.chatLimit.retrySave?'Delete one to save this chat.':'Delete one to start a new chat.'}</p><ul>${state.chatLimit.chats.map(c=>`<li><span>${escape(c.title)}</span><button type="button" data-conversation="delete-chat" data-id="${escape(c.id)}">Delete</button></li>`).join('')}</ul><button type="button" class="dc-edit" data-conversation="limit-cancel">Keep all</button></div>`;
  const renderModelMenu = () => {
    const m=currentModel();
    if(window.StickerStudio)return window.StickerStudio.modelModes(models(),m,state.busy);
    return `<div class="dc-model"><button type="button" class="dc-model-chip" data-conversation="model-menu" aria-haspopup="listbox" aria-expanded="${state.menuOpen}" ${state.busy?'disabled':''}>${escape(m.label)} · ${m.credits} credits <span aria-hidden="true">▾</span></button>${state.menuOpen?`<ul class="dc-model-menu" role="listbox" aria-label="Search model">${models().map(x=>`<li role="option" aria-selected="${x.id===m.id}"><button type="button" data-conversation="pick-model" data-id="${escape(x.id)}"><span><b>${escape(x.label)}</b><small>${escape(x.note)}${state.wallet?` · ${searchesLeft(x)} left`:''}</small></span><em>${x.credits} credits</em>${x.id===m.id?'<i aria-hidden="true">✓</i>':''}</button></li>`).join('')}</ul>`:''}</div>`;
  };
  const renderWallet = () => {if(!state.wallet)return '';const m=currentModel(),left=searchesLeft(m);return `<span class="dc-wallet ${state.wallet.remaining<m.credits?'empty':''}"><b>${state.wallet.remaining}</b> credits · ${left} ${left===1?'search':'searches'} left${state.wallet.promoCredits?` · ${state.wallet.promoCredits} XP`:''}</span>`;};
  function content(){
    if(window.StickerStudio?.friend)return proContent();
    const voice=voiceReady()?`<button type="button" class="dc-mic ${state.listening?'on':''}" data-conversation="voice" aria-pressed="${state.listening}" aria-label="${state.listening?'Stop listening':'Speak your search'}" ${state.busy?'disabled':''}>${window.StickerStudio?.icon(state.listening?'stop':'mic')||(state.listening?'■':'Mic')}</button>`:'';
    const empty=!state.messages.length;
    return `<section id="discover-conversation" class="dc-shell"><div class="dc-intro"><div><span class="dc-kicker">Discover / search</span><h1>${window.StickerStudio?'Ask Bao':'Describe a garment you want to find.'}</h1>${window.StickerStudio?'':'<p>Add details, a screenshot, or both.</p>'}</div></div>${window.StickerStudio?'':renderChats()}${renderChatLimit()}<div class="dc-panel"><div class="dc-thread" aria-live="polite">${empty?`<div class="dc-welcome">${renderHello()}<h2>What caught your eye?</h2><p>Choose an example or describe a garment in your own words.</p></div>${renderLooks()}`:state.messages.map(renderMessage).join('')}${renderChoices()}${renderResults()}${renderLoading()}${state.busy&&window.StickerStudio?window.StickerStudio.skeletons():''}</div><form id="dc-compose" class="dc-composer">${window.StickerStudio?window.StickerStudio.promptChips():''}<input id="dc-image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="dc-attachment">${state.pending?`<div class="dc-pending"><img src="${escape(state.pending)}" alt="Screenshot ready to send"><span>Screenshot attached</span><button type="button" data-conversation="remove-image" aria-label="Remove screenshot">×</button></div>`:''}</div>${window.StickerStudio?'<div id="ss-prompt-photo" class="ss-prompt-photo" aria-live="polite"></div>':''}<div class="dc-compose-row"><button type="button" class="dc-attach" data-conversation="attach" aria-label="Attach a screenshot" title="Attach screenshot">＋</button><label class="dc-text-wrap"><span class="sr-only">Describe the garment you want to find</span><textarea id="dc-text" rows="2" maxlength="500" placeholder="${state.listening?'Listening… speak now':'Describe a garment, ask a question, or add a screenshot…'}" ${state.busy?'disabled':''}>${escape(state.draft)}</textarea></label>${voice}</div><div class="dc-compose-bar">${renderModelMenu()}${renderWallet()}<button type="submit" class="dc-send" ${state.busy||(state.wallet&&state.wallet.remaining<currentModel().credits)?'disabled':''}>Search <span aria-hidden="true">→</span></button></div><p class="dc-compose-help">${escape(currentModel().note)} · Your image is sent only when you search.</p></form></div><div class="dc-below"><span>01 / Search by conversation</span><span>Keep exploring the mall and community below ↓</span></div></section>`;
  }
  // ---- Ask Bao, professional layout (owner's review, 15 Oct 2026) ------------------------------------
  // One bounded panel that fills the screen, so the page itself never scrolls: a slim header with the
  // mode picker, the conversation (the only part that scrolls), and a composer modelled on Gemini's that
  // grows with the sentence. When the keyboard opens, the panel shrinks to the space above it (fitAsk).
  const MONTH_CUES=[ // India's calendar: a season-aware nudge, so the first suggestion is something people need now.
    ['Winter layers that still look sharp','A wool overshirt under ₹3,000'],['Wedding season is on','A pastel lehenga for a day wedding'],['Holi and spring brunches','White kurta set under ₹2,500'],
    ['Summer is here','Breathable linen shirt under ₹2,000'],['Summer is here','Cotton co-ord set for hot days'],['Monsoon is close','Quick-dry sneakers under ₹3,000'],
    ['Monsoon is here','A rain-proof jacket that still looks good'],['Monsoon is here','Dark-wash denim that hides splashes'],['Festive season starts soon','A silk kurta for Ganesh Chaturthi'],
    ['Festive season is here','A festive kurta for Diwali under ₹3,000'],['Wedding season is coming','A bandhgala for a winter wedding'],['Party season is here','A black blazer for year-end parties']];
  const CUES=[
    {kind:'compliment',text:'You’re looking good today.'},
    {kind:'compliment',text:'Good taste is half the outfit. You’ve got that part covered.'},
    {kind:'compliment',text:'Your style, your rules. I’m just here to find the pieces.'},
    {kind:'quote',text:'Fashion fades, only style remains the same.',by:'Coco Chanel'},
    {kind:'quote',text:'Style is a way to say who you are without having to speak.',by:'Rachel Zoe'},
    {kind:'quote',text:'Elegance is elimination.',by:'Cristóbal Balenciaga'},
    {kind:'quote',text:'Buy less, choose well, make it last.',by:'Vivienne Westwood'},
    {kind:'tip',text:'Tip: say your budget, like “under ₹2,000”, and I’ll stay within it.'},
    {kind:'tip',text:'Tip: a screenshot works best when the piece fills most of the frame.'},
    {kind:'tip',text:'Tip: Thinking mode reads small details like collars, prints and buttons.'}
  ];
  let cue=CUES[Math.floor(Math.random()*CUES.length)];
  const greeting = () => {const h=new Date().getHours(),you=firstName();const part=h<5?'Up late':h<12?'Good morning':h<17?'Good afternoon':'Good evening';return you?`${part}, ${you}`:part;};
  const CUE_ICON={compliment:'✦',quote:'❝',tip:'💡'};
  const renderCue = () => `<p class="dc-pro-cue dc-pro-cue-${cue.kind}"><span aria-hidden="true">${CUE_ICON[cue.kind]}</span><span>${escape(cue.text)}${cue.by?` <em>${escape(cue.by)}</em>`:''}</span></p>`;
  const suggestion = (icon,text,attrs) => `<button type="button" class="dc-pro-suggest" ${attrs}><span class="dc-pro-suggest-icon" aria-hidden="true">${window.StickerStudio.icon(icon)}</span><span>${escape(text)}</span></button>`;
  const renderSuggestions = () => {
    const [season,idea]=MONTH_CUES[new Date().getMonth()];
    return `<div class="dc-pro-suggestions"><small class="dc-pro-label">${escape(season)}</small>${suggestion('sparkle',idea,`data-conversation="prompt" data-value="${escape(idea)}"`)}${suggestion('image','Find a look from a screenshot','data-conversation="attach"')}${suggestion('mall','Walk the Mall’s 9 districts','data-conversation="explore-mall"')}</div>`;
  };
  const renderTrending = () => !shown.length?'':`<div class="dc-pro-trending"><div class="dc-pro-row"><small class="dc-pro-label">Trending looks</small>${looks.length>3?'<button type="button" class="dc-pro-link" data-conversation="shuffle">Shuffle</button>':''}</div><div class="dc-pro-looks">${shown.map((x,i)=>`<button type="button" class="dc-pro-look" data-conversation="look" data-index="${i}">${window.StickerStudio.lookArt(x)}<span><small>${escape(x.who)}</small><strong>${escape(x.label)}</strong></span></button>`).join('')}</div></div>`;
  const renderModes = () => {
    const m=currentModel();
    const menu=state.menuOpen?`<ul class="dc-pro-menu" role="listbox" aria-label="Search mode">${models().map(x=>{const left=searchesLeft(x);return `<li role="option" aria-selected="${x.id===m.id}"><button type="button" data-conversation="pick-model" data-id="${escape(x.id)}"><b>${escape(x.label)}</b><small>${escape(x.note)} · ${x.credits} credits${left!=null?` · ${left} left`:''}</small>${x.id===m.id?'<i aria-hidden="true">✓</i>':''}</button></li>`;}).join('')}</ul>`:'';
    return `<div class="dc-model dc-pro-modes"><button type="button" class="dc-pro-mode" data-conversation="model-menu" aria-haspopup="listbox" aria-expanded="${state.menuOpen}" ${state.busy?'disabled':''}>${escape(m.label)} <span aria-hidden="true">▾</span></button>${menu}</div>`;
  };
  // Who the results are for (user feedback, 15 Oct: signed-out people were shown men's pieces). All lets
  // the words decide; Women or Men overrides the model's guess unless the words name someone else.
  const AUDIENCES=[['','All'],['womenswear','Women'],['menswear','Men']];
  const renderAudience = () => `<div class="dc-pro-audience" role="radiogroup" aria-label="Show styles for">${AUDIENCES.map(([v,l])=>`<button type="button" role="radio" aria-checked="${state.audience===v}" data-conversation="audience" data-value="${v}" ${state.busy?'disabled':''}>${l}</button>`).join('')}</div>`;
  // The search mode, always visible right above the composer (owner: the header pill was easy to miss).
  const renderModeBar = () => {const m=currentModel();return `<div class="dc-pro-modebar" role="radiogroup" aria-label="Search mode">${models().map(x=>`<button type="button" role="radio" aria-checked="${x.id===m.id}" data-conversation="pick-model" data-id="${escape(x.id)}" ${state.busy?'disabled':''} title="${escape(x.note)}"><b>${escape(x.label)}</b><small>${x.credits} credits</small></button>`).join('')}</div>`;};
  function proContent(){
    const S=window.StickerStudio,m=currentModel(),empty=!state.messages.length,left=searchesLeft(m);
    const cantPay=state.wallet&&state.wallet.remaining<m.credits;
    const voice=voiceReady()?`<button type="button" class="dc-pro-icon-btn ${state.listening?'on':''}" data-conversation="voice" aria-pressed="${state.listening}" aria-label="${state.listening?'Stop listening':'Speak your search'}" ${state.busy?'disabled':''}>${S.icon(state.listening?'stop':'mic')}</button>`:'';
    const welcome=`<div class="dc-pro-welcome"><span class="dc-pro-face">${S.friend('bao',52,'span')}</span><h2>${escape(greeting())}</h2>${renderCue()}</div>${renderSuggestions()}${renderTrending()}`;
    return `<section id="discover-conversation" class="dc-shell dc-pro"><header class="dc-pro-head"><span class="dc-pro-title">${S.friend('bao',30,'span')}<span><strong>Ask Bao</strong><small>Your fashion search assistant</small></span></span>${renderAudience()}<button type="button" class="dc-pro-icon-btn" data-conversation="new-chat" aria-label="New chat" title="New chat" ${state.busy?'disabled':''}>${S.icon('edit')}</button></header>${renderChatLimit()}<div class="dc-pro-panel"><div class="dc-thread" aria-live="polite">${empty?welcome:state.messages.map(renderMessage).join('')}${renderChoices()}${renderResults()}${renderLoading()}</div>${renderModeBar()}<form id="dc-compose" class="dc-pro-composer"><input id="dc-image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>${state.pending?`<div class="dc-pending"><img src="${escape(state.pending)}" alt="Screenshot ready to send"><span>Screenshot attached</span><button type="button" data-conversation="remove-image" aria-label="Remove screenshot">×</button></div>`:''}<div id="ss-prompt-photo" class="ss-prompt-photo" aria-live="polite"></div><label class="dc-pro-field"><span class="sr-only">Describe the garment you want to find</span><textarea id="dc-text" rows="1" maxlength="500" enterkeyhint="send" placeholder="${state.listening?'Listening… speak now':'Ask Bao for any piece'}" ${state.busy?'disabled':''}>${escape(state.draft)}</textarea></label><div class="dc-pro-tools"><button type="button" class="dc-pro-icon-btn" data-conversation="attach" aria-label="Attach a screenshot" title="Attach a screenshot">${S.icon('plus')}</button><small class="dc-pro-cost">${left!=null?`${left} ${left===1?'search':'searches'} left · ${state.wallet.remaining} credits`:''}</small>${voice}<button type="submit" class="dc-pro-send dc-send" aria-label="Search" ${state.busy||cantPay?'disabled':''}>${S.icon('arrow-up')}</button></div></form></div></section>`;
  }
  // Fits the panel to the visible screen: below the app bar, above the bottom tabs, or above the keyboard
  // when it is open (the tabs hide while typing, as in most chat apps).
  let tallest=0;
  function fitAsk(){
    const shell=document.querySelector?.('.dc-pro');const html=document.documentElement;
    if(!shell){html?.classList?.remove('dc-ask-open','dc-keyboard');return;}
    const vv=globalThis.visualViewport,view=vv?vv.height:globalThis.innerHeight;tallest=Math.max(tallest,globalThis.innerHeight||0,view);
    const typing=document.activeElement?.id==='dc-text'&&view<tallest*0.82;
    html.classList.add('dc-ask-open');html.classList.toggle('dc-keyboard',typing);
    if(typing&&globalThis.scrollY)globalThis.scrollTo(0,0);
    const top=shell.getBoundingClientRect().top-(vv?vv.offsetTop:0);
    const nav=typing?null:document.querySelector('.bottom-nav');const navH=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;
    shell.style.height=Math.max(300,Math.floor(view-top-navH-(typing?8:14)))+'px';
    const thread=shell.querySelector('.dc-thread');if(thread&&state.stage!=='results'&&state.messages.length)thread.scrollTop=thread.scrollHeight;
  }
  function growBox(box){if(!box?.style)return;box.style.height='auto';box.style.height=Math.min(box.scrollHeight,168)+'px';}
  if(typeof window.addEventListener==='function'){
    const refit=()=>requestAnimationFrame?.(fitAsk);
    globalThis.visualViewport?.addEventListener('resize',refit);globalThis.visualViewport?.addEventListener('scroll',refit);
    window.addEventListener('resize',refit);window.addEventListener('hashchange',()=>setTimeout(fitAsk,60));
    document.addEventListener?.('focusin',e=>{if(e.target?.id==='dc-text')setTimeout(fitAsk,250);});
    document.addEventListener?.('focusout',e=>{if(e.target?.id==='dc-text')setTimeout(fitAsk,250);});
  }

  function paint(focus=false){renderPill();if(window.StickerStudio)window.dispatchEvent(new Event("sticker-data"));const target=root();if(!target)return;target.outerHTML=content();const thread=document.querySelector?.('.dc-thread');if(thread&&state.stage!=='results'&&state.messages.length)thread.scrollTop=thread.scrollHeight;if(focus)document.getElementById('dc-text')?.focus();if(target&&window.StickerStudio?.friend){growBox(document.getElementById('dc-text'));fitAsk();}}

  // ---- images ---------------------------------------------------------------------------------
  async function toImage(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP screenshot.');if(file.size>10*1024*1024)throw new Error('Choose an image under 10 MB.');const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);let quality=.86,data=canvas.toDataURL('image/jpeg',quality);while(data.length>3_700_000&&quality>.45){quality-=.12;data=canvas.toDataURL('image/jpeg',quality);}if(data.length>4_100_000)throw new Error('This image is still too large. Try a tighter crop.');return data;}finally{bitmap.close();}}
  // Small pieces (sunglasses, a watch) get a margin so the crop still shows what they are.
  const pad = c => {const w=Math.min(100,Math.max(c.width*1.3,22)),h=Math.min(100,Math.max(c.height*1.3,22));return {left:Math.max(0,Math.min(100-w,c.left-(w-c.width)/2)),top:Math.max(0,Math.min(100-h,c.top-(h-c.height)/2)),width:w,height:h};};
  async function cropImage(src,crop){const bitmap=await createImageBitmap(await (await fetch(src)).blob());try{const x=Math.max(0,Math.round(bitmap.width*crop.left/100)),y=Math.max(0,Math.round(bitmap.height*crop.top/100));const w=Math.max(1,Math.min(bitmap.width-x,Math.round(bitmap.width*crop.width/100))),h=Math.max(1,Math.min(bitmap.height-y,Math.round(bitmap.height*crop.height/100)));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,w,h);return canvas.toDataURL('image/jpeg',.84);}finally{bitmap.close();}}

  // ---- events ---------------------------------------------------------------------------------
  document.addEventListener('click',async event=>{
    if(state.menuOpen&&!event.target.closest?.('.dc-model')){state.menuOpen=false;paint();}
    const button=event.target.closest('[data-conversation]');if(!button)return;const action=button.dataset.conversation;
    if(action==='attach')document.getElementById('dc-image-input')?.click();
    else if(action==='remove-image'){state.pending=null;paint(true);}
    else if(action==='prompt'){if(state.busy)return;selectedLook=null;state.draft=button.dataset.value;send();}
    else if(action==='look'){const look=shown[Number(button.dataset.index)];if(!look||state.busy)return;state.messages.push({role:'user',text:look.label});state.source={text:look.label,image:null};state.stage='working';state.choices=[];state.followup=null;ask(look.label,null,'',null,look.id);}
    else if(action==='shuffle'){shuffleLooks();paint();}
    else if(action==='mascot'){pickMascot();paint();}
    else if(action==='idea'){state.draft=account()?.profile?.custom||'';paint(true);}
    else if(action==='cancel'){state.controller?.abort();stopLoading();state.stage=state.results?'results':'start';paint();}
    else if(action==='choice'){const item=state.choices[Number(button.dataset.index)];if(!item||!state.source?.image)return;state.choices=[];try{const full=state.source.image,crop=await cropImage(full,pad(item.crop));state.source.image=crop;await ask(state.source.text||'',full,item.label);}catch{state.messages.push({role:'assistant',text:'That crop could not be read. Please attach the image again.'});state.stage='start';paint();}}
    else if(action==='model-menu'){state.menuOpen=!state.menuOpen;paint();}
    else if(action==='audience'){state.audience=button.dataset.value||'';try{localStorage.setItem('tbw-audience',state.audience);}catch{}paint();}
    else if(action==='pick-model'){state.model=button.dataset.id;state.menuOpen=false;try{localStorage.setItem('tbw-discover-model',state.model);}catch{}paint();}
    else if(action==='edit'){state.editing=true;paint();}
    else if(action==='edit-cancel'){state.editing=false;paint();}
    else if(action==='explore-mall'){if(window.StickerStudio)location.hash='discover/mall';else{const next=root()?.nextElementSibling;next?.scrollIntoView({behavior:'smooth',block:'start'});}}
    else if(action==='show-results')showResults();
    else if(action==='dismiss-ready')dismissReady();
    else if(action==='voice'){state.listening?stopListening():startListening();paint();}
    else if(action==='new-chat'){if(window.StickerStudio&&!root()){location.hash='discover/ask';setTimeout(newChat,0);}else newChat();}
    else if(action==='open-chat'){if(window.StickerStudio&&!root())location.hash='discover/ask';openChat(button.dataset.id);}
    else if(action==='delete-chat')deleteChat(button.dataset.id);
    else if(action==='limit-cancel'){state.chatLimit=null;paint();}
  });
  document.addEventListener('change',async event=>{if(event.target.id!=='dc-image-input')return;const file=event.target.files?.[0];if(!file)return;try{state.pending=await toImage(file);paint(true);}catch(error){state.messages.push({role:'assistant',text:error.message});paint();}});
  document.addEventListener('input',event=>{if(event.target.id==='dc-text'){state.draft=event.target.value;growBox(event.target);}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.menuOpen){state.menuOpen=false;paint();}if(event.target.id==='dc-text'&&event.key==='Enter'&&(event.ctrlKey||event.metaKey||(window.StickerStudio?.friend&&!event.shiftKey))){event.preventDefault();send();}});
  document.addEventListener('submit',event=>{if(event.target.id==='dc-compose'){event.preventDefault();send();}else if(event.target.id==='dc-refine'){event.preventDefault();refine(event.target);}});
  // Signing in or out changes whose chats these are.
  if(typeof window.addEventListener==='function')window.addEventListener('hashchange',renderPill);
  if(typeof window.addEventListener==='function')window.addEventListener('account-change',()=>{chatsRequested=false;if(!signedIn()){state.chats=[];}else loadChats();shuffleLooks();});
  const creditsCard = () => {loadWallet();if(!state.wallet)return '';const max=models().find(m=>m.id==='thinking')||models().at(-1),lite=models().find(m=>m.id==='fast');return `<section class="dc-credits-card"><span class="dc-kicker">Discover credits</span><strong>${state.wallet.remaining} credits left</strong><small>${searchesLeft(max)} ${max.label} searches${lite?` or ${searchesLeft(lite)} ${lite.label}`:''} · free questions don’t count</small></section>`;};
  // search(text): My Wardrobe's gaps and "complete this look" open Discover with a search already asked.
  window.DiscoverConversation={homeChats:()=>{loadWallet();loadChats();return renderChats();},balance:()=>{loadWallet();return state.wallet?.remaining??null;},render:()=>{if(!root()){cue=CUES[Math.floor(Math.random()*CUES.length)];restoreAfterBack();}loadWallet();loadChats();loadLooks();return content();},fit:fitAsk,creditsCard,search:text=>{if(state.busy||!text)return;state.draft=String(text).slice(0,200);send();}};
})();
