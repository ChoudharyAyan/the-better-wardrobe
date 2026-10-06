import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const brandsSource = readFileSync(new URL('../dist/discover-brands.js', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('../dist/brand-icon-map.js', import.meta.url), 'utf8');
const mallSource = readFileSync(new URL('../dist/discover-mall.js', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../dist/discover-hub.js', import.meta.url), 'utf8');

function preview({feed} = {}) {
  const listeners = {};
  const storage = new Map();
  const root = {outerHTML: ''};
  const mallRoot = {outerHTML: ''};
  const document = {
    addEventListener(type, listener) { (listeners[type] ??= []).push(listener); },
    querySelector(selector) { return selector === '#discover-hub' ? root : selector === '#discover-mall' ? mallRoot : null; }
  };
  const context = vm.createContext({
    window: {},
    document,
    localStorage: {getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
    URL,
    fetch: feed ? async () => ({ok: true, json: async () => feed}) : undefined,
    crypto: webcrypto,
    FormData: class { constructor(form) { this.data = form.data; } get(key) { return this.data[key] ?? ''; } },
    queueMicrotask: () => {}
  });
  vm.runInContext(brandsSource, context);
  vm.runInContext(iconSource, context);
  vm.runInContext(mallSource, context);
  vm.runInContext(hubSource, context);
  mallRoot.outerHTML = context.window.DiscoverMall.render();
  root.outerHTML = context.window.DiscoverHub.render();
  const click = (data) => {
    const button = {dataset: data};
    for (const listener of listeners.click) listener({target: {closest: (selector) => selector === '[data-mall]' && data.mall || selector === '[data-hub]' && data.hub ? button : null}});
  };
  const submit = (kind, data, id = '') => {
    let prevented = false;
    for (const listener of listeners.submit) listener({
      preventDefault() { prevented = true; },
      target: {closest: () => ({dataset: {hubForm: kind, id}, data})}
    });
    assert.equal(prevented, true);
  };
  return {context, storage, root, mallRoot, click, submit};
}

test('the mall exposes all 100 sources through nine districts and a direct-link directory', () => {
  const p = preview();
  const brands = p.context.window.DiscoverHub.getBrands();
  assert.equal(brands.length, 100);
  assert.equal(new Set(brands.map((brand) => brand.id)).size, 100);
  assert.equal(new Set(brands.map((brand) => brand.category)).size, 9);
  assert.match(p.root.outerHTML, /Explore the mall/);
  assert.match(p.root.outerHTML, /Find it, together/);
  assert.equal((p.mallRoot.outerHTML.match(/data-mall="category"/g) || []).length, 9);
  assert.equal((p.mallRoot.outerHTML.match(/target="_blank"/g) || []).length, 100);
  assert.ok(Object.keys(p.context.window.BrandIconMap).length >= 90);
});

test('bundled store icons resolve locally and missing logos use a readable fallback', () => {
  const p = preview();
  const icons = p.context.window.BrandIconMap;
  const manifest = JSON.parse(readFileSync(new URL('../dist/assets/brand-icons/sources.json', import.meta.url), 'utf8'));
  assert.equal(manifest.length, 100);
  assert.equal(Object.keys(icons).length, 94);
  for (const file of Object.values(icons)) assert.ok(existsSync(new URL(`../dist/${file}`, import.meta.url)), file);
  assert.ok(!icons[17]);
  assert.match(p.mallRoot.outerHTML, /mall-logo-text[^>]*>O<\/span>/);
});

test('avatar path enters a district, selects a branded shop, and tracks local exploration', () => {
  const p = preview();
  p.click({mall: 'category', value: 'Ethnic and craft'});
  assert.equal(p.context.window.DiscoverMall.getState().category, 'Ethnic and craft');
  assert.equal(p.context.window.DiscoverMall.getState().stage, 'lanes');
  assert.match(p.mallRoot.outerHTML, /20 stores/);
  assert.match(p.mallRoot.outerHTML, /Kurtas &amp; sets/);
  p.click({mall: 'lane', value: 'Sarees'});
  assert.equal(p.context.window.DiscoverMall.getState().stage, 'stores');
  assert.equal(p.context.window.DiscoverMall.getState().lane, 'Sarees');
  assert.match(p.mallRoot.outerHTML, /aria-pressed="true"><span>Sarees/);
  p.click({mall: 'lane', value: 'All stores'});
  assert.equal((p.mallRoot.outerHTML.match(/data-mall="store"/g) || []).length, 6);
  p.click({mall: 'store', id: '71'});
  assert.match(p.mallRoot.outerHTML, /Visit Suta/);
  assert.match(p.mallRoot.outerHTML, /https:\/\/suta.in\//);
  assert.deepEqual(JSON.parse(p.storage.get('tbw-discover-mall-v1')).stores, [71]);
  p.click({mall: 'next'});
  assert.equal(p.context.window.DiscoverMall.getState().page, 1);
  p.click({mall: 'back'});
  assert.equal(p.context.window.DiscoverMall.getState().stage, 'lanes');
  p.click({mall: 'back'});
  assert.equal(p.context.window.DiscoverMall.getState().stage, 'map');
});

test('mall shows sourced designs and offers without claiming baseline products are new', async () => {
  const p = preview({feed: {generatedAt: '2026-10-05T00:00:00Z', brands: {'71': {
    status: 'ok', checkedAt: '2026-10-05T00:00:00Z',
    designs: [{id: 'suta-1', title: 'Handwoven cotton saree', url: 'https://suta.in/products/cotton-saree', image: 'https://suta.in/images/saree.jpg', price: 1499, isNew: false}],
    offers: [{id: 'suta-offer', title: 'Cotton saree offer', url: 'https://suta.in/products/cotton-saree', image: 'https://suta.in/images/saree.jpg', price: 1199, originalPrice: 1499, discountPercent: 20}]
  }}}});
  await p.context.window.DiscoverMall.loadUpdates();
  p.click({mall: 'category', value: 'Ethnic and craft'});
  p.click({mall: 'lane', value: 'All stores'});
  assert.match(p.mallRoot.outerHTML, /mall-store-art/);
  p.click({mall: 'store', id: '71'});
  assert.match(p.mallRoot.outerHTML, /Latest designs/);
  assert.doesNotMatch(p.mallRoot.outerHTML, /New designs/);
  assert.match(p.mallRoot.outerHTML, /Handwoven cotton saree/);
  assert.match(p.mallRoot.outerHTML, /At the store/);
  p.click({mall: 'feed-tab', value: 'offers'});
  assert.match(p.mallRoot.outerHTML, /Cotton saree offer/);
  assert.match(p.mallRoot.outerHTML, /20% off/);
  assert.match(p.mallRoot.outerHTML, /₹1,199/);
});

test('mall keeps unchecked stores honest instead of inventing product cards', async () => {
  const p = preview({feed: {generatedAt: null, brands: {'71': {status: 'not_checked', checkedAt: null, designs: [], offers: []}}}});
  await p.context.window.DiscoverMall.loadUpdates();
  p.click({mall: 'category', value: 'Ethnic and craft'});
  p.click({mall: 'lane', value: 'All stores'});
  p.click({mall: 'store', id: '71'});
  assert.match(p.mallRoot.outerHTML, /This store has not been checked yet/);
  assert.doesNotMatch(p.mallRoot.outerHTML, /mall-find-card/);
  assert.match(p.mallRoot.outerHTML, /Visit Suta/);
});

test('community introduces shared questions, wallet and two feed views', () => {
  const p = preview();
  assert.match(p.root.outerHTML, /Spotter wallet/);
  assert.match(p.root.outerHTML, /Community/);
  assert.match(p.root.outerHTML, /My questions/);
  assert.match(p.root.outerHTML, /Ask a question/);
  assert.ok(!p.storage.has('tbw-discover-community-v1'));
});
