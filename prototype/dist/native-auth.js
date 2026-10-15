// Google sign-in inside The Wardrobe OS phone app. Google refuses sign-in inside an app's WebView,
// so the app opens it in a Chrome Custom Tab and the server hands back a one-time code through the
// app's own link (com.thewardrobeos.app://auth). The code only works with a verifier that never
// leaves this WebView, so another app catching the link gets nothing. On the web this file does nothing.
(()=>{
  'use strict';
  const cap=globalThis.Capacitor;
  if(!cap?.isNativePlatform?.())return;
  const {Browser,App}=cap.Plugins||{};
  if(!Browser||!App)return;
  // Store pages (Ask Bao results, the Mall, the cart) open in an in-app browser tab: closing it or pressing
  // Back returns to The Wardrobe OS (user feedback, 15 Oct 2026).
  document.addEventListener('click',event=>{
    const a=event.target.closest?.('a[href^="http"]');if(!a||event.defaultPrevented)return;
    let url;try{url=new URL(a.href);}catch{return;}
    if(url.origin===location.origin)return;
    event.preventDefault();Browser.open({url:url.href,toolbarColor:'#FBF5EC'}).catch(()=>{location.href=url.href;});
  });
  const KEY='tbw-app-verifier',LINK=/^com\.thewardrobeos\.app:\/\/auth\?(.*)$/;
  const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const store={get:()=>{try{return localStorage.getItem(KEY);}catch{return null;}},set:v=>{try{v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY);}catch{}}};
  const say=text=>{const el=document.getElementById('toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3400);};

  async function start(){
    const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));store.set(verifier);
    const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    await Browser.open({url:`${location.origin}/api/auth/google?app=${challenge}`,toolbarColor:'#FBF5EC'});
  }
  async function finish(url){
    const match=LINK.exec(String(url||''));if(!match)return;
    // No verifier: this link was already used (the launch URL survives the reload after sign-in).
    const code=new URLSearchParams(match[1]).get('code'),verifier=store.get();if(!verifier)return;store.set(null);
    Browser.close?.().catch(()=>{});
    if(!code)return say('Sign-in expired. Please try again.');
    try{
      const r=await fetch('/api/auth/app-exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,verifier})});
      if(!r.ok)throw new Error();
      const me=await r.json();location.hash=me.onboarded?'discover':'onboarding';location.reload();
    }catch{say('Sign-in did not finish. Please try again.');}
  }

  // Every "Continue with Google" link points at /api/auth/google; in the app it opens the Custom Tab instead.
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href="/api/auth/google"]');if(!link)return;
    event.preventDefault();start().catch(()=>say('Could not open Google sign-in. Please try again.'));
  },true);
  App.addListener('appUrlOpen',event=>finish(event?.url));
  App.getLaunchUrl?.().then(r=>finish(r?.url)).catch(()=>{});
})();
