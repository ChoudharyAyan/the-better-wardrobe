(() => {
  // Welcome, sign-in and onboarding (design QA #15, 6 Oct 2026).
  // Step 1 (required): name, age, gender, what to explore. Step 2 (optional): fashion vibe and interests.
  // The answers personalise Discover (default department) and the mall ("For you" districts).
  const EXPLORE=[['discover','Discover','Find new clothes and looks'],['style','Style Me','Style what you own, or new pieces, with AI'],['wardrobe','Wardrobe','Keep your clothes in one place'],['custom','Something else','Tell us in your own words']];
  const GENDERS=[['male','Male'],['female','Female'],['other','Other']];
  const VIBES=[['new','New to fashion'],['curious','Getting into it'],['knows','Knows what I like'],['trend','Trend-watcher'],['freak','Fashion freak']];
  const INTERESTS=[['mens-formal','Men’s formal'],['mens-casual','Men’s casual'],['womens-ethnic','Women’s ethnic'],['womens-western','Women’s western'],['streetwear','Streetwear'],['athleisure','Athleisure'],['sneakers','Sneakers'],['accessories','Accessories & jewellery'],['luxury','Luxury'],['budget','Budget finds'],['indie','Indie labels']];
  const ROUTES={discover:'discover',style:'style',wardrobe:'wardrobe',custom:'discover'};
  const FREE_KEY='tbw-explore-free';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ui={step:null,draft:{},busy:false,error:''};
  let me={google:false,signedIn:false,previewAvailable:false,account:null,profile:null,onboarded:false};
  const freeChosen=()=>{try{return localStorage.getItem(FREE_KEY)==='1';}catch{return false;}};
  const setFree=on=>{try{on?localStorage.setItem(FREE_KEY,'1'):localStorage.removeItem(FREE_KEY);}catch{}};

  function publish(){window.TBWAccount={...me};window.dispatchEvent(new Event('account-change'));}
  async function load(){
    try{const r=await fetch('/api/me');if(r.ok)me=await r.json();}catch{}
    publish();
    const hash=location.hash.slice(1);
    if(hash==='onboarding'&&me.signedIn)open('about');
    else if(hash==='welcome'||(!me.signedIn&&!freeChosen()))open('welcome');
    else if(me.signedIn&&!me.onboarded)open('about');
  }
  function open(step){
    ui.step=step;ui.error='';
    if(step==='about')ui.draft={name:me.profile?.name||me.account?.name||'',age:me.profile?.age||'',gender:me.profile?.gender||'',explore:[...(me.profile?.explore||[])],custom:me.profile?.custom||'',vibe:me.profile?.vibe||'',interests:[...(me.profile?.interests||[])]};
    paint();
  }
  function close(next){
    ui.step=null;paint();
    if(/^#(welcome|onboarding)$/.test(location.hash))history.replaceState(null,'',location.pathname+'#'+(next||'discover'));
    if(next&&location.hash!=='#'+next)location.hash=next;else window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  // ---- screens --------------------------------------------------------------------------------
  const chip=(name,value,label,on,type='radio')=>`<button type="button" class="ob-chip ${on?'on':''}" role="${type}" aria-checked="${on}" data-ob="${name}" data-value="${esc(value)}">${esc(label)}</button>`;
  const steps=n=>`<div class="ob-steps" aria-label="Step ${n} of 2"><i class="${n>=1?'on':''}"></i><i class="${n>=2?'on':''}"></i></div>`;
  function welcome(){
    return `<div class="ob-card ob-welcome"><span class="ob-mark" aria-hidden="true">✳</span><span class="ob-kicker">The Better Wardrobe</span><h1>Your style, connected.</h1><p>Find the looks you love, style what you own, and keep your wardrobe in one place.</p>
      <div class="ob-actions">${me.google?`<a class="ob-google" href="/api/auth/google"><span class="ob-g" aria-hidden="true">G</span>Continue with Google</a>`:''}${me.previewAvailable?`<button type="button" class="ob-primary" data-ob="preview" ${ui.busy?'disabled':''}>Set up my profile <span aria-hidden="true">→</span></button><small class="ob-note">Google sign-in is coming soon. Your preview profile is kept for this browser.</small>`:''}</div>
      <button type="button" class="ob-free" data-ob="free">Explore freely</button><small class="ob-note">Without a profile: no saved chats and no personalised mall.</small>${ui.error?`<p class="ob-error" role="alert">${esc(ui.error)}</p>`:''}</div>`;
  }
  function about(){
    const d=ui.draft;
    return `<form class="ob-card" id="ob-about" novalidate>${steps(1)}<span class="ob-kicker">About you</span><h2>Let’s get to know you</h2>
      <label class="ob-field"><span>Your name</span><input name="name" maxlength="60" autocomplete="name" value="${esc(d.name)}" placeholder="What should we call you?" required></label>
      <label class="ob-field"><span>Age</span><input name="age" type="number" inputmode="numeric" min="13" max="100" value="${esc(d.age)}" placeholder="e.g. 24" required></label>
      <fieldset class="ob-field"><legend>Gender</legend><div class="ob-chips" role="radiogroup">${GENDERS.map(([v,l])=>chip('gender',v,l,d.gender===v)).join('')}</div></fieldset>
      <fieldset class="ob-field"><legend>What do you want to explore? <small>Pick one or more</small></legend><div class="ob-explore">${EXPLORE.map(([v,l,sub])=>`<button type="button" class="ob-option ${d.explore.includes(v)?'on':''}" role="checkbox" aria-checked="${d.explore.includes(v)}" data-ob="explore" data-value="${v}"><b>${l}</b><small>${sub}</small></button>`).join('')}</div>
      ${d.explore.includes('custom')?`<textarea name="custom" maxlength="200" rows="2" placeholder="e.g. Plan outfits for my sister’s wedding">${esc(d.custom)}</textarea>`:''}</fieldset>
      ${ui.error?`<p class="ob-error" role="alert">${esc(ui.error)}</p>`:''}<button type="submit" class="ob-primary">Continue <span aria-hidden="true">→</span></button></form>`;
  }
  function vibe(){
    const d=ui.draft;
    return `<div class="ob-card">${steps(2)}<span class="ob-kicker">Your vibe · optional</span><h2>How would you describe your fashion self?</h2>
      <div class="ob-scale" role="radiogroup">${VIBES.map(([v,l])=>chip('vibe',v,l,d.vibe===v)).join('')}</div>
      <h3>What are you into?</h3><div class="ob-chips">${INTERESTS.map(([v,l])=>chip('interest',v,l,d.interests.includes(v),'checkbox')).join('')}</div>
      <p class="ob-note">We use this to highlight stores for you in the mall and to tune Discover.</p>${ui.error?`<p class="ob-error" role="alert">${esc(ui.error)}</p>`:''}
      <div class="ob-row"><button type="button" class="ob-free" data-ob="back">← Back</button><button type="button" class="ob-free" data-ob="finish" data-skip="1" ${ui.busy?'disabled':''}>Skip</button><button type="button" class="ob-primary" data-ob="finish" ${ui.busy?'disabled':''}>${ui.busy?'Saving…':'Finish'}</button></div></div>`;
  }
  function paint(){
    let host=document.getElementById('tbw-onboarding');
    if(!ui.step){host?.remove();document.body.classList.remove('ob-open');return;}
    if(!host){host=document.createElement('div');host.id='tbw-onboarding';host.className='ob-overlay';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Welcome');document.body.append(host);}
    document.body.classList.add('ob-open');
    host.innerHTML=ui.step==='welcome'?welcome():ui.step==='about'?about():vibe();
    host.scrollTop=0;
  }

  // ---- actions --------------------------------------------------------------------------------
  function readAbout(){const form=document.getElementById('ob-about');if(!form)return;ui.draft.name=form.name.value.trim();ui.draft.age=form.age.value;if(form.custom)ui.draft.custom=form.custom.value.trim();}
  function validAbout(){
    const d=ui.draft,age=Number(d.age);
    if(!d.name)return 'Tell us your name.';
    if(!Number.isInteger(age)||age<13||age>100)return 'Enter an age between 13 and 100.';
    if(!d.gender)return 'Choose male, female or other.';
    if(!d.explore.length)return 'Pick at least one thing to explore.';
    if(d.explore.includes('custom')&&!d.custom)return 'Tell us what you want to do.';
    return '';
  }
  async function finish(skip){
    if(skip){ui.draft.vibe='';ui.draft.interests=[];}
    ui.busy=true;ui.error='';paint();
    try{
      const r=await fetch('/api/me/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...ui.draft,age:Number(ui.draft.age)})});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save. Please try again.');
      me={...me,profile:data.profile,onboarded:true};ui.busy=false;publish();
      close(ROUTES[data.profile.explore[0]]||'discover');
    }catch(e){ui.busy=false;ui.error=e.message;paint();}
  }
  async function preview(){
    ui.busy=true;paint();
    try{const r=await fetch('/api/auth/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error((await r.json()).error);me=await r.json();ui.busy=false;publish();open(me.onboarded?null:'about');if(me.onboarded)close();}
    catch(e){ui.busy=false;ui.error=e.message||'Could not start your profile.';paint();}
  }
  async function signOut(){try{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}me={...me,signedIn:false,account:null,profile:null,onboarded:false};setFree(false);publish();open('welcome');}

  document.addEventListener('click',event=>{
    const el=event.target.closest?.('[data-ob]');if(!el)return;const action=el.dataset.ob,value=el.dataset.value;
    if(ui.step==='about')readAbout();
    const toggle=(list,v)=>list.includes(v)?list.filter(x=>x!==v):[...list,v];
    if(action==='free'){setFree(true);close(location.hash.slice(1)&&!/^(welcome|onboarding)$/.test(location.hash.slice(1))?location.hash.slice(1):'discover');}
    else if(action==='preview')preview();
    else if(action==='gender'){ui.draft.gender=value;paint();}
    else if(action==='explore'){ui.draft.explore=toggle(ui.draft.explore,value);paint();}
    else if(action==='vibe'){ui.draft.vibe=ui.draft.vibe===value?'':value;paint();}
    else if(action==='interest'){ui.draft.interests=toggle(ui.draft.interests,value);paint();}
    else if(action==='back'){ui.step='about';ui.error='';paint();}
    else if(action==='finish')finish(Boolean(el.dataset.skip));
    else if(action==='edit')open(me.signedIn?'about':'welcome');
    else if(action==='sign-in')open('welcome');
    else if(action==='sign-out')signOut();
  });
  document.addEventListener('submit',event=>{if(event.target.id!=='ob-about')return;event.preventDefault();readAbout();ui.error=validAbout();if(ui.error){paint();return;}ui.step='vibe';paint();});
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h==='welcome'&&ui.step!=='welcome')open('welcome');else if(h==='onboarding'&&me.signedIn&&!ui.step)open('about');});

  // Profile tab card: who you are, your answers, edit and sign out.
  function profileCard(){
    const p=me.profile,label=(list,v)=>list.find(([k])=>k===v)?.[1]||'';
    if(!me.signedIn)return `<section class="ob-profile"><div><span class="ob-kicker">Your profile</span><h2>Make it yours</h2><p>Set up a profile to save your chats and get a mall picked for you.</p></div><button type="button" class="ob-primary" data-ob="sign-in">Get started <span aria-hidden="true">→</span></button></section>`;
    const tags=p?[label(GENDERS,p.gender),p.age?`${p.age} yrs`:'',...p.explore.map(x=>label(EXPLORE,x)),label(VIBES,p.vibe),...(p.interests||[]).map(x=>label(INTERESTS,x))].filter(Boolean):[];
    return `<section class="ob-profile"><div class="ob-who">${me.account?.picture?`<img src="${esc(me.account.picture)}" alt="" referrerpolicy="no-referrer">`:`<span class="ob-avatar" aria-hidden="true">${esc((p?.name||me.account?.name||'?').slice(0,1).toUpperCase())}</span>`}<div><strong>${esc(p?.name||me.account?.name||'Your profile')}</strong><small>${me.account?.kind==='google'?esc(me.account.email):'Preview profile · this browser'}</small></div></div>
      ${tags.length?`<div class="ob-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:'<p>Finish onboarding to personalise Discover and the mall.</p>'}
      <div class="ob-row"><button type="button" class="ob-free" data-ob="edit">Edit answers</button><button type="button" class="ob-free" data-ob="sign-out">Sign out</button></div></section>`;
  }
  window.Onboarding={profileCard,open,get me(){return me;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
