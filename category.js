// ===================== Maison Meka — category page ===================== //

document.addEventListener('DOMContentLoaded', () => MM_READY.then(() => {

  const $ = (id) => document.getElementById(id);
  const MATERIALS = ['Glass', 'Ceramic', 'Porcelain', 'Metal', 'Wood'];
  const STEP = 500;
  const PRICE_TOP = Math.max(1000, Math.ceil(Math.max(0, ...PRODUCTS.map(p => p.price)) / 1000) * 1000);

  /* ---------- what the shopper has chosen ---------- */
  const fromUrl = new URLSearchParams(location.search).get('c');
  const state = {
    cat:   MM.catBy(fromUrl) ? fromUrl : 'all',
    min:   0,
    max:   PRICE_TOP,
    mats:  new Set(),
    stock: false,
    sort:  'featured',
    view:  '3'
  };
  // the chosen grid size is a per-visitor convenience, so it is remembered
  try { const v = localStorage.getItem('mm-grid-view'); if (v) state.view = v; } catch {}

  const inCat = (p, slug) => slug === 'all' || p.cats.includes(slug);
  const catOf = (slug) => slug === 'all' ? ALL_CATEGORY : MM.catBy(slug);

  /* ===================== hero ===================== */
  const hero = $('chHero');
  const paintHero = (animate) => {
    const c = catOf(state.cat);
    const idx = CATEGORIES.findIndex(x => x.slug === c.slug);
    const write = () => {
      $('chTitle').textContent = c.name;
      $('chCrumb').textContent = c.name;
      $('chDesc').textContent  = c.desc;
      $('chKicker').textContent = idx >= 0
        ? `Collection ${String(idx + 1).padStart(2, '0')} / ${CATEGORIES.length}`
        : 'Maison Meka · Home Art';
      $('chImg').src = c.banner || c.img; $('chImg').alt = c.name;
      document.title = `${c.name} | Maison Meka`;
    };
    if (!animate) { write(); return; }
    hero.classList.add('swap');
    setTimeout(() => { write(); hero.classList.remove('swap'); }, 420);
  };

  /* ===================== category strip ===================== */
  const track = $('catsTrack');
  const allThumbs = CATEGORIES.slice(0, 4)
    .map(c => `<i style="background-image:url('${c.img}')"></i>`).join('');
  track.innerHTML =
    `<a href="category.html" class="cat-chip" data-cat="all"><span class="cat-chip-all">${allThumbs}</span>All Pieces</a>` +
    CATEGORIES.map(c =>
      `<a href="category.html?c=${c.slug}" class="cat-chip" data-cat="${c.slug}">
         <img ${MM.imgAttrs(c.img, '96px')} alt="" loading="lazy" decoding="async">${MM.esc(c.name)}
       </a>`).join('');
  const chips = [...track.querySelectorAll('.cat-chip')];

  const markChip = (smooth) => {
    chips.forEach(ch => ch.classList.toggle('on', ch.dataset.cat === state.cat));
    const on = track.querySelector('.cat-chip.on');
    if (on) {
      // centre the active chip without moving the page itself
      const left = on.offsetLeft - (track.clientWidth - on.offsetWidth) / 2;
      track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const prev = $('catsPrev'), next = $('catsNext');
  const syncArrows = () => {
    prev.hidden = track.scrollLeft < 8;
    next.hidden = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * .7, behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left:  track.clientWidth * .7, behavior: 'smooth' }));
  track.addEventListener('scroll', syncArrows, { passive: true });
  window.addEventListener('resize', syncArrows);

  /* switching category happens in place — the hero changes its photograph
     and the grid redraws, while the address bar keeps up for sharing */
  const goCat = (slug, push = true) => {
    if (slug === state.cat) return;
    state.cat = slug;
    if (push) history.pushState({ cat: slug }, '', slug === 'all' ? 'category.html' : `category.html?c=${slug}`);
    paintHero(true);
    markChip(true);
    render(true);
  };
  track.addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    e.preventDefault();
    goCat(chip.dataset.cat);
  });
  window.addEventListener('popstate', () => {
    const c = new URLSearchParams(location.search).get('c');
    goCat(MM.catBy(c) ? c : 'all', false);
  });

  /* ===================== filters ===================== */
  const tick = '<span class="flt-box"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17.5 19 7"/></svg></span>';

  // category list in the panel mirrors the strip, with real counts
  const fltCats = $('fltCats');
  const drawFltCats = () => {
    const rows = [ALL_CATEGORY, ...CATEGORIES].map(c => {
      const n = PRODUCTS.filter(p => inCat(p, c.slug)).length;
      const label = c.slug === 'all' ? 'All Pieces' : c.name;
      return `<li><button class="flt-opt${c.slug === state.cat ? ' on' : ''}" data-cat="${c.slug}">${tick}${MM.esc(label)} <em>${n}</em></button></li>`;
    });
    fltCats.innerHTML = rows.join('');
  };
  fltCats.addEventListener('click', (e) => {
    const b = e.target.closest('.flt-opt');
    if (b) goCat(b.dataset.cat);
  });

  // materials
  const fltMats = $('fltMats');
  fltMats.innerHTML = MATERIALS.map(m => {
    const n = PRODUCTS.filter(p => p.material === m).length;
    return `<li><button class="flt-opt" data-mat="${m}" aria-pressed="false">${tick}${m} <em>${n}</em></button></li>`;
  }).join('');
  fltMats.addEventListener('click', (e) => {
    const b = e.target.closest('.flt-opt');
    if (!b) return;
    const m = b.dataset.mat;
    state.mats.has(m) ? state.mats.delete(m) : state.mats.add(m);
    render();
  });

  // availability
  const fltStock = $('fltStock');
  $('stockCount').textContent = PRODUCTS.filter(p => p.stock).length;
  fltStock.addEventListener('click', () => { state.stock = !state.stock; render(); });

  // price — two thumbs on one rail
  const pMin = $('priceMin'), pMax = $('priceMax');
  [pMin, pMax].forEach(r => { r.min = 0; r.max = PRICE_TOP; r.step = STEP; });
  pMin.value = state.min; pMax.value = state.max;
  const paintPrice = () => {
    const a = (state.min / PRICE_TOP) * 100, b = (state.max / PRICE_TOP) * 100;
    $('priceFill').style.left = a + '%';
    $('priceFill').style.width = (b - a) + '%';
    $('priceMinTx').textContent = MM.money(state.min);
    $('priceMaxTx').textContent = MM.money(state.max);
  };
  let priceTimer;
  const onPrice = (which) => {
    let lo = Number(pMin.value), hi = Number(pMax.value);
    if (lo > hi - STEP) {
      if (which === 'min') { lo = hi - STEP; pMin.value = lo; }
      else { hi = lo + STEP; pMax.value = hi; }
    }
    state.min = lo; state.max = hi;
    paintPrice();
    // the grid waits until the thumb rests, so dragging stays smooth
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => render(), 160);
  };
  pMin.addEventListener('input', () => onPrice('min'));
  pMax.addEventListener('input', () => onPrice('max'));
  // whichever thumb is nearer the pointer sits on top, so neither gets trapped
  const rail = pMin.parentElement;
  rail.addEventListener('pointerdown', (e) => {
    const r = rail.getBoundingClientRect();
    const v = ((e.clientX - r.left) / r.width) * PRICE_TOP;
    const nearMin = Math.abs(v - state.min) <= Math.abs(v - state.max);
    pMin.style.zIndex = nearMin ? 3 : 2;
    pMax.style.zIndex = nearMin ? 2 : 3;
  });

  // groups fold open and shut
  document.querySelectorAll('.flt-gh').forEach(h => h.addEventListener('click', () => {
    const g = h.closest('.flt-group');
    const shut = g.classList.toggle('shut');
    h.setAttribute('aria-expanded', String(!shut));
  }));

  const clearAll = () => {
    state.min = 0; state.max = PRICE_TOP;
    pMin.value = 0; pMax.value = PRICE_TOP;
    state.mats.clear(); state.stock = false;
    paintPrice();
    render();
  };
  $('fltClear').addEventListener('click', clearAll);
  $('emptyClear').addEventListener('click', clearAll);

  /* ---------- the filter sheet on phones ---------- */
  const flt = $('flt'), fltOverlay = $('fltOverlay');
  const setSheet = (open) => {
    flt.classList.toggle('open', open);
    fltOverlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  $('tbFilter').addEventListener('click', () => setSheet(true));
  $('mFab').addEventListener('click', () => setSheet(true));
  $('fltClose').addEventListener('click', () => setSheet(false));
  $('fltApply').addEventListener('click', () => {
    setSheet(false);
    $('shop').scrollIntoView({ behavior: 'smooth' });
  });
  fltOverlay.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSheet(false); });

  // the sheet can be pulled down by its top edge to close it
  let dragY = null;
  flt.addEventListener('touchstart', (e) => {
    if (!flt.classList.contains('open')) return;
    const body = flt.querySelector('.flt-body');
    if (body.contains(e.target) && body.scrollTop > 0) return;
    dragY = e.touches[0].clientY;
  }, { passive: true });
  flt.addEventListener('touchmove', (e) => {
    if (dragY == null) return;
    const d = e.touches[0].clientY - dragY;
    if (d > 0) { flt.style.transition = 'none'; flt.style.transform = `translateY(${d}px)`; }
  }, { passive: true });
  flt.addEventListener('touchend', (e) => {
    if (dragY == null) return;
    const d = e.changedTouches[0].clientY - dragY;
    flt.style.transition = ''; flt.style.transform = '';
    if (d > 90) setSheet(false);
    dragY = null;
  });

  /* ===================== toolbar ===================== */
  const sort = $('tbSort');
  sort.addEventListener('change', () => { state.sort = sort.value; render(true); });

  const grid = $('grid');
  const viewBtns = [...document.querySelectorAll('.tb-view button')];
  const setView = (v) => {
    state.view = v;
    grid.dataset.view = v;
    viewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === v));
    try { localStorage.setItem('mm-grid-view', v); } catch {}
  };
  viewBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  // a phone has no three-up grid, and a laptop has no single column
  const fitView = () => {
    const phone = matchMedia('(max-width:640px)').matches;
    if (phone && state.view === '2') setView('3');
    else if (!phone && state.view === '1') setView('3');
    else setView(state.view);
  };
  fitView();
  matchMedia('(max-width:640px)').addEventListener('change', fitView);

  /* ===================== the grid ===================== */
  MM.wireCards(grid);

  const pick = () => {
    let list = PRODUCTS.filter(p =>
      p.price >= state.min && p.price <= state.max &&
      (!state.mats.size || state.mats.has(p.material)) &&
      (!state.stock || p.stock)
    );

    let own = list.filter(p => inCat(p, state.cat));
    // a category keeps the order it was given in the dashboard
    const cat = MM.catBy(state.cat);
    if (cat && cat.productOrder && cat.productOrder.length) {
      const pos = new Map(cat.productOrder.map((id, i) => [id, i]));
      own = [...own].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6) - (pos.has(b.id) ? pos.get(b.id) : 1e6));
    }
    // a category shows only its own pieces
    list = own;

    const cmp = {
      new:  (a, b) => b.added - a.added,
      low:  (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name)
    }[state.sort];
    if (cmp) list = [...list].sort(cmp);
    return list;
  };

  const drawActive = () => {
    const tags = [];
    if (state.min > 0 || state.max < PRICE_TOP)
      tags.push({ k: 'price', t: `${MM.money(state.min)} – ${MM.money(state.max)}` });
    state.mats.forEach(m => tags.push({ k: 'mat', v: m, t: m }));
    if (state.stock) tags.push({ k: 'stock', t: 'In Stock' });

    $('act').innerHTML = tags.map(x =>
      `<button data-k="${x.k}" data-v="${x.v || ''}">${MM.esc(x.t)}<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>`
    ).join('');
    const n = tags.length;
    $('tbFilterN').textContent = n;
    $('tbFilterN').classList.toggle('show', n > 0);
  };
  $('act').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k === 'price') { state.min = 0; state.max = PRICE_TOP; pMin.value = 0; pMax.value = PRICE_TOP; paintPrice(); }
    if (b.dataset.k === 'mat') state.mats.delete(b.dataset.v);
    if (b.dataset.k === 'stock') state.stock = false;
    render();
  });

  const render = (fade) => {
    const list = pick();

    /* the first cards are drawn at once; the rest follow in batches well
       before the visitor scrolls to them, so the page opens without drawing
       every piece in the collection up front */
    const BATCH = 12;
    const more = (from) => {
      const cards = list.slice(from, from + BATCH);
      if (!cards.length) return;
      grid.insertAdjacentHTML('beforeend', cards.map(MM.cardHTML).join(''));
      const added = [...grid.querySelectorAll('.pc')].slice(from);
      MM.reveal(added);
      if (from + BATCH >= list.length) return;
      const last = added[added.length - 1];
      if (!('IntersectionObserver' in window)) return more(from + BATCH);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (grid.dataset.draw === token) more(from + BATCH);
      }, { rootMargin: '1500px 0px' });
      io.observe(last);
    };
    const token = String(Math.random());
    const draw = () => {
      grid.dataset.draw = token;
      grid.innerHTML = '';
      more(0);
      grid.style.opacity = '';
    };
    if (fade && grid.children.length) {
      grid.style.transition = 'opacity .3s';
      grid.style.opacity = '0';
      setTimeout(draw, 300);
    } else draw();

    const ownCount = PRODUCTS.filter(p => inCat(p, state.cat)).length;
    $('chCount').textContent = ownCount;
    $('chCountWord').textContent = ownCount === 1 ? 'Piece' : 'Pieces';
    $('tbCount').textContent = list.length;
    $('tbCountWord').textContent = list.length === 1 ? 'Piece' : 'Pieces';
    $('applyCount').textContent = list.length;
    $('empty').classList.toggle('show', list.length === 0);

    // panel state
    drawFltCats();
    fltMats.querySelectorAll('.flt-opt').forEach(b => {
      const on = state.mats.has(b.dataset.mat);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    fltStock.classList.toggle('on', state.stock);
    fltStock.setAttribute('aria-pressed', String(state.stock));
    drawActive();
  };

  /* ===================== first paint ===================== */
  paintHero(false);
  paintPrice();
  render();
  requestAnimationFrame(() => { markChip(false); syncArrows(); });

  // the hero assembles itself, piece by piece
  document.querySelectorAll('.ch-in').forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), 250 + i * 120);
  });

  /* ---------- the floating filter pill shows only over the grid ---------- */
  const fab = $('mFab');
  const shop = $('shop');
  const fabCheck = () => {
    const r = shop.getBoundingClientRect();
    const show = r.top < window.innerHeight * .5 && r.bottom > window.innerHeight * .8;
    fab.classList.toggle('show', show);
    document.body.classList.toggle('fab-on', show && matchMedia('(max-width:900px)').matches);
  };
  window.addEventListener('scroll', fabCheck, { passive: true });
  window.addEventListener('resize', fabCheck);
  fabCheck();
}));
