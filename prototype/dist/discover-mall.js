/* An original, top-down storefront map for exploring the researched brand shortlist. */
(() => {
  const brands = Array.isArray(window.DiscoverBrands) ? window.DiscoverBrands : [];
  const icons = window.BrandIconMap || {};
  const categories = [...new Set(brands.map((brand) => brand.category))];
  const shortNames = ['Everyday', 'Graphics', 'Streetwear', 'Menswear', 'Women', 'Ethnic', 'Active', 'Multi-brand', 'Indie'];
  const laneRules = {
    'Broad retail': [['Everyday', /everyday|casual|broad/i], ['Value', /value/i], ['Ethnic', /ethnic|Indian/i], ['Premium', /premium|designer/i]],
    'Fandom and graphics': [['Anime', /anime|cosplay/i], ['Film & pop culture', /film|cinema|pop culture/i], ['Graphic tees', /graphic|tee/i]],
    'Streetwear and denim': [['Denim', /denim/i], ['Utility', /utility|cargo|modular/i], ['Designer', /designer|experimental|statement/i], ['Relaxed fits', /relaxed|oversized|casual/i]],
    'Menswear and smart casual': [['Shirts', /shirt/i], ['Tailoring', /tailor|suit|formal|workwear/i], ['Casual', /casual|everyday|tee|basics/i], ['Trousers', /trouser|pant/i]],
    'Contemporary and womenswear': [['Workwear', /workwear|tailor|shirt|trouser/i], ['Resort', /holiday|resort|summer/i], ['Occasion', /occasion|party/i], ['Everyday', /everyday|relaxed|minimal|western/i]],
    'Ethnic and craft': [['Sarees', /saree|handloom|blouse/i], ['Kurtas & sets', /kurta|sets|ethnic/i], ['Festive', /occasion|wedding|festive/i], ['Craft', /craft|textile|block-print|handloom/i]],
    'Activewear and inclusive fits': [['Performance', /performance|active/i], ['Athleisure', /athleisure|casual/i], ['Inclusive fits', /inclusive/i]],
    'Curated multi-brand': [['Streetwear', /streetwear/i], ['Designer', /designer|occasion/i], ['Craft', /craft/i]],
    'Independent design': [['Craft', /craft/i], ['Upcycled', /upcycled|organic/i], ['Streetwear', /streetwear/i], ['Casual', /casual/i]]
  };
  const storageKey = 'tbw-discover-mall-v1';
  const pageSize = 6;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const safeUrl = (value) => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  const loadProgress = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return {districts: new Set((saved?.districts || []).filter((name) => categories.includes(name))), stores: new Set((saved?.stores || []).filter((id) => brands.some((brand) => brand.id === id)))};
    } catch { return {districts: new Set(), stores: new Set()}; }
  };
  const progress = loadProgress();
  let stage = 'map';
  let category = '';
  let lane = 'All stores';
  let page = 0;
  let activeBrand = null;
  let detailTab = 'designs';
  let moving = false;
  const updateFeed = {phase: 'idle', generatedAt: null, brands: {}};
  let updateRequest = null;
  const updateFor = (brand) => updateFeed.brands[String(brand.id)] || null;
  const itemsFor = (brand, kind) => Array.isArray(updateFor(brand)?.[kind]) ? updateFor(brand)[kind].filter((item) => item && typeof item === 'object') : [];
  const imageUrl = (value) => {
    const url = safeUrl(value);
    return url.startsWith('https://') ? url : '';
  };
  const checkedLabel = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? `Checked ${new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short'}).format(date)}` : 'Not checked yet';
  };
  const priceLabel = (value) => {
    const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(amount) && amount > 0 ? `₹${new Intl.NumberFormat('en-IN', {maximumFractionDigits: 0}).format(amount)}` : '';
  };
  const loadUpdates = () => {
    if (updateRequest) return updateRequest;
    if (typeof fetch !== 'function') { updateFeed.phase = 'unavailable'; return Promise.resolve(null); }
    updateFeed.phase = 'loading';
    updateRequest = fetch('/api/mall/updates', {headers: {Accept: 'application/json'}})
      .then((response) => { if (!response.ok) throw new Error('Feed unavailable'); return response.json(); })
      .then((data) => {
        updateFeed.generatedAt = typeof data?.generatedAt === 'string' ? data.generatedAt : null;
        updateFeed.brands = data?.brands && typeof data.brands === 'object' && !Array.isArray(data.brands) ? data.brands : {};
        updateFeed.phase = 'ready';
        update();
        return data;
      })
      .catch(() => { updateFeed.phase = 'unavailable'; update(); return null; });
    return updateRequest;
  };
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({districts: [...progress.districts], stores: [...progress.stores]})); } catch {} };
  const allCategoryBrands = () => brands.filter((brand) => brand.category === category);
  const availableLanes = () => [['All stores', allCategoryBrands().length], ...(laneRules[category] || []).map(([name, pattern]) => [name, allCategoryBrands().filter((brand) => pattern.test(brand.focus)).length]).filter((item) => item[1] > 0)];
  const categoryBrands = () => {
    const rule = (laneRules[category] || []).find(([name]) => name === lane)?.[1];
    return rule ? allCategoryBrands().filter((brand) => rule.test(brand.focus)) : allCategoryBrands();
  };
  const pages = () => Math.max(1, Math.ceil(categoryBrands().length / pageSize));
  const visibleBrands = () => categoryBrands().slice(page * pageSize, (page + 1) * pageSize);
  const logo = (brand, className = '') => icons[brand.id]
    ? `<span class="mall-logo ${className}"><img src="${escapeHtml(icons[brand.id])}" alt="" loading="lazy" decoding="async"><span class="mall-logo-fallback">${escapeHtml(brand.name[0])}</span></span>`
    : `<span class="mall-logo mall-logo-text ${className}" aria-hidden="true">${escapeHtml(brand.name[0])}</span>`;
  const avatar = (variant = '', style = '') => `<span class="mall-avatar ${variant}" ${style ? `style="${style}"` : ''} aria-hidden="true"><span class="mall-avatar-shadow"></span><span class="mall-avatar-legs"><i></i><i></i></span><span class="mall-avatar-arm mall-avatar-arm-left"></span><span class="mall-avatar-arm mall-avatar-arm-right"></span><span class="mall-avatar-body"></span><span class="mall-avatar-head"></span></span>`;
  // Districts that match the signed-in person's onboarding answers get a "For you" sign (design QA #15).
  const interestDistricts = {'mens-formal': ['Menswear and smart casual'], 'mens-casual': ['Menswear and smart casual', 'Broad retail'], 'womens-ethnic': ['Ethnic and craft'], 'womens-western': ['Contemporary and womenswear'], streetwear: ['Streetwear and denim'], athleisure: ['Activewear and inclusive fits'], sneakers: ['Activewear and inclusive fits', 'Streetwear and denim'], accessories: ['Curated multi-brand'], luxury: ['Curated multi-brand'], budget: ['Broad retail'], indie: ['Independent design']};
  const forYou = () => {
    const profile = window.TBWAccount?.profile;
    if (!profile) return new Set();
    const picked = (profile.interests || []).flatMap((id) => interestDistricts[id] || []);
    if (!picked.length) picked.push(...(profile.gender === 'male' ? ['Menswear and smart casual'] : profile.gender === 'female' ? ['Contemporary and womenswear', 'Ethnic and craft'] : []));
    return new Set(picked.filter((name) => categories.includes(name)));
  };
  const district = (name, index) => {
    const count = brands.filter((brand) => brand.category === name).length;
    const mine = forYou().has(name);
    return `<button type="button" class="mall-district district-${index + 1} ${progress.districts.has(name) ? 'visited' : ''} ${mine ? 'for-you' : ''}" data-mall="category" data-value="${escapeHtml(name)}" aria-label="Enter ${escapeHtml(name)}, ${count} stores">
      <span class="mall-roof"><span class="mall-roof-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(shortNames[index] || name)}</strong><small>${count} stores</small>${mine ? '<em class="mall-for-you">For you</em>' : ''}</span><span class="mall-door" aria-hidden="true"></span>
    </button>`;
  };
  const map = () => `<div class="mall-scene mall-overview">
    <div class="mall-scene-top"><span><b class="mall-live-dot"></b> Mall map</span><span>${forYou().size ? 'Picked for you ✦' : 'Choose a district'}</span></div>
    <div class="mall-map" role="group" aria-label="Nine shopping districts">${categories.map(district).join('')}${avatar('mall-avatar-map')}<span class="mall-crossing mall-crossing-one" aria-hidden="true"></span><span class="mall-crossing mall-crossing-two" aria-hidden="true"></span></div>
    <div class="mall-scene-bottom"><span>01 / Mall map</span><span>Tap a building ↗</span></div>
  </div>`;
  const laneScene = () => `<div class="mall-inside"><div class="mall-inside-heading"><button type="button" class="mall-back" data-mall="back">← Mall map</button><div><span class="mall-micro">District ${String(categories.indexOf(category) + 1).padStart(2, '0')} / ${allCategoryBrands().length} stores</span><h3>${escapeHtml(category)}</h3></div></div>
    <div class="mall-scene"><div class="mall-scene-top"><span><b class="mall-live-dot"></b> Inside the district</span><span>Choose a lane</span></div><div class="mall-lane-floor" role="group" aria-label="Shopping lanes in ${escapeHtml(category)}">${availableLanes().map(([name, count], index) => `<button type="button" class="mall-lane-room lane-room-${index}" data-mall="lane" data-value="${escapeHtml(name)}" aria-label="Enter ${escapeHtml(name)}, ${count} stores"><span class="mall-lane-number">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(name)}</strong><small>${count} stores</small><span class="mall-lane-entry" aria-hidden="true"></span></button>`).join('')}${availableLanes().length % 2 ? '<span class="mall-lane-plaza" aria-hidden="true"><i></i></span>' : ''}${avatar('mall-avatar-lanes')}</div><div class="mall-scene-bottom"><span>02 / Choose a lane</span><span>Pick a lane ↗</span></div></div></div>`;
  const store = (brand, index) => {
    const images = [...itemsFor(brand, 'designs'), ...itemsFor(brand, 'offers')].map((item) => imageUrl(item.image)).filter(Boolean).slice(0, 3);
    const imageStrip = images.length ? `<span class="mall-store-art" aria-hidden="true">${images.map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`).join('')}</span>` : '';
    const designCount = itemsFor(brand, 'designs').length;
    const offerCount = itemsFor(brand, 'offers').length;
    const updateCount = designCount + offerCount;
    const hoverItem = [...itemsFor(brand, 'designs'), ...itemsFor(brand, 'offers')].find((item) => imageUrl(item.image));
    const hoverCard = hoverItem ? `<span class="mall-hover-preview" aria-hidden="true"><img src="${escapeHtml(imageUrl(hoverItem.image))}" alt="" loading="lazy" decoding="async"><span><strong>${escapeHtml(hoverItem.title || brand.name)}</strong><small>${designCount} designs · ${offerCount} offers</small></span></span>` : '';
    return `<button type="button" class="mall-store ${activeBrand === brand.id ? 'selected' : ''} ${images.length ? 'has-art' : ''}" data-mall="store" data-id="${brand.id}" aria-label="Explore ${escapeHtml(brand.name)}${updateCount ? `, ${updateCount} store updates` : ''}" aria-pressed="${activeBrand === brand.id}">
      <span class="mall-awning" aria-hidden="true"></span><span class="mall-store-front">${logo(brand)}<strong>${escapeHtml(brand.name)}</strong><small>${escapeHtml(brand.focus)}</small>${imageStrip}</span><span class="mall-store-peek" aria-hidden="true">${images.length ? 'See designs and offers →' : 'Explore this store →'}</span>${hoverCard}<span class="mall-store-door" aria-hidden="true"></span><span class="mall-store-index">${String(page * pageSize + index + 1).padStart(2, '0')}</span>
    </button>`;
  };
  const productCard = (item, kind) => {
    const href = safeUrl(item.url);
    if (!href.startsWith('https://') || !item.title) return '';
    const image = imageUrl(item.image);
    const price = priceLabel(item.price);
    const original = priceLabel(item.originalPrice);
    const discount = Number(item.discountPercent);
    const badge = kind === 'offers' ? (Number.isFinite(discount) && discount > 0 && discount < 100 ? `${Math.round(discount)}% off` : 'Offer at source') : (item.isNew === true ? 'Newly seen' : 'At the store');
    return `<a class="mall-find-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span class="mall-find-media">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : ''}<span class="mall-find-badge">${escapeHtml(badge)}</span></span><span class="mall-find-copy"><strong>${escapeHtml(item.title)}</strong><span class="mall-find-prices">${price ? `<b>${escapeHtml(price)}</b>` : ''}${kind === 'offers' && original && original !== price ? `<s>${escapeHtml(original)}</s>` : ''}</span><span class="mall-find-link">View at store ↗</span></span></a>`;
  };
  const storeDetail = () => {
    const brand = brands.find((item) => item.id === activeBrand);
    if (!brand) return '<div class="mall-store-hint"><span class="mall-hint-mark" aria-hidden="true">↗</span><strong>Pick a storefront</strong><p>See its latest verified designs and offers here.</p></div>';
    const entry = updateFor(brand);
    const designs = itemsFor(brand, 'designs');
    const offers = itemsFor(brand, 'offers');
    const allFreshDesigns = designs.length > 0 && designs.every((item) => item.isNew === true);
    const items = detailTab === 'offers' ? offers : designs;
    const checked = checkedLabel(entry?.checkedAt);
    const isStale = entry?.checkedAt && Date.now() - new Date(entry.checkedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
    let emptyText = detailTab === 'offers' ? 'No current offers were verified in the last check.' : 'No designs have been verified for this store yet.';
    if (updateFeed.phase === 'loading') emptyText = 'Loading the latest store check…';
    else if (updateFeed.phase === 'unavailable') emptyText = 'Store updates are unavailable right now. You can still visit the store.';
    else if (!entry || entry.status === 'not_checked') emptyText = 'This store has not been checked yet.';
    else if (entry.status === 'blocked') emptyText = 'This store does not allow an automated check. Visit the store for the latest.';
    else if (entry.status === 'error') emptyText = 'The last store check failed. Visit the store for the latest.';
    const cards = items.map((item) => productCard(item, detailTab)).filter(Boolean);
    const syncWarning = cards.length && ['blocked', 'error'].includes(entry?.status) ? '<p class="mall-update-warning">The latest check did not complete. These items may be out of date.</p>' : '';
    const section = entry?.sources?.[detailTab];
    const sourceLink = section && safeUrl(section.url).startsWith('https://') ? `<a class="mall-store-visit" href="${escapeHtml(safeUrl(section.url))}" target="_blank" rel="noopener noreferrer">Browse ${escapeHtml(section.label || (detailTab === 'designs' ? 'new arrivals' : 'offers'))} ↗</a>` : '';
    return `<div class="mall-store-detail" aria-live="polite"><div class="mall-detail-heading">${logo(brand, 'mall-detail-logo')}<div><span class="mall-micro">Store ${String(brand.id).padStart(2, '0')} / ${escapeHtml(category)}</span><h3>${escapeHtml(brand.name)}</h3></div></div><p>${escapeHtml(brand.focus)}</p>
      <div class="mall-update-heading"><strong>At ${escapeHtml(brand.name)}</strong><span>${escapeHtml(checked)}${isStale ? ' · May be outdated' : ''}</span></div>
      <div class="mall-update-tabs" role="group" aria-label="${escapeHtml(brand.name)} updates"><button type="button" data-mall="feed-tab" data-value="designs" class="${detailTab === 'designs' ? 'active' : ''}" aria-pressed="${detailTab === 'designs'}">${allFreshDesigns ? 'New designs' : 'Latest designs'} <span>${designs.length}</span></button><button type="button" data-mall="feed-tab" data-value="offers" class="${detailTab === 'offers' ? 'active' : ''}" aria-pressed="${detailTab === 'offers'}">Offers <span>${offers.length}</span></button></div>
      ${syncWarning}
      ${cards.length ? `<div class="mall-find-board">${cards.join('')}</div>` : `<div class="mall-update-empty">${escapeHtml(emptyText)}</div>`}
      ${sourceLink}
      <a class="mall-store-visit" href="${escapeHtml(safeUrl(brand.url))}" target="_blank" rel="noopener noreferrer">Visit ${escapeHtml(brand.name)} ↗</a><small>Products, prices and availability are confirmed at the store.</small></div>`;
  };
  const stores = () => {
    const selectedIndex = visibleBrands().findIndex((brand) => brand.id === activeBrand);
    const avatarStyle = selectedIndex < 0 ? '' : `left:${selectedIndex % 2 === 0 ? '48%' : '52%'};top:${((Math.floor(selectedIndex / 2) + .5) / 3) * 100}%`;
    return `<div class="mall-inside">
    <div class="mall-inside-heading"><button type="button" class="mall-back" data-mall="back">← District lanes</button><div><span class="mall-micro">District ${String(categories.indexOf(category) + 1).padStart(2, '0')} / ${allCategoryBrands().length} stores</span><h3>${escapeHtml(category)}</h3></div></div>
    <div class="mall-lanes" role="group" aria-label="Explore ${escapeHtml(category)} by type">${availableLanes().map(([name, count]) => `<button type="button" class="${lane === name ? 'active' : ''}" data-mall="lane" data-value="${escapeHtml(name)}" aria-pressed="${lane === name}"><span>${escapeHtml(name)}</span><small>${count}</small></button>`).join('')}</div>
    <div class="mall-store-layout"><div class="mall-scene mall-store-scene"><div class="mall-scene-top"><span><b class="mall-live-dot"></b> Storefronts</span><span>Block ${page + 1} / ${pages()}</span></div><div class="mall-shop-floor">${visibleBrands().map(store).join('')}${avatar('mall-avatar-shops', avatarStyle)}<span class="mall-aisle" aria-hidden="true"></span></div><div class="mall-scene-bottom"><span>03 / Pick a store</span><span>${progress.stores.size} signs explored</span></div></div>
    <div class="mall-after-scene">${storeDetail()}<div class="mall-pager"><button type="button" data-mall="previous" ${page === 0 ? 'disabled' : ''}>← Previous block</button><span>${page + 1} of ${pages()}</span><button type="button" data-mall="next" ${page >= pages() - 1 ? 'disabled' : ''}>Next block →</button></div></div></div>
  </div>`;
  };
  const directory = () => `<details class="mall-directory"><summary>Browse all 100 stores as a list <span aria-hidden="true">+</span></summary><div class="mall-directory-inner">${categories.map((name) => `<div class="mall-directory-group"><h3>${escapeHtml(name)}</h3><div>${brands.filter((brand) => brand.category === name).map((brand) => `<a href="${escapeHtml(safeUrl(brand.url))}" target="_blank" rel="noopener noreferrer">${logo(brand)}<span>${escapeHtml(brand.name)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></div>`).join('')}</div></details>`;
  const render = () => {
    if (updateFeed.phase === 'idle') void loadUpdates();
    return `<section id="discover-mall" class="discover-mall" aria-labelledby="mall-title"><div class="mall-heading"><div><p class="hub-eyebrow">Discover / 02</p><h2 id="mall-title">Explore the mall</h2><p>Walk into a district, pick a store, then see what is new.</p></div><span class="mall-source-count">${brands.length} stores</span></div>
    <div class="mall-progress"><div><span class="mall-stamp">✳</span><strong>${progress.districts.size} of ${categories.length} districts explored</strong></div><span>${progress.stores.size} store ${progress.stores.size === 1 ? 'sign' : 'signs'} found</span></div>
    ${stage === 'map' ? map() : stage === 'lanes' ? laneScene() : stores()}
    ${directory()}
    <p class="mall-note">Store updates come from public store pages and may be incomplete. Logos identify their respective stores; no partnership or endorsement is implied.</p>
  </section>`;
  };
  const update = () => { const root = document.querySelector('#discover-mall'); if (root) root.outerHTML = render(); };
  const enterCategory = (name) => {
    if (!categories.includes(name)) return;
    category = name; lane = 'All stores'; stage = 'lanes'; page = 0; activeBrand = null;
    progress.districts.add(name); persist(); update();
  };
  const selectBrand = (id) => {
    const brand = visibleBrands().find((item) => item.id === Number(id));
    if (!brand) return;
    activeBrand = brand.id; detailTab = 'designs'; progress.stores.add(brand.id); persist(); update();
    if (window.innerWidth <= 900) document.querySelector('#discover-mall .mall-store-detail')?.scrollIntoView?.({behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth', block: 'start'});
  };
  const enterLane = (name) => { if (!availableLanes().some(([item]) => item === name)) return; lane = name; stage = 'stores'; page = 0; activeBrand = null; update(); };
  const back = () => { if (stage === 'stores') { stage = 'lanes'; activeBrand = null; } else { stage = 'map'; category = ''; lane = 'All stores'; page = 0; activeBrand = null; } update(); };
  const move = (button, callback) => {
    if (moving) return;
    const root = document.querySelector('#discover-mall');
    const sprite = root?.querySelector?.('.mall-avatar');
    if (!sprite || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) { callback(); return; }
    moving = true;
    const target = button.getBoundingClientRect();
    const parent = sprite.offsetParent?.getBoundingClientRect();
    if (!parent) { moving = false; callback(); return; }
    const inStore = button.dataset.mall === 'store';
    const targetX = inStore ? (button.matches(':nth-child(odd)') ? target.right - 5 : target.left + 5) : target.left + target.width / 2;
    sprite.style.left = `${targetX - parent.left}px`;
    sprite.style.top = `${target.top + target.height / 2 - parent.top}px`;
    sprite.classList.add('walking');
    setTimeout(() => { moving = false; callback(); }, 520);
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-mall]');
    if (!button || !document.querySelector('#discover-mall')) return;
    const action = button.dataset.mall;
    if (action === 'category') move(button, () => enterCategory(button.dataset.value));
    else if (action === 'lane' && availableLanes().some(([name]) => name === button.dataset.value)) {
      if (stage === 'lanes') move(button, () => enterLane(button.dataset.value));
      else { lane = button.dataset.value; page = 0; activeBrand = null; update(); }
    }
    else if (action === 'store') move(button, () => selectBrand(button.dataset.id));
    else if (action === 'feed-tab' && ['designs', 'offers'].includes(button.dataset.value)) { detailTab = button.dataset.value; update(); }
    else if (action === 'back') back();
    else if (action === 'next' || action === 'previous') { page = Math.max(0, Math.min(pages() - 1, page + (action === 'next' ? 1 : -1))); activeBrand = null; update(); }
  });
  document.addEventListener('error', (event) => { if (event.target.matches?.('.mall-logo img')) event.target.hidden = true; }, true);
  window.addEventListener?.('account-change', () => update());
  window.DiscoverMall = {render, loadUpdates, getState: () => ({stage, category, lane, page, activeBrand, detailTab, feedPhase: updateFeed.phase, districts: [...progress.districts], stores: [...progress.stores]}), enterCategory, enterLane, selectBrand, back};
})();
