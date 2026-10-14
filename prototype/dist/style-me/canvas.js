import {itemConstraintIssues} from './constraints.js';
/** Headless Canvas state. Persistence and authorization belong to the host adapter. */
const clone = value => structuredClone(value);
export class CanvasError extends Error {
  constructor(code, message) { super(message); this.name = 'CanvasError'; this.code = code; }
}
const fail = (code, message) => { throw new CanvasError(code, message); };
const slots = new Set(['top', 'bottom', 'onePiece', 'shoes', 'outerwear', 'accessory']);
const sources = new Set(['wardrobe', 'described', 'concept', 'product']);
const ownership = new Set(['confirmed', 'user-described', 'unowned']);
const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
function validItem(item) {
  if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9:._-]{1,100}$/.test(item.id) || ['__proto__','constructor','prototype'].includes(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 150)
    fail('INVALID_ITEM', 'Each garment needs an ID and name.');
  if (!slots.has(item.slot) || !sources.has(item.source) || !ownership.has(item.ownership))
    fail('INVALID_ITEM', 'Garment slot, source and ownership must be explicit.');
  if (item.layer != null && (!Number.isInteger(item.layer) || item.layer < 0 || item.layer > 4))
    fail('INVALID_LAYER', 'Choose a clothing layer from zero to four.');
  if (item.source === 'concept' && item.ownership !== 'unowned')
    fail('INVALID_OWNERSHIP', 'Representative concepts cannot be marked owned.');
  if (item.source === 'wardrobe' && (item.ownership !== 'confirmed' || !item.itemRevision))
    fail('INVALID_OWNERSHIP', 'Wardrobe garments require confirmed ownership and a record revision.');
  if (item.source === 'product' && item.ownership !== 'unowned')
    fail('INVALID_OWNERSHIP', 'Product selection cannot confirm ownership.');
  if (item.source === 'described' && item.ownership !== 'user-described')
    fail('INVALID_OWNERSHIP', 'Described owned garments must retain their provenance.');
}
export function createCanvas({ id, brief = {}, items = [] }) {
  if (typeof id !== 'string' || !id) fail('INVALID_ID', 'Canvas ID is required.');
  items.forEach(validItem);
  if (new Set(items.map(i => i.id)).size !== items.length) fail('DUPLICATE_ITEM', 'Garments must have unique IDs.');
  return { schemaVersion: 1, id, revision: 0, brief: clone(brief), items: clone(items), pinned: [], layout: {}, history: [] };
}
/** Every caller, including chat, must supply the revision it edited. */
export function editCanvas(state, expectedRevision, action) {
  if (state.revision !== expectedRevision) fail('STALE_REVISION', 'The outfit changed. Reload before applying this edit.');
  const next = clone(state);
  const previous = clone({ brief: state.brief, items: state.items, pinned: state.pinned, layout: state.layout });
  const index = next.items.findIndex(i => i.id === action.itemId);
  switch (action.type) {
    case 'add': {
      validItem(action.item);
      if (next.items.some(i => i.id === action.item.id)) fail('DUPLICATE_ITEM', 'That garment is already selected.');
      next.items.push(clone(action.item)); break;
    }
    case 'replace': {
      if (index < 0) fail('MISSING_ITEM', 'The selected garment no longer exists.');
      if (next.pinned.includes(action.itemId)) fail('PINNED_ITEM', 'Unpin the garment before replacing it.');
      validItem(action.item);
      if (action.item.slot !== next.items[index].slot) fail('SLOT_MISMATCH', 'Replacement must use the same garment slot.');
      if (next.items.some((i, n) => n !== index && i.id === action.item.id)) fail('DUPLICATE_ITEM', 'That garment is already selected.');
      next.items[index] = clone(action.item); delete next.layout[action.itemId]; break;
    }
    case 'remove': {
      if (index < 0) fail('MISSING_ITEM', 'The selected garment no longer exists.');
      if (next.pinned.includes(action.itemId)) fail('PINNED_ITEM', 'Unpin the garment before removing it.');
      next.items.splice(index, 1); delete next.layout[action.itemId]; break;
    }
    case 'pin':
    case 'unpin': {
      if (index < 0) fail('MISSING_ITEM', 'Select the garment before changing its pin.');
      next.pinned = next.pinned.filter(id => id !== action.itemId);
      if (action.type === 'pin') next.pinned.push(action.itemId);
      break;
    }
    case 'move': {
      if (index < 0) fail('MISSING_ITEM', 'Select the garment before moving it.');
      if (next.pinned.includes(action.itemId)) fail('PINNED_ITEM', 'Unpin the garment before moving it.');
      if (![action.x, action.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1))
        fail('INVALID_POSITION', 'Board positions must be normalized between zero and one.');
      const old=next.layout[action.itemId]||{};
      const scale=action.scale??old.scale??1,rotation=action.rotation??old.rotation??0,depth=action.depth??old.depth??index;
      if(!Number.isFinite(scale)||scale<0.4||scale>2.5||!Number.isFinite(rotation)||rotation < -180||rotation > 180||!Number.isInteger(depth)||depth<0||depth>30)
        fail('INVALID_POSITION','Choose a supported size, rotation and stacking order.');
      next.layout[action.itemId] = {x:action.x,y:action.y,scale,rotation,depth}; break;
    }
    case 'describe': {
      if(index<0)fail('MISSING_ITEM','Select the garment before correcting it.');
      if(next.pinned.includes(action.itemId))fail('PINNED_ITEM','Unpin the garment before correcting it.');
      const candidate={...next.items[index],...action.patch};
      candidate.id=next.items[index].id;
      if(action.patch?.ownership==='user-described'){candidate.source='described';candidate.ownership='user-described';}
      validItem(candidate);next.items[index]=candidate;break;
    }
    case 'layer': {
      if (index < 0) fail('MISSING_ITEM', 'Select the garment before changing its layer.');
      if (next.pinned.includes(action.itemId)) fail('PINNED_ITEM', 'Unpin the garment before changing its styling.');
      if (!Number.isInteger(action.layer) || action.layer < 0 || action.layer > 4) fail('INVALID_LAYER', 'Choose a layer from zero to four.');
      next.items[index].layer = action.layer; break;
    }
    case 'brief': {
      if (!action.patch || typeof action.patch !== 'object' || Array.isArray(action.patch)) fail('INVALID_BRIEF', 'Brief patch must be an object.');
      next.brief = { ...next.brief, ...clone(action.patch) }; break;
    }
    case 'undo': {
      const old = next.history.pop();
      if (!old) fail('NOTHING_TO_UNDO', 'There is no previous edit.');
      Object.assign(next, old); next.revision++; return next;
    }
    default: fail('INVALID_ACTION', 'Unknown Canvas action.');
  }
  next.history.push(previous);
  next.history = next.history.slice(-100);
  next.revision++;
  return next;
}
export function validateCanvas(state) {
  const issues = [];
  const count = slot => state.items.filter(i => i.slot === slot).length;
  if (!(count('onePiece') === 1 || (count('top') >= 1 && count('bottom') === 1)))
    issues.push({ code: 'INCOMPLETE', message: 'Choose a top and bottom, or one one-piece outfit.' });
  if (count('onePiece') && (count('top') || count('bottom')))
    issues.push({ code: 'CONFLICTING_LAYERS', message: 'Resolve one-piece and separates before freezing.' });
  if (['bottom', 'onePiece', 'shoes'].some(slot => count(slot) > 1) || ['top','outerwear'].some(slot => { const pieces=state.items.filter(i=>i.slot===slot); return pieces.length>1 && (pieces.some(i=>!Number.isInteger(i.layer)) || new Set(pieces.map(i=>i.layer)).size!==pieces.length); }))
    issues.push({ code: 'CONFLICTING_LAYERS', message: 'Multiple pieces in a slot need supported explicit layering.' });
  if (!count('shoes')) issues.push({ code: 'MISSING_SHOES', message: 'Select footwear before freezing.' });
  if (state.brief.mode === 'owned-only' && state.items.some(i => i.ownership === 'unowned'))
    issues.push({ code: 'OWNED_ONLY', message: 'Replace unowned pieces or explicitly change the styling mode.' });
  if (state.items.some(i => i.available === false))
    issues.push({ code: 'UNAVAILABLE', message: 'Replace unavailable garments before freezing.' });
  issues.push(...state.items.flatMap(i=>itemConstraintIssues(state.brief,i)));
  return issues;
}
export function freezeDesign(state, expectedRevision, { id, createdAt, validate = () => [] }) {
  if (state.revision !== expectedRevision) fail('STALE_REVISION', 'The outfit changed before freezing.');
  if (!id || !createdAt) fail('INVALID_FREEZE', 'Snapshot ID and timestamp are required.');
  const issues = [...validateCanvas(state), ...validate(clone(state))];
  if (issues.length) fail('INVALID_OUTFIT', issues.map(i => i.message).join(' '));
  return deepFreeze(clone({ schemaVersion: 1, id, canvasId: state.id, outfitRevision: state.revision,
    createdAt, brief: state.brief, items: state.items, pinned: state.pinned, layout: state.layout }));
}
export function forkDesign(frozen, id) {
  const draft = createCanvas({ id, brief: frozen.brief, items: frozen.items });
  draft.pinned = clone(frozen.pinned); draft.layout = clone(frozen.layout); draft.parentDesignId = frozen.id;
  return draft;
}
export function createPreviewJob(frozen, photo, { id, supportedSlots, now }) {
  if (!id || !now || !Array.isArray(supportedSlots)) fail('INVALID_JOB', 'Job ID, timestamp and supported garment slots are required.');
  if (!photo?.id || !photo.version || !photo.consentId) fail('PHOTO_CONSENT', 'A versioned reference photo and consent record are required.');
  if (frozen.items.some(i => !supportedSlots.includes(i.slot))) fail('UNSUPPORTED_GARMENT', 'This provider cannot preview every selected garment.');
  return { schemaVersion: 1, id, designId: frozen.id, outfitRevision: frozen.outfitRevision,
    photoId: photo.id, photoVersion: photo.version, consentId: photo.consentId,
    snapshot: clone(frozen), status: 'queued', createdAt: now, result: null };
}
const transitions = { queued: ['processing', 'cancelled', 'failed'], processing: ['completed', 'failed', 'cancelled'] };
export function transitionPreview(job, status, result = null) {
  if (!transitions[job.status]?.includes(status)) fail('INVALID_TRANSITION', 'This preview job cannot enter that state.');
  if (status === 'completed' && (!result?.assetId || result.designId !== job.designId || result.photoVersion !== job.photoVersion))
    fail('INVALID_RESULT', 'Preview result must match the frozen design and photo version.');
  return { ...clone(job), status, result: status === 'completed' ? clone(result) : null };
}
