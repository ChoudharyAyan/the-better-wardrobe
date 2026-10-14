import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, editCanvas, freezeDesign, forkDesign, createPreviewJob, transitionPreview } from '../dist/style-me/canvas.js';
const item = (id, slot) => ({ id, slot, name: id, source: 'concept', ownership: 'unowned', assetVersion: '1' });
const draft = () => createCanvas({ id: 'session-1', brief: { mode: 'from-scratch' }, items: [item('shirt', 'top'), item('trousers', 'bottom'), item('shoes', 'shoes')] });
const freeze = s => freezeDesign(s, s.revision, { id: 'frozen-1', createdAt: '2026-10-14T06:00:00Z' });
const throwsCode = (fn, code) => assert.throws(fn, e => e.code === code);
test('stale chat edit cannot overwrite a newer direct edit', () => {
  const s = editCanvas(draft(), 0, { type: 'remove', itemId: 'shoes' });
  throwsCode(() => editCanvas(s, 0, { type: 'add', item: item('boots', 'shoes') }), 'STALE_REVISION');
});
test('pins survive edits and require explicit unpin for removal', () => {
  const s = editCanvas(draft(), 0, { type: 'pin', itemId: 'shirt' });
  throwsCode(() => editCanvas(s, 1, { type: 'remove', itemId: 'shirt' }), 'PINNED_ITEM');
});
test('undo restores outfit but advances revision to reject delayed requests', () => {
  const s = editCanvas(draft(), 0, { type: 'remove', itemId: 'shoes' });
  const restored = editCanvas(s, 1, { type: 'undo' });
  assert.equal(restored.items.length, 3); assert.equal(restored.revision, 2);
});
test('freeze is immutable, detached and edits fork a new design', () => {
  const s = draft(), frozen = freeze(s); s.items[0].name = 'changed';
  assert.equal(frozen.items[0].name, 'shirt');
  assert.throws(() => { frozen.items[0].name = 'changed'; }, TypeError);
  const copy = forkDesign(frozen, 'copy'); copy.items[0].name = 'new';
  assert.equal(frozen.items[0].name, 'shirt'); assert.equal(copy.parentDesignId, frozen.id);
});
test('owned-only cannot freeze conceptual pieces', () => {
  const s = draft(); s.brief.mode = 'owned-only'; throwsCode(() => freeze(s), 'INVALID_OUTFIT');
});
test('conflicting one-piece and separates cannot freeze', () => {
  const s = editCanvas(draft(), 0, { type: 'add', item: item('kurta-set', 'onePiece') });
  throwsCode(() => freeze(s), 'INVALID_OUTFIT');
});
test('product and conceptual selection cannot invent ownership', () => {
  throwsCode(() => createCanvas({ id: 'x', items: [{ ...item('x','top'), ownership: 'confirmed' }] }), 'INVALID_OWNERSHIP');
});
test('preview needs consent and full garment support', () => {
  const f = freeze(draft()), options = { id: 'job', now: 'now', supportedSlots: ['top','bottom','shoes'] };
  throwsCode(() => createPreviewJob(f, { id:'photo', version:'1' }, options), 'PHOTO_CONSENT');
  throwsCode(() => createPreviewJob(f, { id:'photo', version:'1', consentId:'consent' }, { ...options, supportedSlots:['top'] }), 'UNSUPPORTED_GARMENT');
});
test('preview snapshot is detached; cancelled jobs cannot complete', () => {
  const f = freeze(draft()); const j = createPreviewJob(f, {id:'photo',version:'1',consentId:'c'}, {id:'job',now:'now',supportedSlots:['top','bottom','shoes']});
  const cancelled = transitionPreview(j, 'cancelled');
  throwsCode(() => transitionPreview(cancelled, 'completed', {assetId:'result',designId:f.id,photoVersion:'1'}), 'INVALID_TRANSITION');
  assert.equal(j.status, 'queued');
});
test('completed output must match frozen design and photo', () => {
  const f = freeze(draft()); const j = transitionPreview(createPreviewJob(f, {id:'photo',version:'1',consentId:'c'}, {id:'job',now:'now',supportedSlots:['top','bottom','shoes']}), 'processing');
  throwsCode(() => transitionPreview(j,'completed',{assetId:'result',designId:'wrong',photoVersion:'1'}), 'INVALID_RESULT');
  assert.equal(transitionPreview(j,'completed',{assetId:'result',designId:f.id,photoVersion:'1'}).status,'completed');
});
