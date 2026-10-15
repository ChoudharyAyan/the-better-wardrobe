/* Cart (owner, 15 Oct 2026: "put the things shown in Discover inside a cart inside My Profile").
   Pieces from Ask Bao results and the Mall's new arrivals and offers can be added; My Profile lists them
   with a total and a link back to each store. Saved on this device (localStorage); account sync is a
   later step. Items are plain data: {id,title,image,price,priceText,url,store,source,addedAt}. */
(() => {
  'use strict';
  const KEY = 'tbw-cart-v1';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = () => { try { const list = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } };
  const write = list => {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); } catch {}
    try { window.dispatchEvent(new CustomEvent('cart-change', {detail: {count: list.length}})); } catch {}
  };
  const safeUrl = v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const priceOf = v => { const n = typeof v === 'number' ? v : Number(String(v || '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
  const has = url => read().some(i => i.url === url);
  function add(raw) {
    const url = safeUrl(raw?.url); if (!url) return false;
    const list = read().filter(i => i.url !== url);
    list.unshift({id: url, title: String(raw.title || 'Saved piece').slice(0, 140), image: safeUrl(raw.image), price: priceOf(raw.price ?? raw.priceText),
      priceText: String(raw.priceText || '').slice(0, 40), url, store: String(raw.store || '').slice(0, 60), source: String(raw.source || 'ask').slice(0, 20), addedAt: new Date().toISOString()});
    write(list); return true;
  }
  const remove = url => write(read().filter(i => i.url !== url));
  // A small toggle for any card: `TBWCart.button(item)`. The item rides along as JSON in a data attribute.
  const button = item => {
    const url = safeUrl(item?.url); if (!url) return '';
    const on = has(url);
    return `<button type="button" class="tbw-cart-btn${on ? ' on' : ''}" data-cart="${esc(JSON.stringify({...item, url}))}" aria-pressed="${on}" aria-label="${on ? 'Remove from cart' : 'Add to cart'}">${on ? '✓ In cart' : '+ Cart'}</button>`;
  };
  document.addEventListener('click', event => {
    const b = event.target.closest?.('[data-cart]'); if (!b) return;
    event.preventDefault(); event.stopPropagation();
    let item; try { item = JSON.parse(b.dataset.cart); } catch { return; }
    const on = has(item.url); on ? remove(item.url) : add(item);
    b.classList.toggle('on', !on); b.setAttribute('aria-pressed', String(!on));
    b.setAttribute('aria-label', on ? 'Add to cart' : 'Remove from cart'); b.textContent = on ? '+ Cart' : '✓ In cart';
  }, true);
  document.addEventListener('click', event => {
    const b = event.target.closest?.('[data-cart-remove]'); if (!b) return;
    event.preventDefault(); remove(b.dataset.cartRemove);
  });
  // My Profile: the cart, newest first, with a total of the prices we know.
  const card = () => {
    const list = read();
    const total = list.reduce((s, i) => s + (i.price || 0), 0), priced = list.filter(i => i.price).length;
    const rows = list.map(i => `<li class="tbw-cart-row">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="tbw-cart-ph" aria-hidden="true"></span>'}<div><small>${esc(i.store || 'Store')}${i.source === 'mall-offer' ? ' · Offer' : i.source === 'mall-new' ? ' · New in' : ''}</small><strong>${esc(i.title)}</strong><span>${i.price ? '₹' + i.price.toLocaleString('en-IN') : esc(i.priceText || 'See price at store')}</span></div><div class="tbw-cart-actions"><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Open at store ↗</a><button type="button" data-cart-remove="${esc(i.url)}" aria-label="Remove ${esc(i.title)} from cart">Remove</button></div></li>`).join('');
    return `<section class="tbw-cart" aria-label="My cart"><div class="tbw-cart-head"><h2>My cart <em>${list.length}</em></h2>${priced ? `<span>₹${total.toLocaleString('en-IN')}${priced < list.length ? ' + more' : ''}</span>` : ''}</div>${list.length ? `<ul>${rows}</ul><p class="tbw-cart-note">Saved on this device. Prices and stock are confirmed at each store.</p>` : '<p class="tbw-cart-empty">Tap <b>+ Cart</b> on anything in Ask Bao or the Mall to keep it here.</p>'}</section>`;
  };
  window.TBWCart = {list: read, count: () => read().length, has, add, remove, button, card};
})();
