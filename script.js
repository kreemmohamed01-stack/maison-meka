// ===================== Maison Meka — interactions ===================== //

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Header shrink on scroll ---------- */
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    const scrolled = window.scrollY > 24;
    header.classList.toggle('scrolled', scrolled);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Slide-in menu ---------- */
  const toggle  = document.getElementById('menuToggle');
  const menu    = document.getElementById('sideMenu');
  const overlay = document.getElementById('menuOverlay');
  const close   = document.getElementById('menuClose');

  /* two drawers share the page, so the scroll lock is decided by whether
     EITHER is open rather than by whichever one moved last */
  const lockScroll = () => {
    const anyOpen = document.querySelector('.side-menu.open, .cart-drawer.open');
    document.body.style.overflow = anyOpen ? 'hidden' : '';
  };

  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    toggle.classList.toggle('active', open);
    lockScroll();
    // the categories fold shut again, so the menu always reopens the same way
    if (!open) {
      const fold = document.getElementById('smCatsFold');
      const head = document.getElementById('smCatsToggle');
      if (fold) fold.classList.remove('open');
      if (head) head.setAttribute('aria-expanded', 'false');
    }
  };

  // the fourteen categories fan out in a wave — each row carries its own index
  menu.querySelectorAll('.sm-cats li').forEach((li, i) => li.style.setProperty('--i', i));

  /* ---------- the categories fold open on the heading ---------- */
  const catsToggle = document.getElementById('smCatsToggle');
  const catsFold   = document.getElementById('smCatsFold');
  if (catsToggle && catsFold) {
    catsToggle.addEventListener('click', () => {
      const open = !catsFold.classList.contains('open');
      catsFold.classList.toggle('open', open);
      catsToggle.setAttribute('aria-expanded', String(open));
    });
  }

  toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  overlay.addEventListener('click', () => setMenu(false));
  close.addEventListener('click', () => setMenu(false));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- language switch ---------- */
  const lang = document.getElementById('smLang');
  /* a small language switch in the navbar too, beside the icons */
  const iconGroup = document.querySelector('.site-header .icon-group');
  if (iconGroup && !document.getElementById('hdLang')) {
    const isAr = window.MM_LANG === 'ar';
    const hb = document.createElement('button');
    hb.type = 'button'; hb.id = 'hdLang'; hb.className = 'hd-lang';
    hb.setAttribute('data-no-i18n', '');
    hb.setAttribute('aria-label', isAr ? 'Switch to English' : 'التبديل إلى العربية');
    hb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4"/><path d="M12 2.8c2.4 2.5 3.7 5.8 3.7 9.2s-1.3 6.7-3.7 9.2c-2.4-2.5-3.7-5.8-3.7-9.2S9.6 5.3 12 2.8z"/></svg><span>' + (isAr ? 'EN' : 'عربي') + '</span>';
    hb.addEventListener('click', () => { if (window.mmSetLang) window.mmSetLang(isAr ? 'en' : 'ar'); });
    iconGroup.insertBefore(hb, iconGroup.firstChild);
  }

  /* switches the whole site between English and Arabic (see i18n.js) */
  if (lang) {
    const cur = window.MM_LANG === 'ar' ? 'ar' : 'en';
    lang.querySelectorAll('.sm-lang-opt').forEach(o => o.classList.toggle('is-on', o.dataset.lang === cur));
    lang.addEventListener('click', () => { if (window.mmSetLang) window.mmSetLang(cur === 'ar' ? 'en' : 'ar'); });
  }

  /* ---------- Cart drawer ---------- */
  const cartBtn     = document.getElementById('cartBtn');
  const cartDrawer  = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose   = document.getElementById('cartClose');
  const cdItems     = document.getElementById('cdItems');
  const cdEmpty     = document.getElementById('cdEmpty');
  const cdFoot      = document.getElementById('cdFoot');

  const CART_KEY = 'mm-cart';
  const cartRead = () => {
    try {
      const list = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  };
  const cartWrite = (list) => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(list)); } catch {}
  };
  const money = (n) => 'EGP ' + Number(n || 0).toLocaleString('en-US');

  /* bags filled by the old demo carry ids that no longer exist — they are
     dropped once the catalogue has loaded */
  if (typeof MM_READY !== 'undefined') MM_READY.then(() => {
    if (!PRODUCTS.length) return;
    /* pieces saved under an older id (or by name) are matched back to the
       catalogue rather than dropped */
    const byId = new Map(PRODUCTS.map(p => [p.id, p]));
    const byName = new Map(PRODUCTS.map(p => [String(p.name).toLowerCase(), p]));
    const list = cartRead();
    let changed = false;
    const kept = list.map(i => {
      const [base, variant] = String(i.id).split('::');
      if (byId.has(base)) return i;
      const p = byName.get(String(i.name || base).toLowerCase());
      if (!p) return i;
      changed = true;
      return { ...i, id: variant ? p.id + '::' + variant : p.id, img: i.img || (p.thumbs && p.thumbs[0]) || p.imgs[0] };
    });
    if (changed) cartWrite(kept);
    drawCart();
  });

  /* names follow the current language when the catalogue knows the piece */
  const liveName = (it) => {
    try { const p = MM.byId(String(it.id).split('::')[0]); return p ? p.name : it.name; } catch { return it.name; }
  };
  const itemHTML = (it, i) => `
    <div class="cd-item" data-id="${it.id}" style="--i:${i}">
      <span class="cdi-shot"><img src="${it.img}" alt="${it.name}"></span>
      <div class="cdi-body">
        <p class="cdi-name">${liveName(it)}</p>
        <p class="cdi-meta">${it.meta || ''}</p>
        <div class="cdi-foot">
          <span class="cdi-qty">
            <button class="cdi-step" data-step="-1" aria-label="Fewer">
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span class="cdi-num">${it.qty}</span>
            <button class="cdi-step" data-step="1" aria-label="More">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </span>
          <span class="cdi-price">${money(it.price * it.qty)}</span>
        </div>
      </div>
      <button class="cdi-drop" aria-label="Remove ${it.name}">
        <svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>`;

  /* ---------- checkout: coupon + the customer's details, then the order is
     recorded on the server and handed to Instagram ---------- */
  const cdFootEl = document.getElementById('cdFoot');
  let coupon = null;                       // { code, discount, label, type }
  if (cdFootEl && !document.getElementById('cdCheckout')) {
    const rule = cdFootEl.querySelector('.cd-rule');
    const couponRow = document.createElement('div');
    couponRow.className = 'cd-coupon';
    couponRow.innerHTML = `
      <div class="cd-coupon-row">
        <input id="cdCouponIn" type="text" placeholder="Discount code" autocomplete="off">
        <button id="cdCouponBtn" type="button">Apply</button>
      </div>
      <p class="cd-coupon-msg" id="cdCouponMsg"></p>
      <div class="cd-line cd-line-soft" id="cdDiscLine" hidden><span id="cdDiscLabel">Discount</span><span id="cdDisc">- EGP 0</span></div>`;
    rule.parentNode.insertBefore(couponRow, rule);

    const form = document.createElement('div');
    form.className = 'cd-checkout';
    form.id = 'cdCheckout';
    form.innerHTML = `
      <p class="cd-err" id="cdErr"></p>`;
    const orderBtn = document.getElementById('cdOrder');
    orderBtn.parentNode.insertBefore(form, orderBtn);
    /* a photo of the order, for the customer to keep or send */
    const shot = document.createElement('button');
    shot.type = 'button'; shot.className = 'cd-shot'; shot.id = 'cdShot';
    shot.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 011 1V18a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5a1 1 0 011-1z"/><circle cx="12" cy="13.3" r="3.6"/></svg><span>Save order photo</span>';
    orderBtn.parentNode.insertBefore(shot, orderBtn.nextSibling);
  }

  const currentSub = () => cartRead().reduce((s, i) => s + i.price * i.qty, 0);
  const paintTotals = (sub) => {
    const disc = coupon ? Math.min(coupon.discount || 0, sub) : 0;
    document.getElementById('cdSubtotal').textContent = money(sub);
    document.getElementById('cdTotal').textContent    = money(sub - disc);
    const line = document.getElementById('cdDiscLine');
    if (line) {
      line.hidden = !coupon;
      if (coupon) {
        document.getElementById('cdDiscLabel').textContent = `${coupon.code} · ${coupon.label}`;
        document.getElementById('cdDisc').textContent = coupon.type === 'freeship' ? 'Free shipping' : '- ' + money(disc);
      }
    }
  };
  const applyCoupon = async (code, quiet) => {
    const msg = document.getElementById('cdCouponMsg');
    if (!code) { coupon = null; paintTotals(currentSub()); return; }
    try {
      const r = await fetch((typeof MM_API !== 'undefined' ? MM_API : '') + '/api/coupon', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ code, items: cartRead().map(i => ({ id: i.id, qty: i.qty })) }) });
      const d = await r.json();
      if (d.ok) { coupon = d; msg.textContent = 'Code applied'; msg.className = 'cd-coupon-msg ok'; }
      else { coupon = null; if (!quiet) { msg.textContent = d.error; msg.className = 'cd-coupon-msg bad'; } }
    } catch { coupon = null; }
    paintTotals(currentSub());
  };
  const cBtn = document.getElementById('cdCouponBtn');
  if (cBtn) cBtn.addEventListener('click', () => applyCoupon(document.getElementById('cdCouponIn').value.trim()));
  /* a code copied from the coupon popup is applied in the bag on its own */
  const autoCode = () => { try { return localStorage.getItem('mm-coupon-auto') || ''; } catch { return ''; } };
  const tryAuto = () => {
    const code = autoCode();
    if (!code || coupon || !cartRead().length) return;
    const inp = document.getElementById('cdCouponIn');
    if (inp && !inp.value) inp.value = code;
    applyCoupon(code, true);
  };

  /* one bag = one order: the photo button and the Instagram button share the
     same order number, so pressing both never records the order twice */
  const ORDER_KEY = 'mm-last-order';
  const bagSignature = (list) => JSON.stringify([list.map(i => [i.id, i.qty]), coupon ? coupon.code : '']);
  /* the order photo and the Instagram button share one order: the photo
     made first is the same order the button then sends. Each tap of the
     button after that (once its 30 seconds are up) is a new order. */
  const ensureOrder = async (list, { send = false } = {}) => {
    const sig = bagSignature(list);
    try {
      const last = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
      const fresh = last && last.sig === sig && Date.now() - (last.at || 0) < 12 * 3600e3;
      if (fresh && !(send && last.sent)) {
        if (send) localStorage.setItem(ORDER_KEY, JSON.stringify({ ...last, sent: true }));
        return last.order;
      }
    } catch {}
    const r = await fetch((typeof MM_API !== 'undefined' ? MM_API : '') + '/api/orders', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ coupon: coupon ? coupon.code : '', items: list.map(i => ({ id: i.id, qty: i.qty })) }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Could not send the order');
    try { localStorage.setItem(ORDER_KEY, JSON.stringify({ sig, order: d, at: Date.now(), sent: send })); } catch {}
    return d;
  };

  /* ---------- one tap per order: the button rests for 30 seconds ---------- */
  /* kept in the browser, so reloading the page does not skip the wait */
  const COOL_KEY = 'mm-order-cool', COOL_MS = 30000;
  let coolTimer = null;
  const coolUntil = () => { try { return Number(localStorage.getItem(COOL_KEY)) || 0; } catch { return 0; } };
  const cooling = () => coolUntil() > Date.now();
  const paintCool = () => {
    const btn = document.getElementById('cdOrder');
    if (!btn) return;
    let wait = document.getElementById('cdWait');
    if (!wait) {
      wait = document.createElement('p');
      wait.id = 'cdWait'; wait.className = 'cd-wait'; wait.setAttribute('aria-live', 'polite');
      btn.insertAdjacentElement('afterend', wait);
    }
    const left = Math.ceil((coolUntil() - Date.now()) / 1000);
    const on = left > 0;
    btn.classList.toggle('is-wait', on);
    btn.setAttribute('aria-disabled', on ? 'true' : 'false');
    wait.hidden = !on;
    if (on) {
      wait.innerHTML = `<span>${window.MM_LANG === 'ar'
        ? `يمكنك إرسال طلب آخر بعد <b>${left}</b> ثانية`
        : `You can place another order in <b>${left}</b>s`}</span><i style="--p:${(left * 1000 / COOL_MS).toFixed(3)}"></i>`;
    }
    clearTimeout(coolTimer);
    if (on) coolTimer = setTimeout(paintCool, 250);
  };
  const startCool = () => { try { localStorage.setItem(COOL_KEY, String(Date.now() + COOL_MS)); } catch {} paintCool(); };
  const stopCool = () => { try { localStorage.removeItem(COOL_KEY); } catch {} paintCool(); };
  paintCool();

  /* what the order photo shows: the bag, the coupon and the total */
  const photoArgs = (list, orderId) => {
    const sub = list.reduce((a, i) => a + i.price * i.qty, 0);
    const disc = coupon ? Math.min(coupon.discount || 0, sub) : 0;
    return [
      list.map(i => ({ name: liveName(i), meta: i.meta, qty: i.qty, price: i.price, img: i.img })),
      { orderId, subtotal: sub, total: sub - disc,
        discountLabel: coupon ? `${coupon.code} · ${coupon.label}` : '',
        discountValue: coupon ? (coupon.type === 'freeship' ? coupon.label : '- ' + money(disc)) : '' }
    ];
  };
  /* the order photo is attached to the order, so its link shows it in the chat */
  const sendOrderPhoto = async (list, d) => {
    if (!window.mmOrderImage || !d.key) return;
    const blob = await window.mmOrderImage(...photoArgs(list, d.id), { blob: true });
    if (!blob) return;
    await fetch((typeof MM_API !== 'undefined' ? MM_API : '') + '/api/orders/' + encodeURIComponent(d.id) + '/photo?key=' + encodeURIComponent(d.key),
      { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    const list = cartRead();
    const err = document.getElementById('cdErr');
    if (!list.length || cooling()) return;       // one tap per order
    startCool();
    err.textContent = '';
    const igWin = window.open('about:blank', '_blank');
    /* the message is ready as soon as the order is saved; the copy is started
       now, while the tap still counts, and filled in then. The order photo is
       made and sent in the background, so Instagram opens straight away. */
    let photo = Promise.resolve();
    const ready = (async () => {
      const d = await ensureOrder(list, { send: true });
      photo = sendOrderPhoto(list, d).catch(ex => console.error(ex));
      const lines = list.map(i => '• ' + i.name + (i.id.includes('::') ? ' (' + i.meta + ')' : '') + ' × ' + i.qty);
      const text = [
        'Hello Maison Meka! I would like to order (' + d.id + '):',
        ...lines,
        d.discount ? 'Discount: -' + money(d.discount) : '',
        'Total: ' + money(d.total),
        d.link ? '\nMy order: ' + d.link : ''
      ].filter(Boolean).join('\n');
      return { d, text };
    })();
    let copying = Promise.resolve(false);
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        copying = navigator.clipboard.write([new ClipboardItem({
          'text/plain': ready.then(r => new Blob([r.text], { type: 'text/plain' }))
        })]).then(() => true, () => false);
      }
    } catch {}
    try {
      const { d, text } = await ready;
      if (!await copying) { try { await navigator.clipboard.writeText(text); } catch {} }
      /* the bag keeps its pieces — the customer may still want its photo */
      const note = document.querySelector('.cd-note');
      if (note) note.textContent = `Order ${d.id} sent. Its details and photo link are copied — just paste them in our Instagram chat.`;
      const ig = (typeof STORE !== 'undefined' && STORE.instagram) || 'https://www.instagram.com/maisonmeka2';
      if (igWin) igWin.location = ig;
      else { await Promise.race([photo, new Promise(r => setTimeout(r, 2500))]); location.href = ig; }
    } catch (ex) {
      if (igWin) igWin.close();
      stopCool();                                  // nothing was sent — they may try again
      err.textContent = ex.message;
    }
  };
  const shotBtn = document.getElementById('cdShot');
  if (shotBtn) shotBtn.addEventListener('click', async () => {
    const list = cartRead();
    if (!list.length || !window.mmOrderImage) return;
    const label = shotBtn.querySelector('span'), was = label.textContent;
    label.textContent = '…'; shotBtn.disabled = true;
    try {
      /* the order is recorded first, so its number is printed on the photo */
      let orderId = '';
      try { orderId = (await ensureOrder(list)).id; } catch (e) { console.error(e); }
      await window.mmOrderImage(...photoArgs(list, orderId));
    } catch (e) { console.error(e); }
    label.textContent = was; shotBtn.disabled = false;
  });

  const orderLink = document.getElementById('cdOrder');
  if (orderLink) orderLink.addEventListener('click', placeOrder);

  const drawCart = () => {
    const list = cartRead();
    const pieces = list.reduce((s, i) => s + i.qty, 0);
    const sub    = list.reduce((s, i) => s + i.price * i.qty, 0);

    cdItems.innerHTML = list.map(itemHTML).join('');
    document.getElementById('cdCount').textContent    = pieces;
    paintTotals(sub);
    if (coupon) applyCoupon(coupon.code, true);
    else if (typeof tryAuto === 'function') tryAuto();

    const bare = list.length === 0;
    cdEmpty.classList.toggle('show', bare);
    cdItems.style.display = bare ? 'none' : '';
    cdFoot.style.display  = bare ? 'none' : '';

    // the header badge follows the bag
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      badge.textContent = pieces;
      badge.style.display = pieces ? '' : 'none';
    }
  };

  const setCart = (open) => {
    cartDrawer.classList.toggle('open', open);
    cartOverlay.classList.toggle('open', open);
    lockScroll();
  };

  /* ---------- the piece flies into the bag ---------- */
  /* the card's photo lifts off in 3D, spins along an arc with a light trail
     and lands in the bag icon, which catches it with a bounce and a burst.
     It starts from whatever was just tapped: the card's photo, or the
     product page's photo, or the button itself. */
  let lastTap = null, lastTapAt = 0;
  document.addEventListener('pointerdown', (e) => { lastTap = e.target; lastTapAt = Date.now(); }, true);
  document.addEventListener('click', (e) => { lastTap = e.target; lastTapAt = Date.now(); }, true);

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const bagTarget = () => [...document.querySelectorAll('#cartBtn, .cart-btn, [data-bag-target]')].find(visible);
  const sourceOf = (tap) => {
    if (!tap || !tap.closest) return null;
    const card = tap.closest('.pc, .bsc, .rc, .sp-card, .wl-card');
    const img = card
      ? card.querySelector('.mm-sq-img, .wlc-shot img, img')
      : (tap.closest('#pdAdd, #barAdd, .pp-buy, .pp-bar') && (document.querySelector('.pp-slide.on img') || document.querySelector('.pp-slide img')));
    if (visible(img)) return img;
    const btn = tap.closest('button, a');
    return visible(btn) ? btn : null;
  };

  const flyToBag = (from) => {
    const bag = bagTarget();
    if (!from || !bag) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const fr = from.getBoundingClientRect(), br = bag.getBoundingClientRect();
    const size = Math.max(70, Math.min(220, Math.max(fr.width, fr.height)));
    const sx = fr.left + fr.width / 2, sy = fr.top + fr.height / 2;
    const ex = br.left + br.width / 2, ey = br.top + br.height / 2;
    const dx = ex - sx, dy = ey - sy;
    const lift = Math.min(180, Math.max(90, Math.abs(dx) * 0.35 + 60));   // height of the arc
    /* the top of the arc stays on screen, even for a card near the top */
    const apexY = Math.max(size * 0.34 + 6, Math.min(sy, ey) - lift) - sy;
    const dur = Math.round(Math.min(1250, Math.max(900, Math.hypot(dx, dy) * 1.1)));
    const src = from.tagName === 'IMG' ? (from.currentSrc || from.src) : '';

    const make = (ghost) => {
      /* x travels steadily, y rises then dives, the card itself turns in 3D */
      const x = document.createElement('div');
      x.className = 'fly-x';
      x.style.cssText = `left:${sx - size / 2}px;top:${sy - size / 2}px;width:${size}px;height:${size}px`;
      const y = document.createElement('div'); y.className = 'fly-y';
      const card = document.createElement('div');
      card.className = 'fly-card' + (ghost ? ' ghost' : '') + (src ? '' : ' no-img');
      if (src) {
        const im = document.createElement('img'); im.src = src; im.alt = '';
        card.appendChild(im);
        card.appendChild(Object.assign(document.createElement('span'), { className: 'fly-shine' }));
      }
      y.appendChild(card); x.appendChild(y); document.body.appendChild(x);
      return { x, y, card };
    };
    const run = (f, delay, ghost) => {
      const opt = { duration: dur, delay, fill: 'both' };
      f.x.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }],
        { ...opt, easing: 'cubic-bezier(.55,.05,.45,1)' });
      f.y.animate([
        { transform: 'translateY(0)', offset: 0 },
        { transform: `translateY(${apexY}px)`, offset: 0.42, easing: 'cubic-bezier(.3,0,.7,1)' },
        { transform: `translateY(${dy}px)`, offset: 1 }
      ], { ...opt, easing: 'cubic-bezier(.33,.1,.5,1)' });
      const a = f.card.animate([
        { transform: 'perspective(700px) rotateX(0) rotateY(0) rotateZ(0) scale(1)', borderRadius: '14px', opacity: ghost ? 0 : 1, filter: 'brightness(1)' },
        { transform: 'perspective(700px) rotateX(18deg) rotateY(-22deg) rotateZ(-4deg) scale(1.12)', borderRadius: '16px', opacity: ghost ? .35 : 1, filter: 'brightness(1.12)', offset: 0.16 },
        { transform: 'perspective(700px) rotateX(-10deg) rotateY(200deg) rotateZ(8deg) scale(.62)', borderRadius: '30%', opacity: ghost ? .22 : 1, filter: 'brightness(1.05)', offset: 0.6 },
        { transform: 'perspective(700px) rotateX(0) rotateY(360deg) rotateZ(0) scale(.1)', borderRadius: '50%', opacity: ghost ? 0 : .9, filter: 'brightness(1.3)' }
      ], { ...opt, easing: 'cubic-bezier(.45,0,.3,1)' });
      a.onfinish = () => f.x.remove();
      return a;
    };

    /* the photo on the card gives a small nod as its copy leaves */
    (from.closest('.mm-sq, .wlc-shot, .pp-slide') || from).animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.95)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });

    /* two fading ghosts behind the piece make the trail */
    [130, 65].forEach(d => run(make(true), d, true));
    const main = run(make(false), 0, false);
    main.finished.then(() => land(bag, ex, ey)).catch(() => {});
    return true;
  };

  const land = (bag, ex, ey) => {
    bag.animate([
      { transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.32) rotate(-12deg)', offset: 0.25 },
      { transform: 'scale(.9) rotate(9deg)', offset: 0.5 }, { transform: 'scale(1.08) rotate(-4deg)', offset: 0.72 },
      { transform: 'scale(1) rotate(0)' }
    ], { duration: 650, easing: 'cubic-bezier(.3,.7,.4,1)' });
    const ring = document.createElement('span');
    ring.className = 'fly-ring'; ring.style.left = ex + 'px'; ring.style.top = ey + 'px';
    document.body.appendChild(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => ring.remove();
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span');
      s.className = 'fly-spark' + (i % 3 ? '' : ' alt');
      s.style.left = ex + 'px'; s.style.top = ey + 'px';
      document.body.appendChild(s);
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.4, dist = 26 + Math.random() * 26;
      s.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`, opacity: 0 }
      ], { duration: 560 + Math.random() * 240, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => s.remove();
    }
    const badge = document.querySelector('.cart-badge');
    if (badge) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
  };

  /* any page can send a piece flying, e.g. the wishlist */
  window.mmFlyToBag = (from) => flyToBag(from || sourceOf(lastTap));

  /* the shop pages put pieces in the bag through this — the drawer stays
     the one owner of the stored cart */
  window.mmCart = {
    add(item, qty = 1) {
      const list = cartRead();
      const have = list.find(i => i.id === item.id);
      if (have) have.qty += qty;
      else list.push({ ...item, qty });
      cartWrite(list);
      drawCart();
      /* "Buy now" opens the bag straight away, so nothing flies */
      const tapped = Date.now() - lastTapAt < 1500 && lastTap && !(lastTap.closest && lastTap.closest('#pdNow'));
      if (tapped && flyToBag(sourceOf(lastTap))) return;
      const badge = document.querySelector('.cart-badge');
      if (badge) {
        badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
      }
    },
    open() { setMenu(false); drawCart(); setCart(true); }
  };

  drawCart();
  // opening the bag closes the menu, so the two never sit open together
  cartBtn.addEventListener('click', () => { setMenu(false); drawCart(); setCart(true); });
  cartOverlay.addEventListener('click', () => setCart(false));
  cartClose.addEventListener('click', () => setCart(false));

  cdItems.addEventListener('click', (e) => {
    const row = e.target.closest('.cd-item');
    if (!row) return;
    const id   = row.dataset.id;
    const list = cartRead();
    const item = list.find(i => i.id === id);
    if (!item) return;

    if (e.target.closest('.cdi-drop')) {
      row.classList.add('leaving');
      cartWrite(list.filter(i => i.id !== id));
      setTimeout(drawCart, 420);
      return;
    }

    const step = e.target.closest('.cdi-step');
    if (step) {
      item.qty += Number(step.dataset.step);
      if (item.qty < 1) {
        row.classList.add('leaving');
        cartWrite(list.filter(i => i.id !== id));
        setTimeout(drawCart, 420);
      } else {
        cartWrite(list);
        // only the two figures change, so the row is not redrawn under the cursor
        row.querySelector('.cdi-num').textContent   = item.qty;
        row.querySelector('.cdi-price').textContent = money(item.price * item.qty);
        const pieces = list.reduce((s, i) => s + i.qty, 0);
        const sub    = list.reduce((s, i) => s + i.price * i.qty, 0);
        document.getElementById('cdCount').textContent    = pieces;
        paintTotals(sub);
        const badge = document.querySelector('.cart-badge');
        if (badge) badge.textContent = pieces;
      }
    }
  });

  /* Escape closes whichever drawer is open */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setMenu(false);
    setCart(false);
  });

  /* ---------- Reveal engine ----------
     Every element is watched on its own and rises the moment IT reaches the
     viewport — so a tall grid never sits pre-arranged while you scroll to it.
     Pieces that cross the line together are fanned out by a short stagger. */

  const STEP = 105;   // gap between pieces that arrive in the same wave
  const CAP  = 6;     // never delay a piece by more than this many steps

  const CONTENT = [
    '.fade-up', '.reveal',
    '.cat-card', '.prod-card', '.ig-tile',
    '.feature', '.foot-col', '.insta-phone', '.rev-stage'
  ].join(', ');

  const prep = (el) => {
    el.classList.add('fade-up');
    el.style.transitionDelay = '0s';   // paced here, not by the CSS stagger
    // once it has landed, hand the transform back for hover effects
    el.addEventListener('transitionend', e => {
      if (e.propertyName === 'transform') el.classList.add('settled');
    }, { once: true });
  };

  // everything outside the hero animates on scroll
  const watched = [...document.querySelectorAll(CONTENT)]
    .filter(el => !el.closest('.hero'));
  watched.forEach(prep);

  /* ---------- Hero: the room lands first, then the type ---------- */
  /* while the intro film plays, the hero waits so its entrance is seen */
  const startHero = () => requestAnimationFrame(() => {
    const items = [...document.querySelectorAll('.hero .reveal')];
    items.forEach(el => { el.style.transitionDelay = '0s'; });
    items.forEach((el, i) => {
      setTimeout(() => el.classList.add('in'), 420 + i * 130);
    });
  });
  if (document.documentElement.classList.contains('intro-on') && !window.mmIntroDone) {
    window.addEventListener('mm-intro-done', startHero, { once: true });
  } else startHero();

  /* ---------- Each piece, as it comes into view ---------- */
  let wave = [];        // pieces that crossed the line in this frame
  let flush = null;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      wave.push(entry.target);
    });
    if (!wave.length || flush) return;

    // let the batch settle for a frame, then fan it out in document order
    flush = requestAnimationFrame(() => {
      const batch = wave.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      batch.forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), Math.min(i, CAP) * STEP);
      });
      wave = [];
      flush = null;
    });
    // triggers once a piece is genuinely on screen, not when its section starts
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  watched.forEach(el => io.observe(el));
  window.mmReveal = (els) => [...els].forEach(el => { prep(el); io.observe(el); });

  /* ---------- Hero kicker: the lit pane steps from word to word ---------- */
  const chips = [...document.querySelectorAll('.kicker-chips .chip')];
  if (chips.length) {
    let lit = 0;
    const step = () => {
      chips.forEach((c, i) => c.classList.toggle('lit', i === lit));
      lit = (lit + 1) % chips.length;
    };
    // starts once the kicker itself has arrived
    setTimeout(() => { step(); setInterval(step, 2200); }, 1400);
  }

  /* ---------- Reviews carousel ----------
     Three cards are on stage at a time: the middle one is the focus, the two
     beside it sit back. Clicking a side card, or a dot, moves the focus. */
  const track = document.getElementById('revTrack');
  if (track) {
    const cards = [...track.querySelectorAll('.rev-card')];
    const dots  = document.getElementById('revDots');
    let current = 0;

    cards.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'rev-dot';
      dot.addEventListener('click', () => show(i));
      dots.appendChild(dot);
    });
    const dotEls = [...dots.children];

    const mod = (n) => (n + cards.length) % cards.length;

    function show(i) {
      current = mod(i);
      const trio = [mod(current - 1), current, mod(current + 1)];

      cards.forEach((card, idx) => {
        card.classList.toggle('on-stage', trio.includes(idx));
        card.classList.toggle('is-active', idx === current);
      });
      dotEls.forEach((d, idx) => d.classList.toggle('is-on', idx === current));
    }

    // a click on either flanking card brings it to the middle
    cards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        if (idx !== current) show(idx);
      });
    });

    show(0);

    let timer = setInterval(() => show(current + 1), 5200);
    track.addEventListener('mouseenter', () => clearInterval(timer));
    track.addEventListener('mouseleave', () => {
      timer = setInterval(() => show(current + 1), 5200);
    });
  }

});
