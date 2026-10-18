// ===================== Maison Meka — catalogue ===================== //
/* The shop reads everything from the server — products, categories, their
   order and the best sellers — so whatever is changed in the dashboard shows
   here on the next page load. Pages wait for MM_READY before drawing. */

let PREVIEW_FILL = false;      // every category shows the whole catalogue (set in the dashboard)
let CATEGORIES = [];           // the categories shown in navigation, in display order
let CATEGORIES_ALL = [];       // every category, for lookups
let ALL_CATEGORY = { slug:'all', name:'The Collection', img:'assets/cat-potiches.webp', desc:'' };
let PRODUCTS = [];             // live products, in the collection's order
let BESTSELLERS = [];          // product ids, in the best sellers' order
let STORE = {};

let CONTENT = {};
let POPUP = null;          // the coupon set to pop up, if any
/* opened straight from the folder (file://) there is no local server, so the
   pages read the live store instead */
const MM_API = location.protocol === 'file:' ? 'https://maison-meka-lemon.vercel.app' : '';
const MM_READY = fetch(MM_API + '/api/catalog')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    PREVIEW_FILL   = !!d.settings.previewFill;
    STORE          = { ...d.settings, sale: d.sale || null };
    CATEGORIES_ALL = d.categories;
    CATEGORIES     = d.categories.filter(c => c.nav);
    if (d.allCategory) ALL_CATEGORY = { ...ALL_CATEGORY, ...d.allCategory, slug:'all' };
    PRODUCTS       = d.products;
    BESTSELLERS    = d.bestsellers;
    CONTENT        = d.content || {};
    POPUP          = d.popup || null;

    /* in Arabic, every name, description and text comes from its Arabic
       version (typed in the dashboard), falling back to English if empty */
    if (window.MM_LANG === 'ar') {
      const has = (v) => Array.isArray(v) ? v.length : String(v || '').trim();
      const pick = (ar, en) => has(ar) ? ar : en;
      PRODUCTS.forEach(p => {
        const a = p.ar || {};
        ['name', 'desc', 'shortDesc', 'details', 'care', 'dims', 'size'].forEach(k => { p[k] = pick(a[k], p[k]); });
        [...(p.colors || []), ...(p.sizes || [])].forEach(v => { v.label = pick(v.ar, v.name); });
      });
      CATEGORIES_ALL.forEach(c => { const a = c.ar || {}; c.name = pick(a.name, c.name); c.desc = pick(a.desc, c.desc); });
      const ca = CONTENT.ar || {};
      ['hero', 'collections', 'best'].forEach(k => { CONTENT[k] = { ...(CONTENT[k] || {}), ...Object.fromEntries(Object.entries(ca[k] || {}).filter(([, v]) => has(v))) }; });
      if (ca.allCategory) {
        if (has(ca.allCategory.name)) ALL_CATEGORY.name = ca.allCategory.name;
        if (has(ca.allCategory.desc)) ALL_CATEGORY.desc = ca.allCategory.desc;
      }
    }
  })
  .catch(() => {
    /* opened as a plain file, or the server is down */
    document.addEventListener('DOMContentLoaded', () => {
      const n = document.createElement('div');
      n.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:999;padding:14px 18px;border-radius:12px;background:#1d2b4a;color:#fff;font:14px/1.5 Jost,sans-serif;text-align:center';
      n.textContent = 'The shop could not reach its server. Start it with "node server.js" and open http://localhost:3000';
      document.body.appendChild(n);
    });
  });

/* ---------- the store-wide sale bar, above the header — only while a sale runs ---------- */
MM_READY.then(() => {
  const sale = STORE.sale;
  if (!sale) return;
  const ar = window.MM_LANG === 'ar';
  const until = sale.end ? new Date(sale.end + 'T00:00:00').toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long' }) : '';
  const msg = ar
    ? 'خصم ' + sale.value + '% على كل المنتجات' + (until ? ' — حتى ' + until : '')
    : 'Store-wide sale — ' + sale.value + '% off everything' + (until ? ' until ' + until : '');
  const draw = () => {
    if (document.getElementById('mmSaleBar')) return;
    const bar = document.createElement('a');
    bar.id = 'mmSaleBar'; bar.className = 'mm-sale-bar'; bar.href = 'category.html';
    bar.setAttribute('data-no-i18n', '');
    bar.innerHTML = '<span class="msb-dot"></span><span class="msb-txt"></span><span class="msb-cta">' + (ar ? 'تسوّق الآن' : 'Shop now') + '</span>';
    bar.querySelector('.msb-txt').textContent = msg;
    document.body.prepend(bar);
    document.documentElement.classList.add('has-sale');
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', draw) : draw();
});

/* ---------- visits: one note per page, read by the dashboard's statistics ---------- */
MM_READY.then(() => {
  let vid;
  try {
    vid = localStorage.getItem('mm-vid');
    if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('mm-vid', vid); }
  } catch { vid = 'anon-' + Math.random().toString(36).slice(2); }
  let first = false;
  try { first = !sessionStorage.getItem('mm-s'); sessionStorage.setItem('mm-s', '1'); } catch {}
  const q = new URLSearchParams(location.search);
  const productId = /product\.html$/.test(location.pathname) ? (q.get('id') || '') : '';
  /* one note per visit, plus each product once per visit — light on the database */
  if (productId) {
    try {
      const seen = JSON.parse(sessionStorage.getItem('mm-pv') || '[]');
      if (seen.includes(productId)) { if (!first) return; }
      else { seen.push(productId); sessionStorage.setItem('mm-pv', JSON.stringify(seen.slice(-60))); }
    } catch {}
  }
  if (!first && !productId) return;
  const body = {
    vid, first, path: location.pathname,
    ref: document.referrer, utm: q.get('utm_source') || '',
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '', lang: navigator.language || '',
    product: /product\.html$/.test(location.pathname) ? (q.get('id') || '') : ''
  };
  try {
    navigator.sendBeacon
      ? navigator.sendBeacon(MM_API + '/api/track', new Blob([JSON.stringify(body)], { type: 'application/json' }))
      : fetch(MM_API + '/api/track', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), keepalive:true });
  } catch {}
});

/* ---------- the side menu lists the categories set to show in navigation ---------- */
MM_READY.then(() => {
  const draw = () => {
    const ul = document.getElementById('smCats');
    if (!ul || !CATEGORIES.length) return;
    ul.innerHTML = CATEGORIES.map((c, i) =>
      `<li style="--i:${i}"><a href="category.html?c=${encodeURIComponent(c.slug)}">${MM.esc(c.name)}</a></li>`).join('');
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', draw) : draw();
});

/* ===================== shared helpers ===================== */
const MM = (() => {

  const money = (n) => 'EGP ' + Number(n || 0).toLocaleString('en-US');
  const catBy  = (slug) => CATEGORIES_ALL.find(c => c.slug === slug);
  const byId   = (id) => PRODUCTS.find(p => p.id === id);
  const homeCat = (p) => catBy(p.cats[0]);
  /* in · low · out — drives the colour of every add-to-cart button */
  const status = (p) => !p.stock ? 'out' : (p.low ? 'low' : 'in');
  const STATUS_LABEL = { in:'In Stock', low:'Low Stock', out:'Sold Out' };
  /* descriptions written in the dashboard may carry simple formatting */
  const safeHTML = (html) => {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    const OK = ['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P'];
    const walk = (n) => [...n.childNodes].forEach(ch => {
      if (ch.nodeType === 1) {
        walk(ch);
        if (!OK.includes(ch.tagName)) ch.replaceWith(...ch.childNodes);
        else [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
      } else if (ch.nodeType !== 3) ch.remove();
    });
    walk(box);
    return box.innerHTML;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]
  ));

  /* ---------- the wishlist — the same store the wishlist page reads ---------- */
  const WL_KEY = 'mm-wishlist';
  const wlRead = () => {
    try {
      const list = JSON.parse(localStorage.getItem(WL_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  };
  const wlWrite = (list) => { try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch {} };
  const wlHas = (id) => wlRead().some(i => i.id === id);
  /* the light copy of the main photo, for cards, the bag and the wishlist */
  const thumb = (p) => (p.thumbs && p.thumbs[0]) || p.imgs[0];
  const metaOf = (p) => [homeCat(p)?.name, p.dims].filter(Boolean).join(' · ');

  /* returns true when the piece is now saved */
  const wlToggle = (p) => {
    const list = wlRead();
    if (list.some(i => i.id === p.id)) {
      wlWrite(list.filter(i => i.id !== p.id));
      return false;
    }
    list.push({ id:p.id, name:p.name, meta:metaOf(p), price:p.price, img:thumb(p) });
    wlWrite(list);
    return true;
  };

  /* ---------- the bag — handed to the drawer that script.js owns ---------- */
  /* a variant (colour / size) travels as part of the id, so the server can
     price it and take it out of the right stock */
  const addToBag = (p, qty = 1, variant = null) => {
    const item = variant
      ? { id:p.id + '::' + variant.label, name:p.name, meta:variant.display || variant.label, price:variant.price, img:thumb(p) }
      : { id:p.id, name:p.name, meta:metaOf(p), price:p.price, img:thumb(p) };
    if (window.mmCart) window.mmCart.add(item, qty);
  };
  const openBag = () => { if (window.mmCart) window.mmCart.open(); };

  /* ---------- the small note that slides up after an action ---------- */
  let toastEl, toastTimer;
  const toast = (msg, actionLabel, onAction) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mm-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<span class="mm-toast-tx"></span><button class="mm-toast-act"></button>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('.mm-toast-tx').textContent = msg;
    const act = toastEl.querySelector('.mm-toast-act');
    act.style.display = actionLabel ? '' : 'none';
    act.textContent = actionLabel || '';
    act.onclick = () => { toastEl.classList.remove('show'); onAction && onAction(); };
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  };

  /* ---------- icons used in more than one place ---------- */
  const ICON = {
    heart:'<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.3-4.7-9.6-9.2C.8 7.9 2.2 4.5 5.4 3.7c1.9-.5 3.9.3 5 1.9.4.7 1 1.5 1.6 1.5s1.2-.8 1.6-1.5c1.1-1.6 3.1-2.4 5-1.9 3.2.8 4.6 4.2 3 7.6C19.3 15.8 12 20.5 12 20.5z"/></svg>',
    bag:'<svg viewBox="0 0 24 24"><path d="M5.5 8h13l-1.2 12.2a1.5 1.5 0 01-1.5 1.3H8.2a1.5 1.5 0 01-1.5-1.3z"/><path d="M8.8 8V6.2a3.2 3.2 0 016.4 0V8"/></svg>',
    arrow:'<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check:'<svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17.5 19 7"/></svg>'
  };

  /* ---------- the square every card photo sits in ---------- */
  /* the whole photo shows by default; zoom, position and background are set
     per product in the dashboard (Images & Media → Card framing) and read the
     same way there, so the dashboard preview is exactly what shows here */
  /* every card photo fills its square — the old per-product framing is ignored */
  const fitStyle = () => '';
  const squareImg = (p, cls = '') =>
    `<img class="mm-sq-img${cls ? ' ' + cls : ''}" src="${esc(thumb(p))}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;

  /* ---------- one product card, used by the grid and by "you may also like" ---------- */
  const cardHTML = (p) => {
    const cat = homeCat(p);
    const href = 'product.html?id=' + encodeURIComponent(p.id);
    const badge = p.badge
      ? `<span class="pc-badge pc-badge-${esc(p.badge.toLowerCase())}">${esc(p.badge)}</span>` : '';
    const sold  = p.stock ? '' : '<span class="pc-badge pc-badge-out">Sold Out</span>';
    /* every card's photo sits in the same square, shown whole */
    return `
      <article class="pc" data-id="${esc(p.id)}">
        <div class="pc-shot mm-sq" style="${fitStyle(p)}">
          <a href="${href}" aria-label="${esc(p.name)}">${squareImg(p, 'pc-img')}</a>
          <span class="pc-badges">${badge}${sold}</span>
          <button class="pc-fav${wlHas(p.id) ? ' on' : ''}" aria-label="Save ${esc(p.name)} to wishlist">${ICON.heart}</button>
        </div>
        <div class="pc-body">
          <span class="pc-cat">${esc(cat ? cat.name : '')}</span>
          <h3 class="pc-name"><a href="${href}">${esc(p.name)}</a></h3>
          <span class="pc-price">${money(p.price)}${p.compareAt ? ` <s>${money(p.compareAt)}</s>` : ''}</span>
          <div class="pc-actions">
            <button class="pc-add is-${status(p)}" ${p.stock ? '' : 'disabled'} title="${STATUS_LABEL[status(p)]}">
              <span class="pc-add-ic">${ICON.bag}</span>
              <span class="pc-add-tx">${p.stock ? 'Add to Cart' : 'Sold Out'}</span>
            </button>
            <a class="pc-view" href="${href}" aria-label="View ${esc(p.name)}">${ICON.plus}</a>
          </div>
        </div>
      </article>`;
  };

  /* hearts and add-to-cart on any grid of cards, wired once on its container */
  const wireCards = (root) => {
    root.addEventListener('click', (e) => {
      const card = e.target.closest('.pc');
      if (!card) return;
      const p = byId(card.dataset.id);
      if (!p) return;

      const fav = e.target.closest('.pc-fav');
      if (fav) {
        const on = wlToggle(p);
        fav.classList.toggle('on', on);
        fav.classList.remove('pop'); void fav.offsetWidth; fav.classList.add('pop');
        toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist',
              on ? 'VIEW' : '', () => { location.href = 'wishlist.html'; });
        return;
      }

      const add = e.target.closest('.pc-add');
      if (add && !add.disabled) {
        addToBag(p, 1);
        add.classList.add('added');
        add.querySelector('.pc-add-ic').innerHTML = ICON.check;
        add.querySelector('.pc-add-tx').textContent = 'Added';
        setTimeout(() => {
          add.classList.remove('added');
          add.querySelector('.pc-add-ic').innerHTML = ICON.bag;
          add.querySelector('.pc-add-tx').textContent = 'Add to Cart';
        }, 1600);
        toast(p.name + ' added to your bag', 'VIEW BAG', openBag);
      }
    });
  };

  /* ---------- pieces drift in as they reach the viewport ---------- */
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
    const wave = entries.filter(e => e.isIntersecting).map(e => e.target);
    wave.forEach((el, i) => {
      io.unobserve(el);
      setTimeout(() => el.classList.add('in'), Math.min(i, 8) * 90);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' }) : null;

  const reveal = (els) => {
    [...els].forEach(el => {
      el.classList.add('sh-rise');
      if (io) io.observe(el); else el.classList.add('in');
    });
  };

  return { safeHTML, money, catBy, byId, homeCat, status, STATUS_LABEL, esc, wlHas, wlToggle, addToBag, openBag,
           toast, ICON, thumb, fitStyle, squareImg, cardHTML, wireCards, reveal };
})();
