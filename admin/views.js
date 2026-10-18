// ===================== Maison Meka dashboard — pages ===================== //

const S = { data: null, range: '7d', dirty: false, timer: null, ui: {} };
const view = $('#view');

/* ---------- small helpers ---------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] = a[k] ?? {}), o)[last] = v; };
const STATUS = { in: ['In Stock', 'dot-in'], low: ['Low Stock', 'dot-low'], out: ['Out of Stock', 'dot-out'] };
const ORDER_STATES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];
const COUNTED = ['pending', 'confirmed', 'shipped', 'delivered'];
const catName = (slug) => (S.data.categories.find(c => c.slug === slug) || {}).name || slug;
const orderedBy = (list, ids = []) => {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...list].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e9 - (a.added || 0) / 1e13) - (pos.has(b.id) ? pos.get(b.id) : 1e9 - (b.added || 0) / 1e13));
};
const sw = (attrs, on) => `<label class="sw"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><i></i></label>`;
const productTags = (p) => {
  const L = p.labels || {}, t = [];
  if (L.featured) t.push('<span class="tag tag-green">Featured</span>');
  if (L.bestseller) t.push('<span class="tag tag-orange">Bestseller</span>');
  if (p.discount && p.discount.on && p.discount.value) t.push(`<span class="tag tag-red">Sale ${p.discount.type === 'fixed' ? money(p.discount.value) : p.discount.value + '%'}</span>`);
  if (L.newArrival) t.push('<span class="tag tag-red">New</span>');
  if (L.limited) t.push('<span class="tag tag-blue">Limited</span>');
  if (p.active === false) t.push('<span class="tag tag-gray">Hidden</span>');
  return t.join('');
};
/* the computed fields the server adds are not sent back */
const strip = (p) => { const { status, stockTotal, finalPrice, ...rest } = p; return rest; };

const load = async () => { S.data = await api('GET', '/api/admin/state'); UPLOAD_MODE = S.data.settings.uploadMode || 'local'; paintChrome(); };

/* ===================== shell: navigation, bell, routing ===================== */
const NAV = [
  ['dashboard', 'Dashboard', I.home], ['orders', 'Orders', I.orders], ['products', 'Products', I.box],
  ['categories', 'Categories', I.cats], ['customers', 'Customers', I.users], ['coupons', 'Coupons', I.ticket],
  ['offers', 'Sales & Offers', I.tag], ['content', 'Website Content', I.page], ['settings', 'Settings', I.gear]
];
const route = () => {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').map(decodeURIComponent), q: new URLSearchParams(qs || '') };
};
const go = (h) => { location.hash = '#/' + h; };

const paintChrome = () => {
  const { parts } = route();
  const pending = S.data.orders.filter(o => o.status === 'pending').length;
  $('#sideNav').innerHTML = NAV.map(([k, label, ic]) =>
    `<a class="nav-a${parts[0] === k ? ' on' : ''}" href="#/${k}">${ic}<span>${label}</span>${k === 'orders' && pending ? `<b class="nav-n">${pending}</b>` : ''}</a>`).join('');
  const alerts = S.data.products.filter(p => p.status !== 'in' && p.active !== false).length;
  const n = pending + alerts;
  $('#bellDot').hidden = !n;
  $('#bellDot').textContent = n > 9 ? '9+' : n;
};
$('#bell').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('#bellPop');
  if (!pop.hidden) { pop.hidden = true; return; }
  const pend = S.data.orders.filter(o => o.status === 'pending').slice(0, 5);
  const stock = S.data.products.filter(p => p.status !== 'in' && p.active !== false).slice(0, 6);
  pop.innerHTML =
    (pend.length ? '<h4>New orders</h4>' + pend.map(o => `<a class="bell-item" href="#/orders?open=${o.id}"><img src="${site(o.items[0] && o.items[0].img)}" alt=""><div><b>${esc(o.id)} · ${esc(o.name)}</b><small>${money(o.total)} · ${fmtDate(o.date, true)}</small></div></a>`).join('') : '') +
    (stock.length ? '<h4>Stock alerts</h4>' + stock.map(p => `<a class="bell-item" href="#/products/${encodeURIComponent(p.id)}?tab=inventory"><img src="${pthumb(p)}" alt=""><div><b>${esc(p.name)}</b><small class="${STATUS[p.status][1]}">${STATUS[p.status][0]} · ${p.stockTotal} left</small></div></a>`).join('') : '') ||
    '<div class="bell-empty">You are all caught up.</div>';
  pop.hidden = false;
});
document.addEventListener('click', (e) => { if (!e.target.closest('.bell-wrap')) $('#bellPop').hidden = true; });

const setSide = (open) => { $('#side').classList.toggle('open', open); $('#sideScrim').classList.toggle('open', open); };
$('#burger').onclick = () => setSide(true);
$('#sideX').onclick = () => setSide(false);
$('#sideScrim').onclick = () => setSide(false);

let lastHash = location.hash;
const render = async () => {
  if (S.dirty && location.hash !== lastHash) {
    if (!confirm('You have unsaved changes. Leave this page without saving?')) { history.replaceState(null, '', lastHash); return; }
    S.dirty = false;
  }
  lastHash = location.hash;
  clearInterval(S.timer);
  setSide(false);
  $('#bellPop').hidden = true;
  paintChrome();
  const { parts, q } = route();
  const [a, b] = parts;
  window.scrollTo(0, 0);
  try {
    if (a === 'dashboard') return await Dashboard();
    if (a === 'orders') return Orders(q);
    if (a === 'products') return b ? ProductEditor(b, q.get('tab')) : Products(q);
    if (a === 'categories') return b ? CategoryEditor(b) : Categories();
    if (a === 'customers') return Customers();
    if (a === 'coupons') return Coupons();
    if (a === 'offers') return Offers();
    if (a === 'content') return Content();
    if (a === 'settings') return Settings();
    go('dashboard');
  } catch (err) { view.innerHTML = `<div class="empty"><b>Something went wrong</b>${esc(err.message)}</div>`; }
};
window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ===================== Dashboard ===================== */
const Dashboard = async () => {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  view.innerHTML = `
    <div class="hello">
      <div><h1>${hello}, ${esc(S.data.settings.storeName || 'Maison Meka')} 👋</h1><p>Here's what's happening with your store today.</p></div>
      <span class="date-pill">${new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span>
    </div>
    <div class="kpis">
      <div class="kpi kpi-red"><span class="ic">${I.bag}</span><small>Total Revenue</small><b id="kRev">—</b><span class="chg" id="kRevC"></span><small class="muted"> · 30 days</small></div>
      <div class="kpi kpi-yellow"><span class="ic">${I.orders}</span><small>Total Orders</small><b id="kOrd">—</b><span class="chg" id="kOrdC"></span><small class="muted"> · 30 days</small></div>
      <div class="kpi kpi-green"><span class="ic">${I.users}</span><small>Visitors (Today)</small><b id="kVis">—</b><span class="live" id="kLive">Live now</span></div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-h"><h2>Visitors Overview</h2>
        <div class="range" id="range">${[['today', 'Today'], ['7d', '7D'], ['30d', '30D'], ['1y', '1Y']].map(([k, l]) => `<button data-r="${k}" class="${S.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="chart" id="chart"></div>
    </div>
    <div class="grid g2" style="margin-bottom:18px">
      <div class="card"><div class="card-h"><h2>Top Countries</h2></div><div class="countries" id="countries"></div></div>
      <div class="card"><div class="card-h"><h2>Traffic Sources</h2></div><div class="donut-wrap"><div class="donut" id="donut"></div><div class="legend" id="legend"></div></div></div>
    </div>
    <div class="card"><div class="card-h"><h2>Top Products</h2><a class="link" href="#/products">View All</a></div><div id="topP"></div></div>`;

  const paint = async () => {
    const a = await api('GET', '/api/admin/analytics?range=' + S.range);
    const chg = (el, v) => { el.textContent = (v >= 0 ? '↑ ' : '↓ ') + Math.abs(v) + '%'; el.className = 'chg ' + (v >= 0 ? 'up' : 'down'); };
    $('#kRev').textContent = money(a.revenue); chg($('#kRevC'), a.revenueChange);
    $('#kOrd').textContent = num(a.orders); chg($('#kOrdC'), a.ordersChange);
    $('#kVis').textContent = num(a.visitorsToday);
    $('#kLive').textContent = `${a.liveNow} live now`;
    lineChart($('#chart'), a.series);
    $('#countries').innerHTML = a.countries.length ? a.countries.map(c => `
      <div class="ct"><span class="fl">${flag(c.key)}</span><span>${esc(c.name)}<div class="bar"><i style="width:${c.pct}%"></i></div></span><b>${c.pct}%</b></div>`).join('')
      : '<p class="muted">No visits yet.</p>';
    const SRC_NAMES = { instagram:'Instagram', google:'Google', direct:'Direct', tiktok:'TikTok', facebook:'Facebook', whatsapp:'WhatsApp', others:'Others' };
    donut($('#donut'), a.sources);
    $('#legend').innerHTML = a.sources.length ? a.sources.map((s, i) => `<div><i style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></i><span>${SRC_NAMES[s.key] || s.key}</span><b>${s.pct}%</b></div>`).join('') : '<p class="muted">No visits yet.</p>';
    $('#topP').innerHTML = a.topProducts.map((p, i) => `
      <a class="top-p" href="#/products/${encodeURIComponent(p.id)}"><span class="n">${i + 1}</span><img src="${site(p.img)}" alt=""><div><b>${esc(p.name)}</b><small>${p.sales} sales · ${num(p.views)} views</small></div><strong>${money(p.price)}</strong></a>`).join('') || '<p class="muted">No products yet.</p>';
  };
  $('#range').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    S.range = b.dataset.r;
    $$('#range button').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });
  await paint();
  /* the live numbers refresh on their own */
  /* every refresh costs database commands, so: every 5 minutes, only while this tab
     is on screen, and never on the 30-day / 1-year views (they read hundreds of counters) */
  S.timer = setInterval(() => {
    if (document.hidden || route().parts[0] !== 'dashboard') return;
    if (S.range === '30d' || S.range === '1y') return;
    paint().catch(() => {});
  }, 300000);
  let rT; window.onresize = () => { clearTimeout(rT); rT = setTimeout(() => { if (route().parts[0] === 'dashboard') paint(); }, 250); };
};

/* ===================== Products ===================== */
const Products = (q) => {
  const st = S.ui.products = S.ui.products || { q: '', tab: 'all', cat: '', arrange: false, scope: 'all' };
  if (q.get('cat')) st.cat = q.get('cat');
  const P = S.data.products;
  const count = (t) => P.filter(p => t === 'all' || p.status === t).length;

  view.innerHTML = `
    <div class="ph"><div><h1>Products</h1><p>${P.length} products in your store</p></div>
      <div class="ph-actions">
        <button class="btn" id="arrBtn">${I.sort} Arrange order</button>
        <a class="btn btn-green" href="#/products/new">${I.plus} Add Product</a>
      </div></div>
    <div id="pBody"></div>`;

  const drawList = () => {
    const list = P.filter(p =>
      (st.tab === 'all' || p.status === st.tab) &&
      (!st.cat || (p.cats || []).includes(st.cat)) &&
      (!st.q || (p.name + ' ' + (p.sku || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(st.q.toLowerCase())));
    const shown = orderedBy(list, S.data.order.all);
    $('#pBody').innerHTML = `
      <div class="toolbar">
        <label class="search">${I.search}<input id="pq" placeholder="Search products…" value="${esc(st.q)}"></label>
        <select class="sel" id="pcat"><option value="">All categories</option>${S.data.categories.map(c => `<option value="${esc(c.slug)}" ${st.cat === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      </div>
      <div class="tabs" id="ptabs">${[['all', 'All'], ['in', 'In Stock'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([k, l]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l} (${count(k)})</button>`).join('')}</div>
      <div class="list" id="plist">${shown.length ? shown.map(p => `
        <div class="li click" data-id="${esc(p.id)}">
          <img class="li-img" src="${pthumb(p)}" alt="" loading="lazy">
          <div class="li-body">
            <div class="li-t">${esc(p.name)}</div>
            <div class="li-price">${money(p.finalPrice)}${p.finalPrice < p.price ? `<s>${money(p.price)}</s>` : ''}</div>
            <div class="li-meta"><span class="dot ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span><span class="muted">· ${p.trackInventory === false ? 'not tracked' : p.stockTotal}</span>${(p.cats || []).length ? `<span class="muted">· ${esc(catName(p.cats[0]))}</span>` : ''}</div>
            <div class="li-tags">${productTags(p)}</div>
          </div>
          <div class="li-end">
            ${sw('data-act="active" title="Show on website"', p.active !== false)}
            <div class="menu-wrap"><button class="icon-btn" data-act="menu" aria-label="More">${I.dots}</button></div>
          </div>
        </div>`).join('') : '<div class="empty"><b>No products here</b>Try another filter, or add a product.</div>'}</div>`;

    $('#pq').oninput = (e) => { st.q = e.target.value; const pos = e.target.selectionStart; drawList(); const i = $('#pq'); i.focus(); i.setSelectionRange(pos, pos); };
    $('#pcat').onchange = (e) => { st.cat = e.target.value; drawList(); };
    $('#ptabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; drawList(); } };
    $('#plist').onclick = async (e) => {
      const row = e.target.closest('.li'); if (!row) return;
      const p = P.find(x => x.id === row.dataset.id);
      if (e.target.closest('.sw')) return;
      const mb = e.target.closest('[data-act="menu"]');
      if (mb) {
        e.stopPropagation();
        openMenu(mb, [
          { label: 'Edit', icon: I.edit, run: () => go('products/' + encodeURIComponent(p.id)) },
          { label: 'View on website', icon: I.eye, run: () => open('../product.html?id=' + encodeURIComponent(p.id), '_blank') },
          { label: 'Duplicate', icon: I.copy, run: async () => {
            const copy = strip(clone(p)); delete copy.id; copy.name += ' (copy)'; copy.slug = ''; copy.active = false;
            const made = await api('POST', '/api/admin/products', copy); await load(); toast('Product duplicated'); go('products/' + encodeURIComponent(made.id));
          } },
          { label: 'Delete', icon: I.trash, danger: true, run: async () => {
            if (!await confirmBox('Delete product?', `"${p.name}" will be removed from your store.`)) return;
            await api('DELETE', '/api/admin/products/' + encodeURIComponent(p.id)); await load(); toast('Product deleted'); drawList();
          } }
        ]);
        return;
      }
      go('products/' + encodeURIComponent(p.id));
    };
    $('#plist').onchange = async (e) => {
      const inp = e.target.closest('[data-act="active"]'); if (!inp) return;
      const p = P.find(x => x.id === inp.closest('.li').dataset.id);
      p.active = inp.checked;
      await api('PUT', '/api/admin/products/' + encodeURIComponent(p.id), strip(p));
      toast(p.active ? 'Product is visible on the website' : 'Product hidden from the website');
      await load();
    };
  };

  /* ---------- arranging the order products appear in ---------- */
  const drawArrange = () => {
    const scopes = [['all', 'Whole collection (Shop page)'], ['bestsellers', 'Best Sellers (home page)'], ...S.data.categories.map(c => [c.slug, 'Category · ' + c.name])];
    const listFor = (scope) => {
      if (scope === 'all') return orderedBy(P, S.data.order.all);
      if (scope === 'bestsellers') return orderedBy(P.filter(p => p.labels && p.labels.bestseller), S.data.order.bestsellers);
      return orderedBy(P.filter(p => (p.cats || []).includes(scope)), S.data.order.cats[scope] || []);
    };
    let items = listFor(st.scope);
    $('#pBody').innerHTML = `
      <div class="arrange-bar">
        <select class="sel" id="scope">${scopes.map(([k, l]) => `<option value="${esc(k)}" ${st.scope === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <p>Drag products by the handle, or use the arrows. The website shows them in exactly this order.</p>
        <button class="btn" id="arrCancel">Done</button>
        <button class="btn btn-green" id="arrSave">Save order</button>
      </div>
      <div class="list sortable" id="alist"></div>`;
    const paint = () => {
      $('#alist').innerHTML = items.length ? items.map((p, i) => `
        <div class="li" data-id="${esc(p.id)}">
          <span class="handle">${I.grip}</span><span class="pos">${i + 1}</span>
          <img class="li-img sm" src="${pthumb(p)}" alt="">
          <div class="li-body"><div class="li-t">${esc(p.name)}</div><div class="li-s">${money(p.finalPrice)} · <span class="${STATUS[p.status][1]}">${STATUS[p.status][0]}</span></div></div>
          <div class="li-end">
            <button class="icon-btn" data-mv="top" title="Move to top">${I.top}</button>
            <button class="icon-btn" data-mv="up" title="Move up">${I.up}</button>
            <button class="icon-btn" data-mv="down" title="Move down">${I.down}</button>
          </div>
        </div>`).join('') : `<div class="empty"><b>Nothing to arrange</b>${st.scope === 'bestsellers' ? 'Mark products as Bestseller to list them here.' : 'This category has no products yet.'}</div>`;
    };
    paint();
    sortable($('#alist'), '.li', { handle: '.handle', onEnd: (ids) => { items = ids.map(id => P.find(p => p.id === id)); paint(); S.dirty = true; } });
    $('#alist').onclick = (e) => {
      const b = e.target.closest('[data-mv]'); if (!b) return;
      const i = items.findIndex(p => p.id === b.closest('.li').dataset.id);
      const [it] = items.splice(i, 1);
      const to = b.dataset.mv === 'top' ? 0 : b.dataset.mv === 'up' ? Math.max(0, i - 1) : Math.min(items.length, i + 1);
      items.splice(to, 0, it); paint(); S.dirty = true;
    };
    $('#scope').onchange = (e) => {
      if (S.dirty && !confirm('Discard the changes to this order?')) { e.target.value = st.scope; return; }
      S.dirty = false; st.scope = e.target.value; items = listFor(st.scope); paint();
    };
    $('#arrSave').onclick = async () => {
      await api('PUT', '/api/admin/sort', { scope: st.scope, ids: items.map(p => p.id) });
      S.dirty = false; await load(); toast('Order saved — the website now shows this order');
    };
    $('#arrCancel').onclick = () => {
      if (S.dirty && !confirm('Discard the changes to this order?')) return;
      S.dirty = false; st.arrange = false; $('#arrBtn').classList.remove('on'); drawList();
    };
  };

  $('#arrBtn').onclick = () => {
    if (st.arrange && S.dirty && !confirm('Discard the changes to this order?')) return;
    S.dirty = false; st.arrange = !st.arrange;
    $('#arrBtn').classList.toggle('btn-green', st.arrange);
    st.arrange ? drawArrange() : drawList();
  };
  if (st.arrange) { $('#arrBtn').classList.add('btn-green'); drawArrange(); } else drawList();
};

/* ===================== Add / Edit Product ===================== */
const NEW_PRODUCT = () => ({
  name: '', slug: '', active: true, cats: [], tags: [], price: 0, salePrice: 0,
  discount: { on: false, type: 'percentage', value: 0, start: '', end: '' }, couponAllowed: true,
  labels: { featured: false, bestseller: false, newArrival: true, onSale: false, limited: false },
  material: '', size: '', dims: '', imgs: [], sm: {}, video: '', banner: '', desc: '', shortDesc: '', details: [], care: '',
  trackInventory: true, stock: 0, lowAlert: 5, sku: '', barcode: '', weight: '', length: '', width: '', height: '',
  shippingClass: 'standard', colors: [], sizes: [], seo: { title: '', description: '' },
  ar: { name: '', shortDesc: '', desc: '', details: [], care: '', dims: '', size: '' }
});

/* a product's main photo, as its small copy — for lists and alerts */
const pthumb = (p) => site(((p.sm || {})[(p.imgs || [])[0]]) || (p.imgs || [])[0]);

/* ---------- small copies of product photos, for the website's cards ---------- */
/* any photo without one (e.g. uploaded before) gets it here; copies of photos
   no longer on the product are dropped */
const withThumbs = async (p) => {
  const sm = p.sm || {}, keep = {};
  for (const u of p.imgs || []) {
    if (sm[u]) { keep[u] = sm[u]; continue; }
    try { keep[u] = await uploadThumb(site(u)); } catch (e) { console.error('thumb', u, e); }
  }
  p.sm = keep;
  const og = p.og || {}, keepOg = {};
  (p.imgs || []).forEach(u => { if (og[u]) keepOg[u] = og[u]; });
  p.og = keepOg;
  return p;
};

/* ---------- card framing: the cover inside the website's card square ---------- */
/* z: zoom (1 = whole photo) · x, y: shift as a share of the square (%) · bg: the
   colour around the photo. The website reads the same values in products.js. */
const FIT_BGS = ['#f6f2ea', '#ffffff', '#efe7da', '#e9ece4', '#23201c'];
const fitOf = (f) => {
  f = f || {};
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  return { z: num(f.z, 1, 3, 1), x: num(f.x, -100, 100, 0), y: num(f.y, -100, 100, 0), bg: /^#[0-9a-f]{3,8}$/i.test(f.bg || '') ? f.bg : '' };
};
const fitStyle = (f) => {
  const v = fitOf(f);
  return `--sq-z:${v.z};--sq-x:${v.x}%;--sq-y:${v.y}%` + (v.bg ? `;--sq-bg:${v.bg}` : '');
};

const ProductEditor = (id, tab) => {
  const isNew = id === 'new';
  const orig = isNew ? null : S.data.products.find(p => p.id === id);
  if (!isNew && !orig) { view.innerHTML = '<div class="empty"><b>Product not found</b><a class="link" href="#/products">Back to products</a></div>'; return; }
  const P = isNew ? NEW_PRODUCT() : { ...NEW_PRODUCT(), ...strip(clone(orig)) };
  P.ar = { ...NEW_PRODUCT().ar, ...(P.ar || {}) };
  P.sm = { ...(P.sm || {}) };              // photo → its small copy for the cards
  P.og = { ...(P.og || {}) };              // cropped photo → the photo as first uploaded
  let slugTouched = !isNew;
  /* every part of the product on one page, photos first */
  const SECTIONS = [['media', 'Photos & Media'], ['basic', 'Basic Info'], ['pricing', 'Pricing & Offers'], ['variants', 'Variations'], ['inventory', 'Inventory'], ['seo', 'SEO']];

  view.innerHTML = `
    <a class="back" href="#/products">${I.back} Products</a>
    <div class="ph"><div><h1>${isNew ? 'Add Product' : 'Edit Product'}</h1><p>${isNew ? 'Fill in the details, then save.' : esc(orig.name)}</p></div>
      <div class="ph-actions">
        ${isNew ? '' : `<a class="btn" href="../product.html?id=${encodeURIComponent(id)}" target="_blank">${I.eye} View</a><button class="btn btn-red" id="pDel">${I.trash}</button>`}
        <button class="btn btn-green" id="pSave">Save</button>
      </div></div>
    <div id="edBody" class="ed-page"></div>`;

  const body = $('#edBody');
  const touch = () => { S.dirty = true; };

  const fld = (label, key, opts = {}) => {
    const v = getPath(P, key) ?? '';
    const type = opts.type || 'text';
    const input = `<input type="${type}" data-k="${key}" ${opts.num ? 'data-num' : ''} value="${esc(v)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.disabled ? 'disabled' : ''} ${opts.min != null ? `min="${opts.min}"` : ''}>`;
    return `<label class="fld"><span>${label}${opts.req ? ' <em>*</em>' : ''}</span>${opts.suffix ? `<div class="suffix">${input}<b>${opts.suffix}</b></div>` : input}${opts.hint ? `<small class="hint">${opts.hint}</small>` : ''}</label>`;
  };
  const toggle = (label, key, hint) => `<div class="sw-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>${sw(`data-k="${key}" data-bool`, !!getPath(P, key))}</div>`;
  const check = (label, key) => `<label class="ck"><input type="checkbox" data-k="${key}" data-bool ${getPath(P, key) ? 'checked' : ''}>${label}</label>`;

  const TABVIEW = {
    basic: () => `
      <div class="form-stack">
          <div class="card form-stack">
            <h3 style="margin:0">Basic Information</h3>
            ${fld('Product Name', 'name', { req: true, ph: 'e.g. Luna Ceramic Vase' })}
          </div>
          <div class="card form-stack" style="border:1.5px solid var(--accent, #b08d57)">
            <h3 style="margin:0">Product Details</h3>
            <p class="hint" style="margin:0">Shown side by side on the product page.</p>
            <div class="grid g2" style="gap:4px 18px">
              ${fld('Size', 'size', { ph: 'e.g. Large, 30 cm, Set of 2' })}
              ${fld('Dimensions', 'dims', { ph: 'e.g. H 27 cm' })}
            </div>
            ${fld('Material', 'material', { ph: 'Glass, Ceramic, Porcelain, Metal, Wood…', hint: 'Used by the Material filter on the category page.' })}
            <label class="fld"><span>Details (one per line)</span><textarea data-k="details" data-lines>${esc((P.details || []).join('\n'))}</textarea></label>
            <label class="fld"><span>Care Instructions</span><textarea data-k="care">${esc(P.care || '')}</textarea></label>
          </div>
          <div class="card form-stack">
            ${fld('Slug (URL)', 'slug', { hint: 'The link of the product page: product.html?id=<b>' + esc(P.slug || 'your-product') + '</b>' })}
            <div class="fld"><span>Description</span>${rteHTML('pDesc', P.desc)}</div>
            ${fld('Short Description', 'shortDesc', { ph: 'One line that sums the piece up' })}
            <label class="fld"><span>Categories</span><div class="chips" id="catChips"></div></label>
            <label class="fld"><span>Tags</span><div class="chips" id="tagChips"></div><small class="hint">Type a tag and press Enter. Tags help the search page find the piece.</small></label>
          </div>
          <div class="card">
            <h3>Product Status</h3>
            ${toggle('Active', 'active', 'Visible on the website')}
            ${toggle('Featured Product', 'labels.featured')}
            ${toggle('Bestseller', 'labels.bestseller', 'Shown in Best Sellers on the home page')}
            ${toggle('New Arrival', 'labels.newArrival', 'Shows a “New” badge')}
          </div>
      </div>`,

    media: () => `
      <div class="card" style="margin-bottom:18px">
        <div class="card-h"><h2>Product Photos</h2><span class="hint">The first photo is the main one — it shows on the website. Tap ★ on any photo to make it the main one, or drag to reorder.</span></div>
        <div class="imgs" id="imgs">
          ${P.imgs.map((src, i) => `<div class="img-tile" data-id="${i}"><img src="${site(src)}" alt="">${i === 0 ? '<span class="tag tag-green cv">Main photo</span>' : `<button class="mk-main" data-main="${i}" title="Make this the main photo">★</button>`}<button class="x" data-rm="${i}" title="Remove">${I.x}</button><button class="crop" data-crop="${i}" title="Crop">${I.crop}</button></div>`).join('')}
          <button class="img-add" id="addImgs">${I.plus}<span>Add Images</span></button>
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Product Video <span class="muted">(optional)</span></h3>
          <div class="imgs">${P.video ? `<div class="img-tile"><video src="${site(P.video)}" muted playsinline></video><button class="x" id="rmVideo">${I.x}</button></div>` : ''}
            <button class="img-add" id="addVideo">${I.video}<span>${P.video ? 'Replace video' : 'Add video'}</span></button></div>
          <p class="hint" style="margin-top:8px">Shown at the end of the product's photo gallery.</p>
        </div>
        <div class="card"><h3>Product Banner <span class="muted">(optional)</span></h3>
          <div class="banner">${P.banner ? `<img src="${site(P.banner)}" alt=""><button class="x" id="rmBanner">${I.x}</button>` : '<div class="cover-empty">No banner</div>'}
            <button class="btn" id="chBanner">${P.banner ? 'Change Banner' : 'Add Banner'}</button></div>
          <p class="hint" style="margin-top:8px">A wide image shown on the product page above “You May Also Like”.</p>
        </div>
      </div>`,

    pricing: () => {
      return `
      <div class="grid g2">
        <div class="form-stack">
          <div class="card"><h3>Pricing</h3>
            <div class="row">${fld('Regular Price (EGP)', 'price', { req: true, num: true, type: 'number', min: 0 })}${fld('Sale Price (EGP)', 'salePrice', { num: true, type: 'number', min: 0, ph: 'Optional' })}</div>
            <p class="hint" style="margin-top:10px">Customers pay the sale price when it is lower than the regular price.</p>
          </div>
          <div class="card"><h3>Discount</h3>
            ${toggle('Apply Discount', 'discount.on')}
            <div class="form-stack" style="margin-top:8px">
              <div class="fld"><span>Discount Type</span><div class="seg" id="dType"><button data-v="percentage" class="${P.discount.type !== 'fixed' ? 'on' : ''}">Percentage (%)</button><button data-v="fixed" class="${P.discount.type === 'fixed' ? 'on' : ''}">Fixed Amount (EGP)</button></div></div>
              ${fld('Discount Value', 'discount.value', { num: true, type: 'number', min: 0, suffix: P.discount.type === 'fixed' ? 'EGP' : '%' })}
              <div class="row">${fld('Start Date', 'discount.start', { type: 'date' })}${fld('End Date', 'discount.end', { type: 'date' })}</div>
              <p class="hint">Leave the dates empty to keep the discount running until you switch it off.</p>
            </div>
          </div>
        </div>
        <div class="form-stack">
          <div class="card"><h3>Coupon</h3>${toggle('Allow Coupons on this Product', 'couponAllowed', 'When off, discount codes do not reduce this product’s price')}</div>
          <div class="card"><h3>Special Labels</h3>
            <div class="grid g2" style="gap:4px 18px">${check('On Sale', 'labels.onSale')}${check('Limited Edition', 'labels.limited')}</div>
          </div>
        </div>
      </div>`;
    },

    variants: () => {
      const rows = (kind) => (P[kind] || []).map((v, i) => `
        <tr data-kind="${kind}" data-i="${i}">
          <td>${kind === 'colors' ? `<input type="color" class="swatch-in" data-v="hex" value="${esc(v.hex || '#d8cbb5')}">` : ''}</td>
          <td><input class="in" data-v="name" value="${esc(v.name || '')}" placeholder="${kind === 'colors' ? 'e.g. Sand' : 'e.g. M (20 cm)'}"></td>
          <td><input class="in" data-v="ar" dir="rtl" value="${esc(v.ar || '')}" placeholder="${kind === 'colors' ? 'مثلاً رملي' : 'مثلاً وسط'}"></td>
          <td><input class="in" type="number" min="0" data-v="stock" value="${esc(v.stock ?? 0)}"></td>
          <td><input class="in" type="number" min="0" data-v="price" value="${esc(v.price ?? P.price)}"></td>
          <td><button class="icon-btn" data-del title="Remove">${I.trash}</button></td>
        </tr>`).join('');
      const table = (kind, title, addLabel) => `
        <div class="card" style="margin-bottom:18px"><h3>${title}</h3>
          ${(P[kind] || []).length ? `<table class="vtable"><thead><tr><th></th><th>Name</th><th>Arabic</th><th>Stock</th><th>Price (EGP)</th><th></th></tr></thead><tbody>${rows(kind)}</tbody></table>` : '<p class="muted">None yet.</p>'}
          <button class="add-row" data-add="${kind}">+ ${addLabel}</button>
        </div>`;
      return table('colors', 'Color Variants', 'Add Color Variant') + table('sizes', 'Size Variants', 'Add Size Variant') +
        '<p class="hint">With variants, each one has its own stock and price, and customers choose on the product page.</p>';
    },

    inventory: () => {
      const hasVars = (P.colors || []).length || (P.sizes || []).length;
      const total = [...(P.colors || []), ...(P.sizes || [])].reduce((s, v) => s + (Number(v.stock) || 0), 0);
      return `
      <div class="grid">
        <div class="card form-stack"><h3 style="margin:0">Inventory Settings</h3>
          ${toggle('Track Inventory', 'trackInventory', 'Turn off for pieces that are always available')}
          ${hasVars ? `<label class="fld"><span>Current Stock</span><input value="${total}" disabled><small class="hint">The sum of the variant stock — edit it in Variations.</small></label>` : fld('Current Stock', 'stock', { num: true, type: 'number', min: 0 })}
          ${fld('Low Stock Alert', 'lowAlert', { num: true, type: 'number', min: 0, hint: 'At or below this number the product shows as Low Stock (yellow).' })}
          ${fld('SKU', 'sku')}
          ${fld('Barcode (optional)', 'barcode')}
        </div>
      </div>`;
    },

    seo: () => `
      <div class="grid">
        <div class="card form-stack"><h3 style="margin:0">Search Engines (SEO)</h3>
          ${fld('SEO Title', 'seo.title', { ph: P.name ? P.name + ' | Maison Meka' : '' })}
          <label class="fld"><span>Meta Description</span><textarea data-k="seo.description" placeholder="A sentence or two that appears under the title in Google">${esc((P.seo || {}).description || '')}</textarea></label>
          <div style="padding:14px;border:1px solid var(--line);border-radius:10px">
            <div style="color:#1a0dab;font-size:16px">${esc((P.seo || {}).title || (P.name ? P.name + ' | Maison Meka' : 'Product title'))}</div>
            <div style="color:#006621;font-size:12.5px">maisonmeka.com › product › ${esc(P.slug || 'your-product')}</div>
            <div style="color:#545454;font-size:13px;margin-top:2px">${esc((P.seo || {}).description || P.shortDesc || 'Your description will appear here.')}</div>
          </div>
        </div>
      </div>`
  };

  const draw = () => {
    const y = scrollY;
    body.innerHTML = SECTIONS.map(([k, l], i) => `
      <section class="ed-sec" id="sec-${k}">
        <div class="ed-sec-h"><span class="ed-sec-n">${i + 1}</span><h2>${l}</h2></div>
        ${TABVIEW[k]()}
      </section>`).join('');
    wire();
    scrollTo(0, y);
  };
  const goTo = (k) => { const el = $('#sec-' + k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  /* the framing belongs to the main photo; a new main photo starts whole */
  const mainChanged = (before) => { if (P.imgs[0] !== before) P.fit = null; };

  /* chips for categories and tags */
  const drawChips = () => {
    const cc = $('#catChips'), tc = $('#tagChips');
    if (cc) {
      cc.innerHTML = P.cats.map(c => `<span class="chip">${esc(catName(c))}<button data-rmcat="${esc(c)}">${I.x}</button></span>`).join('') +
        `<select id="addCat"><option value="">Add category…</option>${S.data.categories.filter(c => !P.cats.includes(c.slug)).map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('')}</select>`;
      $('#addCat').onchange = (e) => { if (e.target.value) { P.cats.push(e.target.value); touch(); drawChips(); } };
    }
    if (tc) {
      tc.innerHTML = P.tags.map((t, i) => `<span class="chip">${esc(t)}<button data-rmtag="${i}">${I.x}</button></span>`).join('') + '<input id="addTag" placeholder="Add tag…">';
      $('#addTag').onkeydown = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
          e.preventDefault(); P.tags.push(e.target.value.trim().replace(/,$/, '')); touch(); drawChips(); $('#addTag').focus();
        }
      };
    }
  };

  const wire = () => {
    drawChips();
    const desc = $('#pDesc');
    if (desc) desc.oninput = () => { P.desc = cleanHTML(desc.innerHTML); touch(); };
    const descAr = $('#pDescAr');
    if (descAr) descAr.oninput = () => { P.ar.desc = cleanHTML(descAr.innerHTML); touch(); };

    body.oninput = body.onchange = (e) => {
      const el = e.target;
      if (el.dataset.k) {
        let v = el.dataset.bool !== undefined ? el.checked : el.value;
        if (el.dataset.num !== undefined) v = el.value === '' ? '' : Number(el.value);
        if (el.dataset.lines !== undefined) v = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        setPath(P, el.dataset.k, v);
        if (el.dataset.bool !== undefined) $(`[data-k="${el.dataset.k}"]`, body).forEach(o => { if (o !== el) o.checked = v; });
        if (el.dataset.k === 'name' && !slugTouched) { P.slug = slugify(P.name); const s = $('[data-k="slug"]'); if (s) s.value = P.slug; }
        if (el.dataset.k === 'slug') slugTouched = true;
        touch();
        if (e.type === 'change' && ['discount.on', 'trackInventory'].includes(el.dataset.k)) draw();
      }
      const tr = el.closest('tr[data-kind]');
      if (tr && el.dataset.v) {
        const v = P[tr.dataset.kind][Number(tr.dataset.i)];
        v[el.dataset.v] = ['stock', 'price'].includes(el.dataset.v) ? Number(el.value) || 0 : el.value;
        touch();
      }
    };

    body.onclick = async (e) => {
      const t = e.target;
      const rc = t.closest('[data-rmcat]'); if (rc) { e.preventDefault(); P.cats = P.cats.filter(c => c !== rc.dataset.rmcat); touch(); return drawChips(); }
      const rt = t.closest('[data-rmtag]'); if (rt) { e.preventDefault(); P.tags.splice(Number(rt.dataset.rmtag), 1); touch(); return drawChips(); }
      const mk = t.closest('[data-main]');
      if (mk) {
        const before = P.imgs[0];
        const [im] = P.imgs.splice(Number(mk.dataset.main), 1); P.imgs.unshift(im);
        mainChanged(before); touch(); draw(); toast('Main photo changed — save to show it on the website');
        return;
      }
      if (t.closest('#addImgs')) {
        const files = await pickFiles('image/*', true);
        for (const f of files) {
          const out = await cropImage(f, { title: `Crop ${f.name}`, ratio: '4:5' });
          if (!out) continue;
          toast('Uploading…');
          const full = await upload(out.blob, out.ext);
          P.imgs.push(full);
          /* keep the uncut photo too, so the crop can be redone or undone later */
          if (out.cropped) { try { const o = await shrinkImage(f, PHOTO_MAX, 0.86); P.og[full] = await upload(o.blob, o.ext); } catch (e) { console.error(e); } }
          try { P.sm[full] = await uploadThumb(out.blob); } catch (e) { console.error(e); }
          touch();
        }
        if (files.length) { toast('Images added'); draw(); }
        return;
      }
      const rm = t.closest('[data-rm]'); if (rm) { const before = P.imgs[0]; P.imgs.splice(Number(rm.dataset.rm), 1); mainChanged(before); touch(); return draw(); }
      /* the crop button, or a tap anywhere on the photo, opens its crop —
         always from the uncut photo, so nothing is lost by cropping twice */
      const cr = t.closest('[data-crop]') || t.closest('#imgs .img-tile');
      if (cr) {
        const i = Number(cr.dataset.crop ?? cr.dataset.id), cur = P.imgs[i], src = P.og[cur] || cur;
        const out = await cropImage(src, { title: 'Crop image', original: !!P.og[cur] });
        if (!out) return;
        let p = src;
        if (!out.reset) { toast('Uploading…'); p = await upload(out.blob, out.ext); P.og[p] = src; }
        const before = P.imgs[0]; P.imgs[i] = p;
        if (!P.sm[p]) { try { P.sm[p] = await uploadThumb(site(p)); } catch (e) { console.error(e); } }
        mainChanged(before); touch(); draw(); toast(out.reset ? 'Back to the original photo' : 'Image updated');
        return;
      }
      if (t.closest('#addVideo')) {
        const [f] = await pickFiles('video/mp4,video/webm,video/quicktime');
        if (!f) return;
        toast('Uploading video…');
        P.video = await upload(f, (f.name.split('.').pop() || 'mp4').toLowerCase()); touch(); toast('Video added'); return draw();
      }
      if (t.closest('#rmVideo')) { P.video = ''; touch(); return draw(); }
      if (t.closest('#chBanner')) { const p = await chooseImage({ title: 'Product banner', ratio: '16:9', ratios: ['16:9', '4:3', 'Original'] }); if (p) { P.banner = p; touch(); draw(); } return; }
      if (t.closest('#rmBanner')) { P.banner = ''; touch(); return draw(); }
      const dt = t.closest('#dType button'); if (dt) { P.discount.type = dt.dataset.v; touch(); return draw(); }
      const add = t.closest('[data-add]');
      if (add) { P[add.dataset.add].push({ name: '', ar: '', hex: '#d8cbb5', stock: 0, price: P.price }); touch(); return draw(); }
      const del = t.closest('[data-del]');
      if (del) { const tr = del.closest('tr'); P[tr.dataset.kind].splice(Number(tr.dataset.i), 1); touch(); return draw(); }
    };

    const imgs = $('#imgs');
    if (imgs) sortable(imgs, '.img-tile', { onEnd: (ids) => { const before = P.imgs[0]; P.imgs = ids.map(i => P.imgs[Number(i)]); mainChanged(before); touch(); draw(); } });

    /* card framing — every change shows at once in the preview square */
    const sq = $('#fitSq');
    if (sq) {
      const setFit = (patch) => {
        P.fit = { ...fitOf(P.fit), ...patch };
        const v = fitOf(P.fit);
        sq.setAttribute('style', fitStyle(v));
        $('#fitZ').value = v.z; $('#fitZv').textContent = Math.round(v.z * 100) + '%';
        const bg = v.bg || FIT_BGS[0];
        $$('#fitBg [data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg === bg));
        $('#fitBgC').value = bg;
        touch();
      };
      $('#fitZ').oninput = (e) => setFit({ z: Number(e.target.value) });
      $('#fitBg').onclick = (e) => { const b = e.target.closest('[data-bg]'); if (b) setFit({ bg: b.dataset.bg === FIT_BGS[0] ? '' : b.dataset.bg }); };
      $('#fitBgC').oninput = (e) => setFit({ bg: e.target.value });
      $('#fitWhole').onclick = () => setFit({ z: 1, x: 0, y: 0 });
      /* zoom just enough to cover the square, centred */
      $('#fitFill').onclick = () => {
        const im = sq.querySelector('img');
        const r = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
        setFit({ z: Math.min(3, Math.round(Math.max(r, 1 / r) * 100) / 100), x: 0, y: 0 });
      };
      let drag = null;
      sq.onpointerdown = (e) => {
        e.preventDefault();
        sq.setPointerCapture(e.pointerId);
        const v = fitOf(P.fit);
        drag = { px: e.clientX, py: e.clientY, x: v.x, y: v.y, w: sq.clientWidth };
        sq.classList.add('dragging');
      };
      sq.onpointermove = (e) => {
        if (!drag) return;
        const round = (n) => Math.round(n * 10) / 10;
        setFit({ x: round(drag.x + (e.clientX - drag.px) / drag.w * 100), y: round(drag.y + (e.clientY - drag.py) / drag.w * 100) });
      };
      sq.onpointerup = sq.onpointercancel = () => { drag = null; sq.classList.remove('dragging'); };
    }
  };

  $('#pSave').onclick = async () => {
    if (!P.name.trim()) { toast('Please add a product name', true); goTo('basic'); return; }
    if (!(Number(P.price) > 0)) { toast('Please add a regular price', true); goTo('pricing'); return; }
    P.colors = (P.colors || []).filter(v => v.name); P.sizes = (P.sizes || []).filter(v => v.name);
    const btn = $('#pSave'); btn.disabled = true;
    try {
      await withThumbs(P);
      const saved = isNew ? await api('POST', '/api/admin/products', P) : await api('PUT', '/api/admin/products/' + encodeURIComponent(id), P);
      S.dirty = false;
      await load();
      toast('Product saved — live on the website');
      if (isNew) go('products/' + encodeURIComponent(saved.id)); else { const y = scrollY; ProductEditor(id); scrollTo(0, y); }
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };
  const del = $('#pDel');
  if (del) del.onclick = async () => {
    if (!await confirmBox('Delete product?', `"${orig.name}" will be removed from your store.`)) return;
    await api('DELETE', '/api/admin/products/' + encodeURIComponent(id));
    S.dirty = false; await load(); toast('Product deleted'); go('products');
  };
  draw();
  if (tab && tab !== 'media') requestAnimationFrame(() => goTo(tab));
};

/* ===================== Categories ===================== */
const Categories = () => {
  const st = S.ui.cats = S.ui.cats || { q: '' };
  const countIn = (slug) => S.data.products.filter(p => (p.cats || []).includes(slug)).length;
  view.innerHTML = `
    <div class="ph"><div><h1>Categories</h1><p>${S.data.categories.length} categories</p></div>
      <a class="btn btn-green" href="#/categories/new">${I.plus} Add Category</a></div>
    <div class="toolbar"><label class="search">${I.search}<input id="cq" placeholder="Search categories…" value="${esc(st.q)}"></label></div>
    <div class="list" id="clist"></div>`;
  const draw = () => {
    const list = S.data.categories.filter(c => !st.q || c.name.toLowerCase().includes(st.q.toLowerCase()));
    $('#clist').innerHTML = list.map(c => `
      <div class="li click" data-id="${esc(c.slug)}">
        <img class="li-img" src="${site(c.img)}" alt="">
        <div class="li-body"><div class="li-t">${esc(c.name)}</div><div class="li-s">${countIn(c.slug)} products${c.parent ? ' · in ' + esc(catName(c.parent)) : ''}</div>
          <div class="li-tags">${c.nav !== false ? '<span class="tag tag-green">In navigation</span>' : '<span class="tag tag-gray">Hidden from menu</span>'}${c.featured !== false ? '<span class="tag tag-orange">Featured</span>' : ''}</div></div>
        <div class="li-end"><div class="menu-wrap"><button class="icon-btn" data-act="menu">${I.dots}</button></div></div>
      </div>`).join('') || '<div class="empty"><b>No categories</b></div>';
  };
  draw();
  $('#cq').oninput = (e) => { st.q = e.target.value; draw(); };
  $('#clist').onclick = (e) => {
    const row = e.target.closest('.li'); if (!row) return;
    const c = S.data.categories.find(x => x.slug === row.dataset.id);
    const mb = e.target.closest('[data-act="menu"]');
    if (mb) {
      e.stopPropagation();
      openMenu(mb, [
        { label: 'Edit', icon: I.edit, run: () => go('categories/' + encodeURIComponent(c.slug)) },
        { label: 'Arrange products', icon: I.sort, run: () => go('categories/' + encodeURIComponent(c.slug)) },
        { label: 'View on website', icon: I.eye, run: () => open('../category.html?c=' + encodeURIComponent(c.slug), '_blank') },
        { label: 'Delete', icon: I.trash, danger: true, run: async () => {
          if (!await confirmBox('Delete category?', `"${c.name}" will be removed. Its products stay in your store.`)) return;
          await api('DELETE', '/api/admin/categories/' + encodeURIComponent(c.slug)); await load(); toast('Category deleted'); draw();
        } }
      ]);
      return;
    }
    go('categories/' + encodeURIComponent(c.slug));
  };
};

const CategoryEditor = (slug) => {
  const isNew = slug === 'new';
  const orig = isNew ? null : S.data.categories.find(c => c.slug === slug);
  if (!isNew && !orig) { view.innerHTML = '<div class="empty"><b>Category not found</b></div>'; return; }
  const C = isNew ? { name: '', slug: '', desc: '', img: '', card: '', banner: '', parent: '', nav: true, featured: true, order: S.data.categories.length + 1 } : clone(orig);
  C.ar = { name: '', desc: '', ...(C.ar || {}) };
  let slugTouched = !isNew;
  let prods = isNew ? [] : orderedBy(S.data.products.filter(p => (p.cats || []).includes(slug)), S.data.order.cats[slug] || []);
  let orderDirty = false;

  const draw = () => {
    view.innerHTML = `
      <a class="back" href="#/categories">${I.back} Categories</a>
      <div class="ph"><div><h1>${isNew ? 'Add Category' : 'Edit Category'}</h1><p>${isNew ? '' : esc(orig.name)}</p></div>
        <div class="ph-actions">${isNew ? '' : `<a class="btn" href="../category.html?c=${encodeURIComponent(slug)}" target="_blank">${I.eye} View</a><button class="btn btn-red" id="cDel">${I.trash}</button>`}<button class="btn btn-green" id="cSave">Save</button></div></div>
      <div class="ed-grid">
        <div class="form-stack">
          <div class="card form-stack">
            <label class="fld"><span>Category Name <em>*</em></span><input data-k="name" value="${esc(C.name)}"></label>
            <label class="fld"><span>Slug (URL)</span><input data-k="slug" value="${esc(C.slug)}"><small class="hint">category.html?c=<b>${esc(C.slug || 'slug')}</b></small></label>
            <label class="fld"><span>Description</span><textarea data-k="desc">${esc(C.desc)}</textarea></label>
          </div>
          <div class="card form-stack" dir="rtl"><h3 style="margin:0">النسخة العربية</h3>
            <label class="fld"><span>اسم القسم</span><input data-k="ar.name" value="${esc(C.ar.name)}" placeholder="${esc(C.name)}"></label>
            <label class="fld"><span>الوصف</span><textarea data-k="ar.desc">${esc(C.ar.desc)}</textarea></label>
          </div>
          <div class="card"><h3>Banner Background</h3>
            <div class="banner">${C.banner ? `<img src="${site(C.banner)}" alt=""><button class="x" id="rmBanner">${I.x}</button>` : '<div class="cover-empty">No banner — the category image is used</div>'}<button class="btn" id="chBanner">${C.banner ? 'Change Banner' : 'Add Banner'}</button></div>
            <p class="hint" style="margin-top:8px">When set, the banner replaces the photo at the top of the category page.</p>
          </div>
          <div class="card form-stack">
            <label class="fld"><span>Parent Category (optional)</span><select data-k="parent"><option value="">None</option>${S.data.categories.filter(c => c.slug !== slug).map(c => `<option value="${esc(c.slug)}" ${C.parent === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <div class="row">
              <div><div class="sw-row"><span>Show in Navigation<small>Menu and category strip</small></span>${sw('data-k="nav" data-bool', C.nav !== false)}</div>
                   <div class="sw-row"><span>Featured Category<small>Shown on the home page</small></span>${sw('data-k="featured" data-bool', C.featured !== false)}</div></div>
              <label class="fld" style="max-width:160px"><span>Display Order</span><input type="number" min="1" data-k="order" data-num value="${esc(C.order)}"></label>
            </div>
          </div>
          ${isNew ? '' : `
          <div class="card"><div class="card-h"><h2>Products in this category</h2><button class="btn btn-sm btn-green" id="saveOrder" ${orderDirty ? '' : 'disabled'}>Save order</button></div>
            <p class="hint" style="margin-bottom:10px">Drag to set the order they appear in on this category page.</p>
            <div class="list sortable" id="cprods">${prods.map((p, i) => `<div class="li" data-id="${esc(p.id)}"><span class="handle">${I.grip}</span><span class="pos">${i + 1}</span><img class="li-img sm" src="${pthumb(p)}" alt=""><div class="li-body"><div class="li-t">${esc(p.name)}</div><div class="li-s">${money(p.finalPrice)}</div></div></div>`).join('') || '<div class="empty">No products in this category yet. Add it to products from the product editor.</div>'}</div>
          </div>`}
        </div>
        <div class="form-stack">
          <div><div class="cover">${C.img ? `<img src="${site(C.img)}" alt="">` : `<div class="cover-empty">${I.img}<br>No image</div>`}<button class="btn" id="chImg">${C.img ? 'Change Image' : 'Add Image'}</button></div>
            <p class="hint" style="margin-top:8px">Category page photo and the category strip.</p></div>
          <div><div class="cover" style="aspect-ratio:1">${C.card ? `<img src="${site(C.card)}" alt="" style="object-fit:contain">` : `<div class="cover-empty">No card image</div>`}<button class="btn" id="chCard">${C.card ? 'Change Card' : 'Add Card'}</button></div>
            <p class="hint" style="margin-top:8px">Home page card. A PNG with a transparent background looks best.</p></div>
        </div>
      </div>`;
    wire();
  };
  const wire = () => {
    view.oninput = view.onchange = (e) => {
      const el = e.target; if (!el.dataset.k) return;
      let v = el.dataset.bool !== undefined ? el.checked : el.value;
      if (el.dataset.num !== undefined) v = Number(el.value) || 0;
      setPath(C, el.dataset.k, v);
      if (el.dataset.k === 'name' && !slugTouched) { C.slug = slugify(C.name); $('[data-k="slug"]').value = C.slug; }
      if (el.dataset.k === 'slug') slugTouched = true;
      S.dirty = true;
    };
    view.onclick = async (e) => {
      const t = e.target;
      if (t.closest('#chImg')) { const p = await chooseImage({ title: 'Category image', ratio: '4:5' }); if (p) { C.img = p; S.dirty = true; draw(); } }
      if (t.closest('#chCard')) { const p = await chooseImage({ title: 'Home page card', ratio: 'Original' }); if (p) { C.card = p; S.dirty = true; draw(); } }
      if (t.closest('#chBanner')) { const p = await chooseImage({ title: 'Banner', ratio: '16:9', ratios: ['16:9', '4:3', 'Original'] }); if (p) { C.banner = p; S.dirty = true; draw(); } }
      if (t.closest('#rmBanner')) { C.banner = ''; S.dirty = true; draw(); }
      if (t.closest('#saveOrder')) {
        await api('PUT', '/api/admin/sort', { scope: slug, ids: prods.map(p => p.id) });
        orderDirty = false; await load(); toast('Order saved'); draw();
      }
      if (t.closest('#cDel')) {
        if (!await confirmBox('Delete category?', `"${orig.name}" will be removed. Its products stay in your store.`)) return;
        await api('DELETE', '/api/admin/categories/' + encodeURIComponent(slug)); S.dirty = false; await load(); toast('Category deleted'); go('categories');
      }
      if (t.closest('#cSave')) {
        if (!C.name.trim()) return toast('Please add a category name', true);
        try {
          const saved = isNew ? await api('POST', '/api/admin/categories', C) : await api('PUT', '/api/admin/categories/' + encodeURIComponent(slug), C);
          S.dirty = false; await load(); toast('Category saved — live on the website');
          go('categories/' + encodeURIComponent(saved.slug));
          if (!isNew && saved.slug === slug) CategoryEditor(slug);
        } catch (err) { toast(err.message, true); }
      }
    };
    const list = $('#cprods');
    if (list) sortable(list, '.li', { handle: '.handle', onEnd: (ids) => { prods = ids.map(id => prods.find(p => p.id === id)); orderDirty = true; draw(); } });
  };
  draw();
};

/* ===================== Orders ===================== */
const Orders = (q) => {
  const st = S.ui.orders = S.ui.orders || { q: '', tab: 'all', limit: 30 };
  const O = S.data.orders;
  view.innerHTML = `
    <div class="ph"><div><h1>Orders</h1><p>Orders sent from the website's bag. Confirming an order takes its pieces out of stock.</p></div></div>
    <div class="toolbar"><label class="search">${I.search}<input id="oq" placeholder="Search by order number, name or phone…" value="${esc(st.q)}"></label></div>
    <div class="tabs" id="otabs"></div>
    <div class="list" id="olist"></div>`;
  const draw = () => {
    const tabs = [['all', 'All'], ...ORDER_STATES.map(s => [s, s[0].toUpperCase() + s.slice(1)])];
    $('#otabs').innerHTML = tabs.map(([k, l]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l} (${k === 'all' ? O.length : O.filter(o => o.status === k).length})</button>`).join('');
    const list = O.filter(o => (st.tab === 'all' || o.status === st.tab) &&
      (!st.q || (o.id + ' ' + o.name + ' ' + o.phone).toLowerCase().includes(st.q.toLowerCase())));
    const more = list.length > st.limit;
    $('#olist').innerHTML = list.slice(0, st.limit).map(o => `
      <div class="li click" data-id="${esc(o.id)}">
        <img class="li-img sm" src="${site(o.items[0] && o.items[0].img)}" alt="">
        <div class="li-body"><div class="li-t">${esc(o.id)} · ${esc(o.name)}</div><div class="li-s">${fmtDate(o.date, true)} · ${o.items.reduce((s, i) => s + i.qty, 0)} items${o.city ? ' · ' + esc(o.city) : ''}</div></div>
        <div class="li-col"><b>${money(o.total)}</b></div>
        <span class="st st-${o.status}">${o.status}</span>
      </div>`).join('') + (more ? `<div class="li" style="justify-content:center"><button class="btn btn-sm" data-more>Show more (${list.length - st.limit} left)</button></div>` : '')
      || '<div class="empty"><b>No orders</b>Orders placed from the website appear here.</div>';
  };
  const openOrder = (id) => {
    const o = O.find(x => x.id === id); if (!o) return;
    const c = modal.open(`
      <div class="modal-h"><h2>Order ${esc(o.id)}</h2><button class="icon-btn" data-x>${I.x}</button></div>
      <p class="muted" style="margin-bottom:12px">${fmtDate(o.date, true)}${o.photo ? ` · <a class="link" href="${site(o.photo)}" target="_blank">Order photo</a>` : ''}${o.share ? ` · <a class="link" href="../o/${encodeURIComponent(o.id)}-${esc(o.share)}" target="_blank">Customer’s link</a>` : ''}</p>
      ${o.items.map(it => `<div class="oi"><img src="${site(it.img)}" alt=""><div><b>${esc(it.name)}</b>${it.variant ? `<div class="muted">${esc(it.variant)}</div>` : ''}<div class="muted">${money(it.price)} × ${it.qty}</div></div><b>${money(it.price * it.qty)}</b></div>`).join('')}
      <div style="margin:10px 0 16px">
        <div class="sum-l"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        ${o.discount ? `<div class="sum-l"><span>Discount${o.coupon ? ' (' + esc(o.coupon) + ')' : ''}</span><span>- ${money(o.discount)}</span></div>` : ''}
        <div class="sum-l tot"><span>Total</span><span>${money(o.total)}</span></div>
      </div>
      <div class="grid g2" style="gap:12px">
        <label class="fld"><span>Customer</span><input id="oName" value="${esc(o.name)}"></label>
        <label class="fld"><span>Phone</span><input id="oPhone" value="${esc(o.phone)}"></label>
        <label class="fld"><span>City / Area</span><input id="oCity" value="${esc(o.city || '')}"></label>
        <label class="fld"><span>Status</span><select id="oStatus">${ORDER_STATES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label>
      </div>
      <label class="fld" style="margin-top:12px"><span>Note</span><textarea id="oNote">${esc(o.note || '')}</textarea></label>
      <p class="hint" style="margin-top:8px">Confirmed, shipped or delivered orders take their pieces out of stock; cancelling or returning puts them back.</p>
      <div class="modal-f"><a class="btn" href="https://wa.me/2${esc(String(o.phone).replace(/\D/g, '').replace(/^2/, ''))}" target="_blank">WhatsApp</a><button class="btn btn-green" data-save>Save</button></div>`);
    c.querySelector('[data-x]').onclick = () => modal.close();
    c.querySelector('[data-save]').onclick = async () => {
      await api('PUT', '/api/admin/orders/' + encodeURIComponent(o.id), { status: $('#oStatus').value, name: $('#oName').value, phone: $('#oPhone').value, city: $('#oCity').value, note: $('#oNote').value });
      modal.close(); await load(); toast('Order updated'); Orders(new URLSearchParams());
    };
  };
  draw();
  $('#oq').oninput = (e) => { st.q = e.target.value; st.limit = 30; draw(); };
  $('#otabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; st.limit = 30; draw(); } };
  $('#olist').onclick = (e) => {
    if (e.target.closest('[data-more]')) { st.limit += 30; return draw(); }
    const r = e.target.closest('.li[data-id]'); if (r) openOrder(r.dataset.id);
  };
  if (q.get('open')) openOrder(q.get('open'));
};

/* ===================== Customers ===================== */
const Customers = () => {
  const map = new Map();
  S.data.orders.forEach(o => {
    const key = String(o.phone).replace(/\D/g, '') || o.name;
    const c = map.get(key) || { name: o.name, phone: o.phone, city: o.city, orders: 0, spent: 0, last: o.date, list: [] };
    c.orders++; if (COUNTED.includes(o.status)) c.spent += o.total;
    if (o.date > c.last) { c.last = o.date; c.name = o.name; c.city = o.city || c.city; }
    c.list.push(o); map.set(key, c);
  });
  const all = [...map.values()].sort((a, b) => b.spent - a.spent);
  let q = '';
  view.innerHTML = `
    <div class="ph"><div><h1>Customers</h1><p>${all.length} customers from your orders</p></div></div>
    <div class="toolbar"><label class="search">${I.search}<input id="uq" placeholder="Search by name or phone…"></label></div>
    <div class="list" id="ulist"></div>`;
  const draw = () => {
    const list = all.filter(c => !q || (c.name + c.phone).toLowerCase().includes(q.toLowerCase()));
    $('#ulist').innerHTML = list.map((c, i) => `
      <div class="li click" data-i="${all.indexOf(c)}">
        <span class="cp-ic" style="background:var(--green-t);color:var(--green);font-weight:600">${esc(c.name.trim()[0] || '?')}</span>
        <div class="li-body"><div class="li-t">${esc(c.name)}</div><div class="li-s">${esc(c.phone)}${c.city ? ' · ' + esc(c.city) : ''}</div></div>
        <div class="li-col hide-m"><span class="muted">${c.orders} orders</span></div>
        <div class="li-col"><b>${money(c.spent)}</b><div class="li-s">last ${fmtDate(c.last)}</div></div>
      </div>`).join('') || '<div class="empty"><b>No customers yet</b>Customers appear with their first order.</div>';
  };
  draw();
  $('#uq').oninput = (e) => { q = e.target.value; draw(); };
  $('#ulist').onclick = (e) => {
    const r = e.target.closest('.li'); if (!r) return;
    const c = all[Number(r.dataset.i)];
    const m = modal.open(`
      <div class="modal-h"><h2>${esc(c.name)}</h2><button class="icon-btn" data-x>${I.x}</button></div>
      <p class="muted">${esc(c.phone)}${c.city ? ' · ' + esc(c.city) : ''} · ${c.orders} orders · ${money(c.spent)} spent</p>
      <div class="list" style="margin-top:14px">${c.list.map(o => `<a class="li click" href="#/orders?open=${esc(o.id)}"><div class="li-body"><div class="li-t">${esc(o.id)}</div><div class="li-s">${fmtDate(o.date)}</div></div><b>${money(o.total)}</b><span class="st st-${o.status}">${o.status}</span></a>`).join('')}</div>`);
    m.querySelector('[data-x]').onclick = () => modal.close();
    m.querySelectorAll('a').forEach(a => a.addEventListener('click', () => modal.close()));
  };
};

/* ===================== Coupons ===================== */
const Coupons = () => {
  const st = S.ui.coupons = S.ui.coupons || { q: '', tab: 'all' };
  const C = S.data.coupons;
  view.innerHTML = `
    <div class="ph"><div><h1>Coupons</h1><p>Discount codes customers can enter in the bag.</p></div><button class="btn btn-green" id="addCp">${I.plus} Add Coupon</button></div>
    <div class="tabs" id="ctabs"></div>
    <div class="toolbar"><label class="search">${I.search}<input id="cpq" placeholder="Search coupons…" value="${esc(st.q)}"></label></div>
    <div class="list" id="cplist"></div>`;
  const typeTag = (c) => c.type === 'percentage' ? '<span class="tag tag-red">Percentage</span>' : c.type === 'fixed' ? '<span class="tag tag-orange">Fixed</span>' : '<span class="tag tag-blue">Free Shipping</span>';
  const draw = () => {
    const tabs = [['all', 'All'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['expired', 'Expired']];
    $('#ctabs').innerHTML = tabs.map(([k, l]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l} (${k === 'all' ? C.length : C.filter(c => c.state === k).length})</button>`).join('');
    const list = C.filter(c => (st.tab === 'all' || c.state === st.tab) && (!st.q || c.code.toLowerCase().includes(st.q.toLowerCase())));
    $('#cplist').innerHTML = list.map(c => `
      <div class="li click" data-id="${esc(c.id)}">
        <span class="cp-ic">${I.ticket}</span>
        <div class="li-body">
          <div class="li-meta" style="margin:0"><span class="cp-code">${esc(c.code)}</span>${typeTag(c)}<span class="st st-${c.state}">${c.state}</span>${c.popup ? '<span class="tag tag-orange">Popup</span>' : ''}</div>
          <div class="cp-line"><span>${c.type === 'percentage' ? c.value + '% off' : c.type === 'fixed' ? money(c.value) + ' off' : 'Free shipping'}</span>
            <span>${c.start || c.end ? (c.start ? fmtDate(c.start) : '…') + ' – ' + (c.end ? fmtDate(c.end) : 'No expiry') : 'No expiry'}</span>
            <span>Min. order ${money(c.minOrder)}</span><span>${c.uses || 0} uses</span></div>
        </div>
        <div class="li-end">${sw('data-act="active"', c.active)}</div>
      </div>`).join('') || '<div class="empty"><b>No coupons</b></div>';
  };
  const edit = (c) => {
    const D = c ? clone(c) : { code: '', type: 'percentage', value: 10, start: '', end: '', minOrder: 0, active: true };
    const m = modal.open(`
      <div class="modal-h"><h2>${c ? 'Edit Coupon' : 'Add Coupon'}</h2><button class="icon-btn" data-x>${I.x}</button></div>
      <div class="form-stack">
        <label class="fld"><span>Code <em>*</em></span><input id="kCode" value="${esc(D.code)}" placeholder="e.g. MAISON20" style="text-transform:uppercase"></label>
        <div class="fld"><span>Type</span><div class="seg" id="kType">${[['percentage', 'Percentage'], ['fixed', 'Fixed Amount'], ['freeship', 'Free Shipping']].map(([k, l]) => `<button data-v="${k}" class="${D.type === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <label class="fld" id="kValW"><span>Value</span><div class="suffix"><input id="kVal" type="number" min="0" value="${esc(D.value)}"><b id="kSuf">${D.type === 'fixed' ? 'EGP' : '%'}</b></div></label>
        <div class="row"><label class="fld"><span>Start Date</span><input id="kStart" type="date" value="${esc(D.start)}"></label><label class="fld"><span>End Date</span><input id="kEnd" type="date" value="${esc(D.end)}"></label></div>
        <label class="fld"><span>Minimum Order (EGP)</span><input id="kMin" type="number" min="0" value="${esc(D.minOrder)}"></label>
        <div class="sw-row"><span>Active</span>${sw('id="kAct"', D.active)}</div>
        <div class="sw-row"><span>Show as popup on the website<small>Appears in the middle of the screen after a visitor has been on the site for one minute. Only one coupon pops up at a time.</small></span>${sw('id="kPop"', D.popup)}</div>
      </div>
      <div class="modal-f">${c ? '<button class="btn btn-red" data-del>Delete</button>' : ''}<button class="btn" data-x>Cancel</button><button class="btn btn-green" data-save>Save</button></div>`);
    const syncType = () => { $('#kValW').hidden = D.type === 'freeship'; $('#kSuf').textContent = D.type === 'fixed' ? 'EGP' : '%'; };
    syncType();
    m.onclick = async (e) => {
      const tb = e.target.closest('#kType button');
      if (tb) { D.type = tb.dataset.v; $$('#kType button').forEach(b => b.classList.toggle('on', b === tb)); syncType(); return; }
      if (e.target.closest('[data-x]')) return modal.close();
      if (e.target.closest('[data-del]')) {
        modal.close();
        if (!await confirmBox('Delete coupon?', `${c.code} will stop working.`)) return;
        await api('DELETE', '/api/admin/coupons/' + c.id); await load(); toast('Coupon deleted'); Coupons(); return;
      }
      if (e.target.closest('[data-save]')) {
        Object.assign(D, { code: $('#kCode').value, value: Number($('#kVal').value) || 0, start: $('#kStart').value, end: $('#kEnd').value, minOrder: Number($('#kMin').value) || 0, active: $('#kAct').checked, popup: $('#kPop').checked });
        try {
          c ? await api('PUT', '/api/admin/coupons/' + c.id, D) : await api('POST', '/api/admin/coupons', D);
          modal.close(); await load(); toast('Coupon saved'); Coupons();
        } catch (err) { toast(err.message, true); }
      }
    };
  };
  draw();
  $('#addCp').onclick = () => edit(null);
  $('#cpq').oninput = (e) => { st.q = e.target.value; draw(); };
  $('#ctabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; draw(); } };
  $('#cplist').onclick = (e) => { if (e.target.closest('.sw')) return; const r = e.target.closest('.li'); if (r) edit(C.find(c => c.id === r.dataset.id)); };
  $('#cplist').onchange = async (e) => {
    const inp = e.target.closest('[data-act="active"]'); if (!inp) return;
    const c = C.find(x => x.id === inp.closest('.li').dataset.id);
    const { state, ...rest } = c;
    await api('PUT', '/api/admin/coupons/' + c.id, { ...rest, active: inp.checked });
    await load(); toast(inp.checked ? 'Coupon switched on' : 'Coupon switched off'); Coupons();
  };
};

/* ===================== Sales & Offers ===================== */
const Offers = () => {
  const P = S.data.products;
  let best = orderedBy(P.filter(p => p.labels && p.labels.bestseller), S.data.order.bestsellers);
  const sale = P.filter(p => p.finalPrice < p.price);
  const coupons = S.data.coupons.filter(c => c.state === 'active');
  const SS = S.data.settings.siteSale || { on: false, value: 0, start: '', end: '' };
  const today = new Date().toISOString().slice(0, 10);
  const SSactive = SS.on && SS.value > 0 && (!SS.start || SS.start <= today) && (!SS.end || SS.end >= today);
  view.innerHTML = `
    <div class="ph"><div><h1>Sales & Offers</h1><p>Best sellers, discounted products and running coupons.</p></div></div>
    <div class="card" style="margin-bottom:18px"><div class="card-h"><h2>Store-wide Sale</h2><button class="btn btn-sm btn-green" id="saveSS">Save</button></div>
      <p class="hint" style="margin-bottom:12px">A discount on every product in the store. Pieces that already have a lower price keep it. The website shows the old price crossed out.</p>
      <div class="sw-row"><span>Sale is on${SSactive ? '<small style="color:#2e7d32">Running now on the website</small>' : ''}</span>${sw('id="ssOn"', SS.on)}</div>
      <div class="row" style="margin-top:12px">
        <label class="fld"><span>Discount (%)</span><div class="suffix"><input type="number" id="ssVal" min="1" max="90" value="${esc(SS.value || '')}" placeholder="e.g. 15"><b>%</b></div></label>
        <label class="fld"><span>Start Date</span><input type="date" id="ssStart" value="${esc(SS.start || '')}"></label>
        <label class="fld"><span>End Date</span><input type="date" id="ssEnd" value="${esc(SS.end || '')}"></label>
      </div>
      <p class="hint" style="margin-top:8px">Leave the dates empty to keep the sale running until you switch it off.</p>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h2>Best Sellers order</h2><button class="btn btn-sm btn-green" id="saveBest" disabled>Save order</button></div>
        <p class="hint" style="margin-bottom:10px">The home page shows the first five. Mark a product as Bestseller in its editor to add it.</p>
        <div class="list sortable" id="blist"></div></div>
      <div class="form-stack">
        <div class="card"><div class="card-h"><h2>On Sale now</h2></div>
          <div class="list">${sale.map(p => `<a class="li click" href="#/products/${encodeURIComponent(p.id)}?tab=pricing"><img class="li-img sm" src="${pthumb(p)}" alt=""><div class="li-body"><div class="li-t">${esc(p.name)}</div><div class="li-price">${money(p.finalPrice)} <s>${money(p.price)}</s></div></div>${productTags(p)}</a>`).join('') || '<div class="empty">No products on sale. Add a discount from a product’s Pricing & Offers tab.</div>'}</div></div>
        <div class="card"><div class="card-h"><h2>Active coupons</h2><a class="link" href="#/coupons">Manage</a></div>
          <div class="list">${coupons.map(c => `<div class="li"><span class="cp-ic">${I.ticket}</span><div class="li-body"><div class="cp-code">${esc(c.code)}</div><div class="li-s">${c.type === 'percentage' ? c.value + '% off' : c.type === 'fixed' ? money(c.value) + ' off' : 'Free shipping'} · ${c.uses || 0} uses</div></div></div>`).join('') || '<div class="empty">No active coupons.</div>'}</div></div>
      </div>
    </div>`;
  $('#saveSS').onclick = async () => {
    const value = Number($('#ssVal').value) || 0;
    const on = $('#ssOn').checked;
    if (on && (value <= 0 || value > 90)) return toast('Enter a discount between 1 and 90%', true);
    await api('PUT', '/api/admin/settings', { siteSale: { on, value, start: $('#ssStart').value, end: $('#ssEnd').value } });
    await load(); toast(on ? 'Store-wide sale saved' : 'Store-wide sale switched off'); Offers();
  };
  const paint = () => {
    $('#blist').innerHTML = best.map((p, i) => `<div class="li" data-id="${esc(p.id)}"><span class="handle">${I.grip}</span><span class="pos">${i + 1}</span><img class="li-img sm" src="${pthumb(p)}" alt=""><div class="li-body"><div class="li-t">${esc(p.name)}</div><div class="li-s">${money(p.finalPrice)}${i >= 5 ? ' · not shown on home' : ''}</div></div></div>`).join('') || '<div class="empty">No best sellers yet.</div>';
  };
  paint();
  sortable($('#blist'), '.li', { handle: '.handle', onEnd: (ids) => { best = ids.map(id => P.find(p => p.id === id)); paint(); $('#saveBest').disabled = false; S.dirty = true; } });
  $('#saveBest').onclick = async () => {
    await api('PUT', '/api/admin/sort', { scope: 'bestsellers', ids: best.map(p => p.id) });
    S.dirty = false; await load(); toast('Best sellers order saved'); $('#saveBest').disabled = true;
  };
};

/* ===================== Website Content ===================== */
const Content = () => {
  const D = clone(S.data.content);
  const f = (label, path, area) => `<label class="fld"><span>${label}</span>${area ? `<textarea data-p="${path}">${esc(getPath(D, path) || '')}</textarea>` : `<input data-p="${path}" value="${esc(getPath(D, path) || '')}">`}</label>`;
  view.innerHTML = `
    <div class="ph"><div><h1>Website Content</h1><p>The words on your home page and shop page.</p></div><button class="btn btn-green" id="ctSave">Save</button></div>
    <div class="grid g2">
      <div class="card form-stack"><h3 style="margin:0">Home · Hero</h3>
        ${f('Small line above the title', 'hero.eyebrow')}${f('Title', 'hero.title')}${f('Script line', 'hero.script')}${f('Description', 'hero.desc', true)}${f('Button label', 'hero.button')}</div>
      <div class="form-stack">
        <div class="card form-stack"><h3 style="margin:0">Home · Shop by Category</h3>${f('Small line', 'collections.kicker')}${f('Title', 'collections.title')}${f('Description', 'collections.desc')}</div>
        <div class="card form-stack"><h3 style="margin:0">Home · Best Sellers</h3>${f('Small line', 'best.kicker')}${f('Title', 'best.title')}${f('Description', 'best.desc', true)}${f('Button label', 'best.button')}</div>
      </div>
      <div class="card form-stack" dir="rtl"><h3 style="margin:0">العربية · الرئيسية</h3>
        ${f('سطر صغير فوق العنوان', 'ar.hero.eyebrow')}${f('العنوان', 'ar.hero.title')}${f('السطر المميز', 'ar.hero.script')}${f('الوصف', 'ar.hero.desc', true)}${f('نص الزر', 'ar.hero.button')}</div>
      <div class="card form-stack" dir="rtl"><h3 style="margin:0">العربية · الأقسام والأكثر مبيعاً</h3>
        ${f('سطر صغير (الأقسام)', 'ar.collections.kicker')}${f('عنوان الأقسام', 'ar.collections.title')}${f('وصف الأقسام', 'ar.collections.desc')}
        ${f('سطر صغير (الأكثر مبيعاً)', 'ar.best.kicker')}${f('عنوان الأكثر مبيعاً', 'ar.best.title')}${f('وصف الأكثر مبيعاً', 'ar.best.desc', true)}${f('نص زر الأكثر مبيعاً', 'ar.best.button')}
        ${f('عنوان صفحة المتجر', 'ar.allCategory.name')}${f('وصف صفحة المتجر', 'ar.allCategory.desc', true)}</div>
      <div class="card form-stack"><h3 style="margin:0">Shop page (all products)</h3>
        ${f('Title', 'allCategory.name')}${f('Description', 'allCategory.desc', true)}
        <div class="banner" style="aspect-ratio:16/9">${D.allCategory && D.allCategory.img ? `<img src="${site(D.allCategory.img)}" alt="">` : '<div class="cover-empty">No image</div>'}<button class="btn" id="ctImg">Change Image</button></div></div>
    </div>`;
  view.oninput = (e) => { const el = e.target; if (el.dataset.p) { setPath(D, el.dataset.p, el.value); S.dirty = true; } };
  view.onclick = async (e) => {
    if (e.target.closest('#ctImg')) { const p = await chooseImage({ title: 'Shop page image', ratio: '4:5' }); if (p) { setPath(D, 'allCategory.img', p); S.dirty = true; S.data.content = D; Content(); } }
    if (e.target.closest('#ctSave')) { await api('PUT', '/api/admin/content', D); S.dirty = false; await load(); toast('Content saved — live on the website'); }
  };
};

/* ===================== Settings ===================== */
const Settings = () => {
  const st = S.data.settings;
  view.innerHTML = `
    <div class="ph"><div><h1>Settings</h1></div></div>
    <div class="grid g2">
      <div class="card form-stack"><h3 style="margin:0">Store</h3>
        <label class="fld"><span>Store name</span><input id="sName" value="${esc(st.storeName || '')}"></label>
        <label class="fld"><span>Instagram link (orders are sent here)</span><input id="sIg" value="${esc(st.instagram || '')}"></label>
        <div class="sw-row"><span>Fill every category with the whole catalogue<small>Useful while products are still being added — switch off once each category has its own products.</small></span>${sw('id="sFill"', st.previewFill)}</div>
        <div><button class="btn btn-green" id="sSave">Save</button></div>
      </div>
      <div class="card form-stack"><h3 style="margin:0">Sign-in</h3>
        <label class="fld"><span>Username</span><input id="sUser" value="${esc(st.adminUser || '')}" autocomplete="username"></label>
        <div><button class="btn btn-green" id="sUserSave">Update username</button></div>
        <h3 style="margin:8px 0 0">Change password</h3>
        <label class="fld"><span>New password</span><input id="sPw" type="password" autocomplete="new-password"></label>
        <label class="fld"><span>Repeat new password</span><input id="sPw2" type="password" autocomplete="new-password"></label>
        <div><button class="btn btn-green" id="sPwSave">Update password</button></div>
      </div>
      <div class="card form-stack"><h3 style="margin:0">Website speed</h3>
        <p class="muted">Product cards load a small copy of each photo. New photos get one automatically; this makes them for photos added before.</p>
        <p id="spdInfo" class="hint"></p>
        <div><button class="btn btn-green" id="spdGo">Speed up product photos</button></div>
      </div>
      <div class="card form-stack danger-zone"><h3 style="margin:0;color:var(--red)">Start from zero</h3>
        <p class="muted">Before launch: remove the demo orders, customers and statistics. Your products and categories stay.</p>
        <div><button class="btn btn-red" id="rDemo">Clear orders & statistics</button></div>
        <p class="muted">Or empty the whole store — every product and coupon is removed too.</p>
        <div><button class="btn btn-solid-red" id="rAll">Empty the store</button></div>
      </div>
    </div>`;
  /* product photos that still lack their small copy */
  const missing = () => S.data.products.filter(p => (p.imgs || []).some(u => !(p.sm || {})[u]));
  const paintSpd = () => {
    const n = missing().length;
    $('#spdInfo').textContent = n ? n + ' product' + (n > 1 ? 's' : '') + ' still load full-size photos on the cards.' : 'Every product already loads light photos.';
    $('#spdGo').disabled = !n;
  };
  paintSpd();
  $('#spdGo').onclick = async () => {
    const list = missing(), btn = $('#spdGo');
    btn.disabled = true;
    let done = 0;
    for (const p of list) {
      btn.textContent = 'Working… ' + (++done) + ' / ' + list.length;
      try { await api('PUT', '/api/admin/products/' + encodeURIComponent(p.id), await withThumbs(strip(clone(p)))); }
      catch (err) { toast(p.name + ': ' + err.message, true); }
    }
    await load(); btn.textContent = 'Speed up product photos'; paintSpd(); toast('Product photos are now light');
  };
  $('#sSave').onclick = async () => { await api('PUT', '/api/admin/settings', { storeName: $('#sName').value, instagram: $('#sIg').value, previewFill: $('#sFill').checked }); await load(); toast('Settings saved'); };
  $('#sUserSave').onclick = async () => {
    try { await api('PUT', '/api/admin/settings', { newUsername: $('#sUser').value }); await load(); toast('Username updated'); } catch (err) { toast(err.message, true); }
  };
  $('#sPwSave').onclick = async () => {
    if ($('#sPw').value !== $('#sPw2').value) return toast('The passwords do not match', true);
    try { await api('PUT', '/api/admin/settings', { newPassword: $('#sPw').value }); toast('Password updated'); $('#sPw').value = $('#sPw2').value = ''; } catch (err) { toast(err.message, true); }
  };
  $('#rDemo').onclick = async () => { if (!await confirmBox('Clear orders & statistics?', 'All orders, customers and visitor statistics will be deleted. This cannot be undone.', 'Clear')) return; await api('POST', '/api/admin/reset', { scope: 'demo' }); await load(); toast('Cleared — the store starts from zero'); };
  $('#rAll').onclick = async () => { if (!await confirmBox('Empty the whole store?', 'Every product, coupon, order and statistic will be deleted. Categories stay. This cannot be undone.', 'Empty the store')) return; await api('POST', '/api/admin/reset', { scope: 'all' }); await load(); toast('The store is empty'); };
};

/* ===================== sign in + start ===================== */
const start = async () => {
  if (!localStorage.getItem(TOKEN_KEY)) { $('#login').hidden = false; return; }
  try { await load(); } catch { return; }
  $('#app').hidden = false;
  render();
};
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const { token } = await api('POST', '/api/admin/login', { username: $('#loginUser').value.trim(), password: $('#loginPw').value });
    localStorage.setItem(TOKEN_KEY, token);
    $('#login').hidden = true;
    start();
  } catch (err) { $('#loginErr').textContent = err.message; }
};
$('#logoutBtn').onclick = async () => {
  try { await api('POST', '/api/admin/logout'); } catch {}
  localStorage.removeItem(TOKEN_KEY); location.reload();
};
start();
