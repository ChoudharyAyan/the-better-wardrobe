// Where Gemini calls go. GEMINI_BACKEND=vertex sends them to Vertex AI (Google's "Agent Platform API"), which
// bills to the Google Cloud project, so Cloud and free-trial credits pay for it. The default, developer, is the
// Gemini API (AI Studio), which Cloud credits can't pay for. The same GEMINI_API_KEY works for both when it is
// bound to a service account with both APIs allowed. Style Me previews keep their own switch (style-preview.mjs).
export const geminiBackend=env=>env.GEMINI_BACKEND==='vertex'?'vertex':'developer';

export function geminiRequest(env,model,body){
  const vertex=geminiBackend(env)==='vertex';
  const url=(vertex?'https://aiplatform.googleapis.com/v1/publishers/google/models/':'https://generativelanguage.googleapis.com/v1beta/models/')+encodeURIComponent(model)+':generateContent';
  let payload=body;
  // Vertex is strict where the Gemini API is lenient: no "store" field, and every turn names its role.
  if(vertex){const {store,...rest}=body;payload={...rest,contents:(rest.contents||[]).map(c=>c.role?c:{role:'user',...c})};}
  return {url,init:{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)}};
}

// Gemini's counterpart to OpenRouter's reasoning effort. Gemini 3 models take a thinking level; 2.x models take a
// token budget. Unknown models get nothing, and callers retry without it if a model rejects the field.
export function thinkingConfig(model,effort){
  const m=String(model||'');if(!effort)return null;
  if(/^gemini-3/.test(m))return {thinkingLevel:effort==='minimal'?'minimal':effort==='medium'?'medium':effort==='high'?'high':'low'};
  if(/^gemini-2\.5-flash/.test(m))return {thinkingBudget:effort==='minimal'?0:effort==='medium'?2048:512};
  return null;
}
