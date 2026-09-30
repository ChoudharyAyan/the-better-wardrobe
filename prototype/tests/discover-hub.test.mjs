import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const brandsSource = readFileSync(new URL('../dist/discover-brands.js', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../dist/discover-hub.js', import.meta.url), 'utf8');

function preview() {
  const listeners = {};
  const storage = new Map();
  const root = {outerHTML: ''};
  const document = {
    addEventListener(type, listener) { listeners[type] = listener; },
    querySelector(selector) { return selector === '#discover-hub' ? root : null; }
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
  vm.runInContext(hubSource, context);
  root.outerHTML = context.window.DiscoverHub.render();
  const click = (data) => listeners.click({target: {closest: () => ({dataset: data})}});
  const submit = (kind, data, id = '') => {
    let prevented = false;
    listeners.submit({
      preventDefault() { prevented = true; },
      target: {closest: () => ({dataset: {hubForm: kind, id}, data})}
    });
    assert.equal(prevented, true);
  };
  return {context, storage, root, click, submit};
}

test('all 100 researched store links appear in nine category tabs, collapsed by default', () => {
  const p = preview();
  const brands = p.context.window.DiscoverHub.getBrands();
  assert.equal(brands.length, 100);
  assert.equal(new Set(brands.map((brand) => brand.id)).size, 100);
  assert.equal(new Set(brands.map((brand) => brand.category)).size, 9);
  assert.match(p.root.outerHTML, /Explore new drops/);
  assert.match(p.root.outerHTML, /Find it through people/);
  assert.equal((p.root.outerHTML.match(/<details class="hub-brand">/g) || []).length, 6);
  p.click({hub: 'brand-category', value: 'Ethnic and craft'});
  assert.match(p.root.outerHTML, /Show all 20 stores/);
  p.click({hub: 'brands-expand'});
  assert.equal((p.root.outerHTML.match(/<details class="hub-brand">/g) || []).length, 20);
  assert.match(p.root.outerHTML, /https:\/\/suta.in\//);
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
