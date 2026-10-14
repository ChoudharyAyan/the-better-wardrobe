/** Shared deterministic checks: generated prose never overrides the editable brief. */
const lower = value => String(value || '').toLowerCase();
const vocabulary = {
  heels: /\b(heel(?:s|ed)?|stilettos?|pumps?|wedges?)\b/,
  leather: /\b(leather|suede)\b/,
  wool: /\b(wool|cashmere)\b/,
  sleeveless: /\b(sleeveless|tank|camisole|cami)\b/,
  shorts: /\b(shorts?|bermudas?)\b/,
  jackets: /\b(jackets?|blazers?|coats?)\b/,
  sandals: /\b(sandals?|slides?|flip[- ]flops?)\b/
};
export function exclusionTerms(value) {
  return lower(value).split(/[,;\n]|\s+and\s+|\s+or\s+/).map(s => s.trim().replace(/^(?:no|avoid|without|exclude)\s+/, '')).filter(Boolean);
}
export function itemConstraintIssues(brief, item) {
  const issues = [], description = lower([item.name, item.colour, item.material, item.coverage, ...(Array.isArray(item.tags)?item.tags:[])].join(' '));
  for (const term of exclusionTerms(brief.exclusions)) {
    const canonical = Object.keys(vocabulary).find(k => k === term || k.replace(/s$/, '') === term);
    const match = canonical ? vocabulary[canonical].test(description) : description.includes(term);
    // Explicit faux/vegan leather is still excluded by a literal no-leather request.
    if (match) issues.push({code:'EXCLUDED', message:`${item.name} conflicts with “avoid ${term}”. Replace it or amend the brief.`});
  }
  if (/covered arms|long sleeves|full sleeves/.test(lower(brief.coverage)) && item.slot === 'top' && /short[- ]sleeve|sleeveless|tank|cami/.test(description))
    issues.push({code:'COVERAGE', message:`${item.name} does not meet the requested arm coverage.`});
  if (/covered legs|full length|no bare legs/.test(lower(brief.coverage)) && ['bottom','onePiece'].includes(item.slot) && /shorts?|mini|above[- ]knee/.test(description))
    issues.push({code:'COVERAGE', message:`${item.name} does not meet the requested leg coverage.`});
  if (item.available === false) issues.push({code:'UNAVAILABLE', message:`${item.name} is unavailable. Replace it before freezing.`});
  return issues;
}

/** Small, explicit refinements work even when the text provider is unavailable. */
export function refineBrief(previous, request) {
  const next = {...previous, request}, s = lower(request);
  const budget = s.match(/(?:under|below|budget(?: of)?|up to)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/);
  if (budget) next.budget = Number(budget[1].replaceAll(',', ''));
  const excluded = [...String(previous.exclusions || '').split(/[,;\n]/).filter(Boolean)];
  for (const match of s.matchAll(/\b(?:no|avoid|without)\s+(heels?|leather|suede|wool|sandals?|jackets?|shorts?|sleeveless)\b/g)) excluded.push(match[1]);
  next.exclusions = [...new Set(excluded.map(x=>x.trim()))].join(', ');
  if (/less formal|more casual/.test(s)) next.aesthetic = 'More casual';
  if (/only (?:what i own|owned|my clothes)|owned only|no shopping/.test(s)) next.mode = 'owned-only';
  else if (/from scratch|no wardrobe/.test(s)) next.mode = 'from-scratch';
  else if (/mix (?:owned|my)|owned \+ new/.test(s)) next.mode = 'mixed';
  return next;
}
export function refinementSlot(request) {
  const match = lower(request).match(/(?:change|swap|replace|help|better)\s+(?:only\s+)?(?:the\s+)?(shoes?|footwear|tops?|shirts?|bottoms?|trousers?|outerwear|jacket|accessor(?:y|ies))/);
  if (!match) return null;
  return /shoe|footwear/.test(match[1]) ? 'shoes' : /top|shirt/.test(match[1]) ? 'top' : /bottom|trouser/.test(match[1]) ? 'bottom' : /outerwear|jacket/.test(match[1]) ? 'outerwear' : 'accessory';
}
