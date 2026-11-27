// ===================== Maison Meka — product page ===================== //

document.addEventListener('DOMContentLoaded', () => MM_READY.then(() => {

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  const p = MM.byId(id);
  /* a hidden or removed product is not shown — the visitor goes to the shop */
  if (!p) { location.replace('category.html'); return; }
  const cat = MM.homeCat(p);
  /* the photos on show — all of them, or only the chosen colour's */
  let imgs = p.imgs, smalls = p.thumbs || p.imgs;
  const two = (n) => String(n).padStart(2, '0');

  /* ===================== details ===================== */
  document.title = (p.seo && p.seo.title) || `${p.name} | Maison Meka`;
  if (p.seo && p.seo.description) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = p.seo.description;
  }
  /* search engines: this piece's own address, preview and product details */
  {
    const url = `https://maisonmeka.com/product.html?id=${encodeURIComponent(p.id)}`;
    const plain = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const desc = (p.seo && p.seo.description) || plain(p.shortDesc) || plain(p.desc).slice(0, 160) || `${p.name} — a curated piece from Maison Meka.`;
    const abs = (u) => /^https?:/.test(u) ? u : `https://maisonmeka.com/${String(u).replace(/^\//, '')}`;
    const tag = (sel, make, val) => { let el = document.head.querySelector(sel); if (!el) { el = make(); document.head.appendChild(el); } el.setAttribute(sel.includes('link') ? 'href' : 'content', val); };
    const meta = (attr, key) => () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; };
    tag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, url);
    tag('meta[name="description"]', meta('name', 'description'), desc);
    tag('meta[property="og:title"]', meta('property', 'og:title'), document.title);
    tag('meta[property="og:description"]', meta('property', 'og:description'), desc);
    tag('meta[property="og:url"]', meta('property', 'og:url'), url);
    tag('meta[property="og:type"]', meta('property', 'og:type'), 'product');
    if (p.imgs[0]) { tag('meta[property="og:image"]', meta('property', 'og:image'), abs(p.imgs[0])); tag('meta[name="twitter:image"]', meta('name', 'twitter:image'), abs(p.imgs[0])); }
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Product', name: p.name, description: desc, image: p.imgs.slice(0, 6).map(abs), sku: String(p.id),
          brand: { '@type': 'Brand', name: 'Maison Meka' }, category: cat ? cat.name : undefined, material: p.material || undefined,
          offers: { '@type': 'Offer', url, priceCurrency: 'EGP', price: Number(p.price) || 0,
            availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'Maison Meka' },
            shippingDetails: { '@type': 'OfferShippingDetails', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'EG' } } } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://maisonmeka.com/' },
          ...(cat ? [{ '@type': 'ListItem', position: 2, name: cat.name, item: `https://maisonmeka.com/category.html?c=${cat.slug}` }] : []),
          { '@type': 'ListItem', position: cat ? 3 : 2, name: p.name, item: url }] }
      ]
    });
    document.head.appendChild(ld);
  }
  $('pdTitle').textContent = p.name;
  $('pdCrumbName').textContent = p.name;
  $('pdBadge').textContent = p.badge || '';
  $('pdDesc').innerHTML    = MM.safeHTML(p.desc);
  $('pdSize').textContent  = p.size || '';
  $('pdSizeRow').hidden    = !p.size;
  $('pdDims').textContent  = p.dims || '—';
  $('pdMat').textContent   = p.material || '—';
  if (cat) {
    $('pdCatLink').textContent = cat.name;
    $('pdCatLink').href = `category.html?c=${cat.slug}`;
    $('relAll').href = `category.html?c=${cat.slug}`;
  }

  /* ---------- variants: colours and sizes, each with its own price + stock ---------- */
  const pick = { color: p.colors[0] || null, size: p.sizes[0] || null };
  const current = () => {
    const parts = [pick.color, pick.size].filter(Boolean);
    const priced = pick.size || pick.color;
    return {
      label: parts.map(v => v.name).join(' / '),
      display: parts.map(v => v.label || v.name).join(' / '),
      price: priced ? priced.price : p.price,
      compareAt: priced ? (priced.compareAt > priced.price ? priced.compareAt : 0) : p.compareAt,
      stock: parts.length ? parts.every(v => v.stock) : p.stock
    };
  };
  const paintPrice = () => {
    const c = current();
    const off = c.compareAt ? Math.round((1 - c.price / c.compareAt) * 100) : 0;
    $('pdPrice').innerHTML = MM.money(c.price) +
      (c.compareAt ? ` <s>${MM.money(c.compareAt)}</s> <span class="pp-off">-${off}%</span>` : '');
    $('barPrice').textContent = MM.money(c.price);

    // the buttons take the piece's stock colour: green, yellow or red
    const st = !c.stock ? 'out' : (p.low ? 'low' : 'in');
    ['pdAdd', 'barAdd'].forEach(k => {
      $(k).classList.remove('is-in', 'is-low', 'is-out');
      $(k).classList.add('is-' + st);
    });
    $('pdStock').classList.toggle('low', st === 'low');
    $('pdStock').classList.toggle('out', st === 'out');
    $('pdStock').querySelector('span').textContent = MM.STATUS_LABEL[st];
    ['pdAdd', 'pdNow', 'barAdd'].forEach(k => $(k).disabled = st === 'out');
    $('pdAddTx').textContent = st === 'out' ? 'Sold Out' : 'Add to Cart';
  };
  const drawVariants = () => {
    const block = (kind, list, title) => !list.length ? '' : `
      <div class="pp-var">
        <p class="pp-var-t">${title}: <b>${MM.esc(pick[kind].label || pick[kind].name)}</b></p>
        <div class="pp-var-row pp-var-${kind}">
          ${list.map((v, i) => kind === 'color'
            ? `<button class="pp-sw${v === pick[kind] ? ' on' : ''}${v.stock ? '' : ' na'}" data-k="${kind}" data-i="${i}" title="${MM.esc(v.label || v.name)}" style="--sw:${MM.esc(v.hex || '#d8cbb5')}"></button>`
            : `<button class="pp-sz${v === pick[kind] ? ' on' : ''}${v.stock ? '' : ' na'}" data-k="${kind}" data-i="${i}">${MM.esc(v.label || v.name)}</button>`).join('')}
        </div>
      </div>`;
    $('ppVariants').innerHTML = block('color', p.colors, 'Color') + block('size', p.sizes, 'Size');
  };
  $('ppVariants').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    pick[k] = (k === 'color' ? p.colors : p.sizes)[Number(b.dataset.i)];
    drawVariants(); paintPrice();
    if (k === 'color') showColorPhotos();
  });
  drawVariants();
  paintPrice();

  /* ---------- quantity ---------- */
  let qty = 1;
  const paintQty = () => { $('qtyN').textContent = qty; };
  $('qtyDown').addEventListener('click', () => { qty = Math.max(1, qty - 1); paintQty(); });
  $('qtyUp').addEventListener('click',   () => { qty = Math.min(20, qty + 1); paintQty(); });

  /* ---------- the bag ---------- */
  const add = (n, open) => {
    const c = current();
    MM.addToBag(p, n, c.label ? { label: c.label, display: c.display, price: c.price } : null);
    if (open) { MM.openBag(); return; }
    MM.toast(`${n > 1 ? n + ' × ' : ''}${p.name} added to your bag`, 'VIEW BAG', MM.openBag);
  };
  $('pdAdd').addEventListener('click', () => {
    add(qty, false);
    const b = $('pdAdd');
    b.classList.add('added');
    $('pdAddTx').textContent = 'Added to Cart';
    setTimeout(() => { b.classList.remove('added'); $('pdAddTx').textContent = 'Add to Cart'; }, 1800);
  });
  // "buy it now" goes straight to the bag, where the order button waits
  $('pdNow').addEventListener('click', () => add(qty, true));
  $('barAdd').addEventListener('click', () => add(qty, false));

  /* ---------- wishlist — the heart sits on the photo ---------- */
  const fav = $('pdFav');
  fav.classList.toggle('on', MM.wlHas(p.id));
  fav.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = MM.wlToggle(p);
    fav.classList.toggle('on', on);
    fav.classList.remove('pop'); void fav.offsetWidth; fav.classList.add('pop');
    MM.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist',
             on ? 'VIEW' : '', () => { location.href = 'wishlist.html'; });
  });

  /* ===================== gallery ===================== */
  /* each photo is shown whole: the picture sits on a softened, blown-up
     copy of itself, so any shape of photograph fills the frame cleanly */
  const gal = $('gal');
  const thumbs = $('galThumbs');
  const dots = $('galDots');
  const PLAY = '<span class="pp-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>';
  let media = [], slides = [], cur = 0;
  const drawGallery = () => {
  /* the photos, then the product video when one has been added */
  media = imgs.map((src, i) => ({ type: 'img', src, small: smalls[i] || src }));
  if (p.video) media.push({ type: 'video', src: p.video });
  $('galSlides').innerHTML = media.map((m, i) =>
    `<div class="pp-slide${i === 0 ? ' on' : ''}">${m.type === 'video'
      ? `<video class="pp-slide-img pp-video" src="${MM.esc(m.src)}" controls playsinline preload="metadata"></video>`
      : `<img class="pp-slide-img" ${MM.imgAttrs(m.src, '(max-width:900px) 100vw, 55vw')} alt="${MM.esc(p.name)} — photo ${i + 1}" ${i ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>`}</div>`).join('');
  /* the gallery keeps its reserved shape until the first photo is in; the
     details wait with it, so both appear together in their final place */
  const gal = $('galSlides'), first = gal.querySelector('.pp-slide-img');
  const ready = () => { gal.classList.add('ready'); document.querySelector('.pp').classList.add('ready'); };
  setTimeout(ready, 3000);
  if (!first || first.tagName === 'VIDEO' || first.complete) ready();
  else { first.addEventListener('load', ready, { once: true }); first.addEventListener('error', ready, { once: true }); }
  thumbs.innerHTML = media.map((m, i) =>
    `<button class="pp-thumb${i === 0 ? ' on' : ''}" data-i="${i}" aria-label="${m.type === 'video' ? 'Video' : 'Photo ' + (i + 1)}">${m.type === 'video'
      ? `<video src="${MM.esc(m.src)}#t=0.5" muted playsinline preload="metadata"></video>${PLAY}` : `<img ${MM.imgAttrs(m.small, '120px')} alt="" loading="lazy" decoding="async">`}</button>`).join('');
  dots.innerHTML = media.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('');
  thumbs.hidden = dots.hidden = media.length < 2;
  slides = [...gal.querySelectorAll('.pp-slide')];
  cur = 0;
  $('lb').classList.toggle('single', imgs.length < 2);
  };
  /* a colour with its own photos shows just those; otherwise every photo */
  const showColorPhotos = () => {
    const own = (pick.color && pick.color.imgs) || [];
    const next = own.length ? own.map(i => p.imgs[i]) : p.imgs;
    if (next.join() === imgs.join()) return;
    imgs = next;
    smalls = own.length ? own.map(i => (p.thumbs || p.imgs)[i]) : (p.thumbs || p.imgs);
    drawGallery();
    $('barImg').src = MM.sized(smalls[0] || imgs[0], 160);
  };
  drawGallery();
  const show = (i) => {
    cur = (i + media.length) % media.length;
    slides.forEach((s, k) => s.classList.toggle('on', k === cur));
    gal.querySelectorAll('video').forEach(v => v.pause());
    thumbs.querySelectorAll('.pp-thumb').forEach((t, k) => t.classList.toggle('on', k === cur));
    dots.querySelectorAll('span').forEach((d, k) => d.classList.toggle('on', k === cur));
  };
  thumbs.addEventListener('click', (e) => {
    const t = e.target.closest('.pp-thumb');
    if (t) show(Number(t.dataset.i));
  });

  // swipe between photos on a phone
  let x0 = null, y0 = null, swiped = false;
  gal.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; swiped = false; }, { passive: true });
  gal.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); }
    x0 = null;
  });
  gal.addEventListener('click', (e) => {
    if (e.target.closest('video')) return;
    if (!swiped && cur < imgs.length) openLb(cur);
    swiped = false;
  });

  /* ---------- full-screen viewer ---------- */
  const lb = $('lb');
  let li = 0;
  const lbShow = (i) => {
    li = (i + imgs.length) % imgs.length;
    $('lbImg').src = imgs[li];
    $('lbImg').alt = `${p.name} — photo ${li + 1}`;
    $('lbCount').textContent = `${two(li + 1)} / ${two(imgs.length)}`;
  };
  const openLb = (i) => {
    lbShow(i);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeLb = () => {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    show(li);
  };
  $('lbClose').addEventListener('click', closeLb);
  $('lbPrev').addEventListener('click', (e) => { e.stopPropagation(); lbShow(li - 1); });
  $('lbNext').addEventListener('click', (e) => { e.stopPropagation(); lbShow(li + 1); });
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });

  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('open')) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') lbShow(li + 1);
      if (e.key === 'ArrowLeft') lbShow(li - 1);
      return;
    }
    if (e.key === 'ArrowRight') show(cur + 1);
    if (e.key === 'ArrowLeft') show(cur - 1);
  });

  /* ===================== details accordion ===================== */
  $('accDetails').innerHTML =
    `<ul>${(p.details || []).map(d => `<li>${MM.esc(d)}</li>`).join('')}</ul>`;
  $('accCare').innerHTML =
    `<p><b>${MM.esc(window.MM_T ? MM_T(p.material || '') : (p.material || ''))}.</b> ${MM.esc(p.care || '')}</p>`;

  document.querySelectorAll('.pp-acc-head').forEach(h => h.addEventListener('click', () => {
    const row = h.closest('.pp-acc-row');
    const open = row.classList.toggle('open');
    h.setAttribute('aria-expanded', String(open));
  }));

  /* ===================== you may also like ===================== */
  const others = PRODUCTS.filter(x => x.id !== p.id);
  const near = others.filter(x => x.cats.some(c => p.cats.includes(c)));
  const rel = [...near, ...others.filter(x => !near.includes(x))].slice(0, 5);

  /* the optional product banner sits above "you may also like" */
  if (p.banner) {
    const band = document.createElement('section');
    band.className = 'pp-banner';
    band.innerHTML = `<img ${MM.imgAttrs(p.banner, '100vw')} alt="${MM.esc(p.name)}" loading="lazy" decoding="async">`;
    const rel = document.querySelector('.pp-rel');
    rel.parentNode.insertBefore(band, rel);
  }

  const relGrid = $('relGrid');
  relGrid.innerHTML = rel.map(r => {
    const href = 'product.html?id=' + encodeURIComponent(r.id);
    return `
      <article class="rc" data-id="${MM.esc(r.id)}">
        <a class="rc-shot mm-sq" href="${href}" style="${MM.fitStyle(r)}">${MM.squareImg(r, 'rc-img')}</a>
        <button class="rc-fav${MM.wlHas(r.id) ? ' on' : ''}" aria-label="Save ${MM.esc(r.name)}">${MM.ICON.heart}</button>
        <div class="rc-body">
          <div>
            <h3><a href="${href}">${MM.esc(r.name)}</a></h3>
            <span>${MM.money(r.price)}</span>
          </div>
          <button class="rc-add is-${MM.status(r)}" aria-label="Add ${MM.esc(r.name)} to cart" title="${MM.STATUS_LABEL[MM.status(r)]}" ${r.stock ? '' : 'disabled'}>${MM.ICON.bag}</button>
        </div>
      </article>`;
  }).join('');

  relGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.rc');
    if (!card) return;
    const r = MM.byId(card.dataset.id);
    const favBtn = e.target.closest('.rc-fav');
    if (favBtn) {
      const on = MM.wlToggle(r);
      favBtn.classList.toggle('on', on);
      MM.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist');
      return;
    }
    const addBtn = e.target.closest('.rc-add');
    if (addBtn && !addBtn.disabled) {
      MM.addToBag(r, 1);
      addBtn.classList.add('added');
      setTimeout(() => addBtn.classList.remove('added'), 1200);
      MM.toast(r.name + ' added to your bag', 'VIEW BAG', MM.openBag);
    }
  });

  /* ===================== the sticky bar on phones ===================== */
  showColorPhotos();
  $('barImg').src = MM.sized(smalls[0] || imgs[0], 160);
  $('barName').textContent = p.name;
  const bar = $('pdBar');
  const buy = $('pdBuy');
  const footer = document.querySelector('.site-footer');
  const barCheck = () => {
    if (!matchMedia('(max-width:900px)').matches) {
      bar.classList.remove('show'); document.body.classList.remove('bar-on'); return;
    }
    const passed = buy.getBoundingClientRect().bottom < 0;
    const atFoot = footer && footer.getBoundingClientRect().top < window.innerHeight;
    const on = passed && !atFoot;
    bar.classList.toggle('show', on);
    document.body.classList.toggle('bar-on', on);
  };
  window.addEventListener('scroll', barCheck, { passive: true });
  window.addEventListener('resize', barCheck);
  barCheck();

  /* ===================== reviews: stars + words from visitors ===================== */
  const box = $('ppReviews');
  if (box) {
    const ar = window.MM_LANG === 'ar';
    const T = ar
      ? { title: 'آراء العملاء', none: 'لا توجد تقييمات بعد — كن أول من يكتب رأيه.', write: 'اكتب رأيك', name: 'اسمك', text: 'رأيك في المنتج (اختياري)', send: 'إرسال التقييم', pick: 'اختر عدد النجوم', thanks: 'شكراً! تم نشر تقييمك.', of: 'تقييم', fail: 'تعذّر الإرسال، حاول مرة أخرى.' }
      : { title: 'Customer Reviews', none: 'No reviews yet — be the first to share yours.', write: 'Write a review', name: 'Your name', text: 'Your thoughts on this piece (optional)', send: 'Submit review', pick: 'Choose your stars', thanks: 'Thank you! Your review is live.', of: 'reviews', fail: 'Could not send, please try again.' };
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const star = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
    const stars = (n) => '<span class="rv-stars" aria-label="' + n + '/5">' + [1,2,3,4,5].map(i => '<i class="' + (i <= Math.round(n) ? 'on' : '') + '">' + star + '</i>').join('') + '</span>';
    let list = [];
    box.innerHTML = `
      <div class="rv-head"><h2>${T.title}</h2><div class="rv-sum" id="rvSum"></div></div>
      <div class="rv-wrap">
        <form class="rv-form" id="rvForm" novalidate>
          <span class="rvf-blob b1" aria-hidden="true"></span><span class="rvf-blob b2" aria-hidden="true"></span><span class="rvf-blob b3" aria-hidden="true"></span>
          <span class="rvf-sticker" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><path id="rvfC" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/></defs><text><textPath href="#rvfC">${ar ? '✦ رأيك يهمنا ✦ رأيك يهمنا ' : '✦ YOUR WORDS MATTER ✦ THANK YOU '}</textPath></text></svg><i>✿</i></span>
          <h3>${T.write.split(' ').map((w, k) => `<span class="rvf-w"><span style="--i:${k}">${w}</span></span>`).join(' ')}</h3>
          <p class="rvf-mood" id="rvMood" aria-live="polite"><span class="rvf-face">🙂</span><span class="rvf-word">${T.pick}</span></p>
          <div class="rv-pick" id="rvPick" role="radiogroup" aria-label="${T.pick}">
            ${[1,2,3,4,5].map(i => `<button type="button" data-v="${i}" aria-label="${i}">${star}</button>`).join('')}
          </div>
          <input name="name" maxlength="60" placeholder="${T.name}" required>
          <textarea name="text" maxlength="1000" rows="4" placeholder="${T.text}"></textarea>
          <p class="rv-msg" id="rvMsg"></p>
          <button type="submit" class="rv-send">${T.send}</button>
        </form>
        <div class="rv-list" id="rvList"></div>
      </div>`;
    const draw = () => {
      const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
      $('rvSum').innerHTML = list.length ? `${stars(avg)}<b>${avg.toFixed(1)}</b><span>${list.length} ${T.of}</span>` : '';
      $('rvList').innerHTML = list.length ? list.map(r => `
        <article class="rv-item">
          <div class="rv-top">${stars(r.rating)}<time>${new Date(r.date).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day:'numeric', month:'short', year:'numeric' })}</time></div>
          <h4>${esc(r.name)}</h4>
          ${r.text ? `<p>${esc(r.text)}</p>` : ''}
        </article>`).join('') : `<p class="rv-none">${T.none}</p>`;
    };
    let rating = 0;
    const pick = $('rvPick');
    const MOODS = ar ? [['🙂', T.pick], ['😕','مش أحسن حاجة'], ['😐','كويس'], ['🙂','حلو'], ['😍','جميل جداً'], ['🤩','تحفة!']]
                     : [['🙂', T.pick], ['😕','Not quite'], ['😐',"It's okay"], ['🙂','Lovely'], ['😍','Gorgeous'], ['🤩','Absolutely stunning!']];
    const mood = $('rvMood');
    const paint = (n) => {
      pick.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) <= n));
      const [f, w] = MOODS[n] || MOODS[0];
      if (mood.dataset.n !== String(n)) { mood.dataset.n = n; mood.innerHTML = `<span class="rvf-face">${f}</span><span class="rvf-word">${w}</span>`; }
      $('rvForm').style.setProperty('--hue', n ? (n - 1) * 22 : 0);
    };
    const burst = (el) => {
      const r = el.getBoundingClientRect(), C = ['#ff8a65','#ffd166','#7bdcb5','#b39ddb','#f48fb1','#64b5f6'];
      for (let k = 0; k < 26; k++) {
        const d = document.createElement('i'); d.className = 'rvf-conf';
        d.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${C[k % 6]};--dx:${(Math.random() - .5) * 360}px;--dy:${-80 - Math.random() * 220}px;--rot:${Math.random() * 720}deg`;
        document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
      }
    };
    pick.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { rating = Number(b.dataset.v); paint(rating); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } });
    pick.addEventListener('mouseover', (e) => { const b = e.target.closest('button'); if (b) paint(Number(b.dataset.v)); });
    pick.addEventListener('mouseleave', () => paint(rating));
    const form = $('rvForm'), msg = $('rvMsg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!rating) { msg.textContent = T.pick; return; }
      if (!name) { msg.textContent = T.name; form.name.focus(); return; }
      const btn = form.querySelector('.rv-send'); btn.disabled = true; msg.textContent = '';
      try {
        const r = await fetch(MM_API + '/api/reviews', { method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ product: p.id, name, rating, text: form.text.value.trim() }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        list.unshift(d); draw();
        form.reset(); rating = 0; paint(0);
        msg.textContent = T.thanks; burst(btn);
      } catch (err) { msg.textContent = (err && err.message) || T.fail; }
      btn.disabled = false;
    });
    draw();
    if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { form.classList.add('in'); o.disconnect(); } }, { threshold: .25 }).observe(form);
    else form.classList.add('in');
    form.addEventListener('pointermove', (e) => { const b = form.getBoundingClientRect(); form.style.setProperty('--mx', ((e.clientX - b.left) / b.width * 100) + '%'); form.style.setProperty('--my', ((e.clientY - b.top) / b.height * 100) + '%'); });
    fetch(MM_API + '/api/reviews?product=' + encodeURIComponent(p.id))
      .then(r => r.json()).then(d => { if (Array.isArray(d)) { list = d; draw(); } }).catch(() => {});
  }
}));
