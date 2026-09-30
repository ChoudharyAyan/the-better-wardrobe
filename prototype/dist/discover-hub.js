/* Discover extensions: a researched store directory and a local community preview. */
(() => {
  const brands = Array.isArray(window.DiscoverBrands) ? window.DiscoverBrands : [];
  const categories = [...new Set(brands.map((brand) => brand.category))];
  const storageKey = 'tbw-discover-community-v1';
  const examplePosts = [
    {
      id: 'example-bomber', author: 'Maya', city: 'Bengaluru', question: 'Where can I find a cropped bomber like this in India?',
      detail: 'Looking for a relaxed fit and a dark brown colour. An in-store sighting would help too.',
      link: '', example: true,
      replies: [{id: 'example-bomber-reply', author: 'Rhea', text: 'Try the relaxed outerwear at Bonkers Corner. Check the current sizes before ordering.', link: 'https://www.bonkerscorner.com/', helpful: 2}]
    },
    {
      id: 'example-kurta', author: 'Arjun', city: 'Jaipur', question: 'Know a brand making simple cotton kurtas with this neckline?',
      detail: 'No heavy embroidery. I am looking for something easy to wear every day.',
      link: '', example: true, replies: []
    }
  ];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const safeUrl = (value) => {
    try {
      const url = new URL(String(value).trim());
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const readCommunity = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.posts)) return {posts: saved.posts.slice(0, 100), votes: Array.isArray(saved.votes) ? saved.votes : []};
    } catch {}
    return {posts: examplePosts.map((post) => ({...post, replies: post.replies.map((reply) => ({...reply}))})), votes: []};
  };
  const savedCommunity = readCommunity();
  let posts = savedCommunity.posts;
  const votedReplies = new Set(savedCommunity.votes);
  let activeCategory = 'All brands';
  let allBrandsVisible = false;
  let communityFilter = 'All questions';
  let composing = false;
  let openThread = '';
  let message = '';
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({posts, votes: [...votedReplies]})); return true; }
    catch { message = 'Device storage is full. This change will last until you leave the page.'; return false; }
  };
  const points = () => posts.reduce((total, post) => total + post.replies.filter((reply) => reply.author === 'You').length * 5, 0);
  const filteredBrands = () => {
    const inCategory = activeCategory === 'All brands' ? brands : brands.filter((brand) => brand.category === activeCategory);
    if (activeCategory !== 'All brands') return inCategory;
    const spotlight = [11, 21, 39, 54, 66, 86];
    return [...inCategory].sort((left, right) => {
      const a = spotlight.indexOf(left.id), b = spotlight.indexOf(right.id);
      return a < 0 && b < 0 ? left.id - right.id : a < 0 ? 1 : b < 0 ? -1 : a - b;
    });
  };
  const brandRow = (brand) => `<details class="hub-brand">
    <summary><span class="hub-brand-number">${String(brand.id).padStart(2, '0')}</span><strong>${escapeHtml(brand.name)}</strong><span class="hub-chevron" aria-hidden="true">⌄</span></summary>
    <div class="hub-brand-body"><p>${escapeHtml(brand.focus)}</p><a href="${escapeHtml(safeUrl(brand.url))}" target="_blank" rel="noopener noreferrer">Visit store ↗</a></div>
  </details>`;
  const marketplace = () => {
    const listed = filteredBrands();
    const visible = allBrandsVisible ? listed : listed.slice(0, 6);
    return `<section class="hub-section" aria-labelledby="hub-market-title">
      <div class="hub-heading"><div><p class="hub-eyebrow">Discover / 02</p><h2 id="hub-market-title">Explore new drops</h2><p>Browse labels and stores, then check what is new at the source.</p></div><span class="hub-count">${brands.length} sources</span></div>
      <div class="hub-tabs" role="tablist" aria-label="Store categories">
        ${['All brands', ...categories].map((category) => `<button type="button" role="tab" aria-selected="${activeCategory === category}" class="${activeCategory === category ? 'active' : ''}" data-hub="brand-category" data-value="${escapeHtml(category)}">${escapeHtml(category)}<span>${category === 'All brands' ? brands.length : brands.filter((brand) => brand.category === category).length}</span></button>`).join('')}
      </div>
      <div class="hub-brand-list" role="tabpanel">${visible.map(brandRow).join('')}</div>
      ${listed.length > 6 ? `<button class="hub-more" type="button" data-hub="brands-expand">${allBrandsVisible ? 'Show fewer' : `Show all ${listed.length} stores`} <span aria-hidden="true">${allBrandsVisible ? '↑' : '↓'}</span></button>` : ''}
      <p class="hub-fineprint">Store links come from a research shortlist. New arrivals, stock, seller quality and delivery are checked on each store, not here.</p>
    </section>`;
  };
  const replyView = (post, reply) => `<div class="hub-reply"><div><strong>${escapeHtml(reply.author)}</strong><p>${escapeHtml(reply.text)}</p>${safeUrl(reply.link) ? `<a href="${escapeHtml(safeUrl(reply.link))}" target="_blank" rel="noopener noreferrer">View source ↗</a>` : ''}</div><button type="button" data-hub="helpful" data-post="${escapeHtml(post.id)}" data-reply="${escapeHtml(reply.id)}" aria-pressed="${votedReplies.has(reply.id)}" ${reply.author === 'You' ? 'disabled title="You cannot mark your own answer helpful"' : ''}>Helpful · ${Number(reply.helpful) || 0}</button></div>`;
  const questionView = (post) => {
    const opened = openThread === post.id;
    return `<article class="hub-question">
      <button type="button" class="hub-question-toggle" data-hub="thread" data-id="${escapeHtml(post.id)}" aria-expanded="${opened}">
        <span><small>${post.example ? 'Example discussion' : post.author === 'You' ? 'Your question' : 'Community question'} · ${escapeHtml(post.city || 'India')}</small><strong>${escapeHtml(post.question)}</strong><em>${post.replies.length ? `${post.replies.length} ${post.replies.length === 1 ? 'reply' : 'replies'}` : 'Needs a lead'}</em></span><b aria-hidden="true">${opened ? '−' : '+'}</b>
      </button>
      ${opened ? `<div class="hub-thread"><p>${escapeHtml(post.detail || 'Can you help find it?')}</p>${safeUrl(post.link) ? `<a href="${escapeHtml(safeUrl(post.link))}" target="_blank" rel="noopener noreferrer">View reference ↗</a>` : ''}
        ${post.replies.length ? `<div class="hub-replies">${post.replies.map((reply) => replyView(post, reply)).join('')}</div>` : '<p class="hub-empty-replies">No leads yet.</p>'}
        ${post.author === 'You' ? '<p class="hub-local-note">This preview saves your question on this device. Shared replies need community accounts and a live service.</p>' : `<form class="hub-reply-form" data-hub-form="reply" data-id="${escapeHtml(post.id)}"><label for="reply-${escapeHtml(post.id)}">Share a lead</label><textarea id="reply-${escapeHtml(post.id)}" name="answer" minlength="12" maxlength="400" placeholder="Where did you spot it? Include what you know about availability." required></textarea><input type="url" name="link" placeholder="Source link (optional)" inputmode="url"><button type="submit">Post answer →</button></form>`}
      </div>` : ''}
    </article>`;
  };
  const community = () => {
    const shown = posts.filter((post) => communityFilter === 'All questions' || (communityFilter === 'Needs help' ? !post.replies.length : !!post.replies.length));
    return `<section class="hub-section hub-community" aria-labelledby="hub-community-title">
      <div class="hub-heading"><div><p class="hub-eyebrow">Discover / 03</p><h2 id="hub-community-title">Find it through people</h2><p>Ask where a piece is from. Share a useful lead when you know one.</p></div></div>
      <div class="hub-community-toolbar"><div class="hub-community-filters" role="group" aria-label="Filter questions">${['All questions', 'Needs help', 'Answered'].map((filter) => `<button type="button" class="${communityFilter === filter ? 'active' : ''}" data-hub="community-filter" data-value="${filter}">${filter}</button>`).join('')}</div><button type="button" class="hub-ask" data-hub="compose">${composing ? 'Cancel' : 'Ask the community +'}</button></div>
      ${composing ? `<form class="hub-compose" data-hub-form="question"><label for="hub-question">What are you trying to find?</label><input id="hub-question" name="question" minlength="12" maxlength="180" placeholder="Where can I find a jacket like this?" required><label for="hub-detail">A little more detail</label><textarea id="hub-detail" name="detail" maxlength="500" placeholder="Colour, fit, budget or where you last saw it"></textarea><div class="hub-form-two"><label>City (optional)<input name="city" maxlength="50" placeholder="Mumbai"></label><label>Reference link (optional)<input type="url" name="link" placeholder="https://..." inputmode="url"></label></div><button type="submit">Post question →</button></form>` : ''}
      <div class="hub-question-list">${shown.length ? shown.map(questionView).join('') : '<p class="hub-empty-replies">No questions in this view yet.</p>'}</div>
      <div class="hub-rewards"><span aria-hidden="true">✳</span><div><strong>Your reputation · ${points()} preview points</strong><p>Answering earns 5 local preview points. Helpful finds can become digital badges; merchandise rewards are still being explored.</p></div></div>
      <p class="hub-fineprint">Community posts and points are saved only in this browser preview. Example discussions are labelled. Links and local shop sightings are leads, not verified stock.</p>
    </section>`;
  };
  const render = () => `<div id="discover-hub" class="discover-hub">${marketplace()}${community()}<p class="hub-message" role="status" aria-live="polite">${escapeHtml(message)}</p></div>`;
  const update = () => {
    const root = document.querySelector('#discover-hub');
    if (!root) return;
    const tabsScroll = root.querySelector?.('.hub-tabs')?.scrollLeft || 0;
    const focused = document.activeElement?.dataset;
    root.outerHTML = render();
    const nextRoot = document.querySelector('#discover-hub');
    const tabs = nextRoot?.querySelector?.('.hub-tabs');
    if (tabs) tabs.scrollLeft = tabsScroll;
    if (focused?.hub) {
      [...(nextRoot?.querySelectorAll?.('[data-hub]') || [])]
        .find((item) => item.dataset.hub === focused.hub && item.dataset.value === focused.value && item.dataset.id === focused.id)
        ?.focus();
    }
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-hub]');
    if (!button || !document.querySelector('#discover-hub')) return;
    message = '';
    const action = button.dataset.hub;
    if (action === 'brand-category' && categories.concat('All brands').includes(button.dataset.value)) { activeCategory = button.dataset.value; allBrandsVisible = false; }
    else if (action === 'brands-expand') allBrandsVisible = !allBrandsVisible;
    else if (action === 'community-filter') { communityFilter = button.dataset.value; openThread = ''; }
    else if (action === 'compose') composing = !composing;
    else if (action === 'thread') openThread = openThread === button.dataset.id ? '' : button.dataset.id;
    else if (action === 'helpful') {
      const post = posts.find((item) => item.id === button.dataset.post);
      const reply = post?.replies.find((item) => item.id === button.dataset.reply);
      if (reply && reply.author !== 'You') {
        const voted = votedReplies.has(reply.id);
        reply.helpful = Math.max(0, (Number(reply.helpful) || 0) + (voted ? -1 : 1));
        if (voted) votedReplies.delete(reply.id); else votedReplies.add(reply.id);
        persist();
      }
    }
    else return;
    update();
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-hub-form]');
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);
    const link = String(values.get('link') || '').trim();
    if (link && !safeUrl(link)) { message = 'Use a full http or https link.'; update(); return; }
    if (form.dataset.hubForm === 'question') {
      const question = String(values.get('question') || '').trim().slice(0, 180);
      if (question.length < 12) { message = 'Add a little more detail to your question.'; update(); return; }
      const id = crypto.randomUUID?.() || `local-${Date.now()}`;
      posts.unshift({id, author: 'You', city: String(values.get('city') || '').trim().slice(0, 50), question, detail: String(values.get('detail') || '').trim().slice(0, 500), link: safeUrl(link), example: false, replies: []});
      posts = posts.slice(0, 100); composing = false; communityFilter = 'All questions'; openThread = id;
      message = 'Question saved on this device.'; persist(); update();
    } else if (form.dataset.hubForm === 'reply') {
      const post = posts.find((item) => item.id === form.dataset.id);
      const answer = String(values.get('answer') || '').trim().slice(0, 400);
      if (!post || answer.length < 12) { message = 'Add a little more detail to your answer.'; update(); return; }
      if (post.author === 'You') return;
      post.replies.push({id: crypto.randomUUID?.() || `reply-${Date.now()}`, author: 'You', text: answer, link: safeUrl(link), helpful: 0});
      openThread = post.id; message = 'Answer saved. You earned 5 preview reputation points.'; persist(); update();
    }
  });
  window.DiscoverHub = {render, getBrands: () => brands, getPosts: () => posts};
})();
