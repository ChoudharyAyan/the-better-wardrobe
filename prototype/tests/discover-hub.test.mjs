import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const brandsSource = readFileSync(new URL('../dist/discover-brands.js', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('../dist/brand-icon-map.js', import.meta.url), 'utf8');
const mallSource = readFileSync(new URL('../dist/discover-mall.js', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../dist/discover-hub.js', import.meta.url), 'utf8');

function preview() {
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
    crypto: webcrypto,
    FormData: class { constructor(form) { this.data = form.data; } get(key) { return this.data[key] ?? ''; } }
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
  assert.match(p.root.outerHTML, /Find it through people/);
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

test('community preview saves questions and replies locally and escapes user text', () => {
  const p = preview();
  p.submit('question', {
    question: 'Where can I find <script>that jacket</script>?',
    detail: 'Something similar in a relaxed fit',
    city: 'Mumbai',
    link: 'https://example.com/look'
  });
  assert.equal(p.context.window.DiscoverHub.getPosts()[0].author, 'You');
  assert.match(p.root.outerHTML, /&lt;script&gt;that jacket&lt;\/script&gt;/);
  assert.ok(!p.root.outerHTML.includes('<script>that jacket</script>'));
  assert.ok(p.storage.has('tbw-discover-community-v1'));
  p.submit('reply', {answer: 'The cotton kurta section at this store looks close.', link: 'https://example.com/store'}, 'example-kurta');
  assert.match(p.root.outerHTML, /Your reputation · 5 preview points/);
  assert.equal(p.context.window.DiscoverHub.getPosts().find((post) => post.id === 'example-kurta').replies.length, 1);
});

test('unsafe community links are rejected before a question is saved', () => {
  const p = preview();
  p.submit('question', {question: 'Where can I find a jacket like this?', link: 'javascript:alert(1)'});
  assert.equal(p.context.window.DiscoverHub.getPosts().length, 2);
  assert.match(p.root.outerHTML, /Use a full http or https link/);
});

test('helpful votes toggle once per browser and cannot be applied to your own answer', () => {
  const p = preview();
  const vote = {hub: 'helpful', post: 'example-bomber', reply: 'example-bomber-reply'};
  p.click(vote);
  assert.equal(p.context.window.DiscoverHub.getPosts()[0].replies[0].helpful, 3);
  assert.deepEqual(JSON.parse(p.storage.get('tbw-discover-community-v1')).votes, ['example-bomber-reply']);
  p.click(vote);
  assert.equal(p.context.window.DiscoverHub.getPosts()[0].replies[0].helpful, 2);
  assert.deepEqual(JSON.parse(p.storage.get('tbw-discover-community-v1')).votes, []);
  p.submit('reply', {answer: 'Try this local cotton label for a similar neckline.'}, 'example-kurta');
  const ownReply = p.context.window.DiscoverHub.getPosts()[1].replies[0];
  p.click({hub: 'helpful', post: 'example-kurta', reply: ownReply.id});
  assert.equal(ownReply.helpful, 0);
});
