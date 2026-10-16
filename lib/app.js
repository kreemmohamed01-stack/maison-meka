// ===================== Maison Meka — API ===================== //
/* Every /api/... request. Used by server.js on your own machine and by
   api/index.js on Vercel — the same code in both places.

     /api/catalog, /api/content    what the website reads
     /api/track, /api/coupon,      what the website writes
     /api/orders
     /api/admin/...                the dashboard, behind a sign-in

   Each request loads the store, works on it, and saves it back with a
   version check; if someone else saved in between, it simply runs again. */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const out = require('./orders-out');

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

/* Cloudinary — when its keys are set, photos and videos are kept there
   instead of Vercel Blob (CLOUDINARY_URL=cloudinary://key:secret@cloud,
   or the three CLOUDINARY_* variables) */
const CLD = (() => {
  const u = String(process.env.CLOUDINARY_URL || '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const c = u ? { key: u[1], secret: u[2], cloud: u[3] }
              : { key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET, cloud: process.env.CLOUDINARY_CLOUD_NAME };
  return c.key && c.secret && c.cloud ? c : null;
})();
const CLD_FOLDER = 'maison-meka';
/* signs a set of upload parameters the way Cloudinary expects */
const cldSign = (params) => {
  const s = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
  return crypto.createHash('sha1').update(s + CLD.secret).digest('hex');
};
/* a server-side upload (the order photo); returns the delivery URL */
const cldUpload = async (buf, folder, mime) => {
  const params = { folder: CLD_FOLDER + '/' + folder, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }));
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  form.append('api_key', CLD.key);
  form.append('signature', cldSign(params));
  const r = await fetch('https://api.cloudinary.com/v1_1/' + CLD.cloud + '/image/upload', { method: 'POST', body: form });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Upload failed');
  return d.secure_url;
};
const UPLOADS = path.join(__dirname, '..', 'assets', 'uploads');

let db = null;          // the store, as loaded for the request being handled

/* ===================== helpers ===================== */
const now = () => Date.now();
/* days and hours are counted in Cairo time, wherever the server runs */
const cairoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const cairo = (t = now()) => {
  const p = Object.fromEntries(cairoFmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour) % 24 };
};
const dayKey = (t = now()) => cairo(t).date;
const slugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const uid = (prefix = '') => prefix + crypto.randomBytes(5).toString('hex');
const within = (start, end, t = now()) =>
  (!start || t >= new Date(start).getTime()) &&
  (!end   || t <= new Date(end).getTime() + 86399999);

const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
const checkPw = (pw, stored) => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
};

/* ===================== pricing + stock ===================== */
const discountActive = (p) => {
  const d = p.discount || {};
  return !!(d.on && Number(d.value) > 0 && within(d.start, d.end));
};
/* the selling price: sale price if set, then an active discount */
const finalPrice = (p, amount) => {
  const regular = Number(amount ?? p.price) || 0;
  let price = regular;
  if (amount == null && Number(p.salePrice) > 0 && Number(p.salePrice) < regular) price = Number(p.salePrice);
  if (discountActive(p)) {
    const v = Number(p.discount.value);
    price = p.discount.type === 'fixed' ? regular - v : regular * (1 - v / 100);
  }
  /* a sale across the whole store: off the regular price, unless the piece is already cheaper */
  const ss = (db && db.settings && db.settings.siteSale) || {};
  if (ss.on && Number(ss.value) > 0 && within(ss.start, ss.end)) price = Math.min(price, regular * (1 - Math.min(100, Number(ss.value)) / 100));
  return Math.max(0, Math.round(price));
};
const stockOf = (p) => {
  const vars = [...(p.colors || []), ...(p.sizes || [])];
  if (vars.length) return vars.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return Number(p.stock) || 0;
};
const stockStatus = (p) => {
  if (p.trackInventory === false) return 'in';
  const q = stockOf(p);
  if (q <= 0) return 'out';
  return q <= (Number(p.lowAlert) || 0) ? 'low' : 'in';
};
const ordered = (list, ids = []) => {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...list].sort((a, b) => {
    const pa = pos.has(a.id) ? pos.get(a.id) : 1e9 - (a.added || 0) / 1e13;
    const pb = pos.has(b.id) ? pos.get(b.id) : 1e9 - (b.added || 0) / 1e13;
    return pa - pb;
  });
};

/* ===================== what the website sees ===================== */
const thumbOf = (p, u) => (p.sm && p.sm[u]) || u;
const publicProduct = (p) => {
  const st = stockStatus(p);
  const price = finalPrice(p);
  const regular = Number(p.price) || 0;
  const L = p.labels || {};
  const badge = L.bestseller ? 'Bestseller' : L.newArrival ? 'New'
              : (L.onSale && price < regular) ? 'Sale' : L.limited ? 'Limited' : '';
  const variant = (v) => ({
    name: v.name, ar: v.ar || '', hex: v.hex || '',
    price: finalPrice(p, Number(v.price) || regular),
    compareAt: Number(v.price) || regular,
    stock: p.trackInventory === false ? true : (Number(v.stock) || 0) > 0
  });
  return {
    id: p.id, name: p.name, cats: p.cats || [], tags: p.tags || [],
    price, compareAt: price < regular ? regular : 0,
    badge, labels: L,
    stock: st !== 'out', low: st === 'low',
    material: p.material || '', dims: p.dims || '',
    imgs: (p.imgs || []).length ? p.imgs : ['assets/logo-circle.webp'],
    /* the small copy of each photo, for cards, the bag and thumbnails */
    thumbs: (p.imgs || []).length ? p.imgs.map(u => thumbOf(p, u)) : ['assets/logo-circle.webp'],
    video: p.video || '', banner: p.banner || '',
    fit: p.fit || null,
    desc: p.desc || '', shortDesc: p.shortDesc || '',
    details: p.details || [], care: p.care || '',
    colors: (p.colors || []).map(variant), sizes: (p.sizes || []).map(variant),
    seo: p.seo || {}, added: p.added || 0,
    ar: p.ar || {}
  };
};
const catalog = () => {
  const live = db.products.filter(p => p.active !== false);
  const cats = [...db.categories].sort((a, b) => (a.order || 0) - (b.order || 0)).map(c => ({
    slug: c.slug, name: c.name, desc: c.desc || '', img: c.img || '', banner: c.banner || '',
    card: c.card || c.img || '', parent: c.parent || '', nav: c.nav !== false, featured: c.featured !== false,
    productOrder: db.order.cats[c.slug] || [],
    ar: c.ar || {}
  }));
  return {
    settings: { previewFill: !!db.settings.previewFill, storeName: db.settings.storeName, instagram: db.settings.instagram },
    /* the store-wide sale, only while it is running — the website shows a bar for it */
    sale: (() => {
      const s = db.settings.siteSale || {};
      return s.on && Number(s.value) > 0 && within(s.start, s.end) ? { value: Number(s.value), end: s.end || '' } : null;
    })(),
    allCategory: db.content.allCategory,
    content: db.content,
    /* the coupon chosen to pop up on the website, while it is running */
    popup: (() => {
      const c = db.coupons.find(x => x.popup && couponState(x) === 'active');
      return c ? { code: c.code, type: c.type, value: Number(c.value) || 0, minOrder: Number(c.minOrder) || 0, end: c.end || '' } : null;
    })(),
    categories: cats,
    products: ordered(live, db.order.all).map(publicProduct),
    bestsellers: ordered(live.filter(p => p.labels && p.labels.bestseller), db.order.bestsellers).map(p => p.id)
  };
};

/* ===================== statistics ===================== */
const TZ_COUNTRY = {
  'Africa/Cairo':'EG', 'Asia/Riyadh':'SA', 'Asia/Dubai':'AE', 'Asia/Kuwait':'KW', 'Asia/Qatar':'QA',
  'Asia/Bahrain':'BH', 'Asia/Amman':'JO', 'Asia/Muscat':'OM', 'Asia/Beirut':'LB', 'Europe/London':'GB',
  'Europe/Paris':'FR', 'Europe/Berlin':'DE', 'Europe/Rome':'IT', 'Asia/Baghdad':'IQ', 'Africa/Tripoli':'LY'
};
const COUNTRY_NAMES = { EG:'Egypt', SA:'Saudi Arabia', US:'United States', AE:'UAE', KW:'Kuwait', QA:'Qatar',
  BH:'Bahrain', JO:'Jordan', OM:'Oman', LB:'Lebanon', GB:'United Kingdom', FR:'France', DE:'Germany',
  IT:'Italy', IQ:'Iraq', LY:'Libya', XX:'Others' };
/* Vercel tells us the visitor's country; elsewhere it is read from the time zone */
const countryOf = (req, tz = '', lang = '') => {
  const h = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(h)) return h;
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  if (String(tz).startsWith('America/')) return 'US';
  const region = String(lang).split('-')[1];
  return region && region.length === 2 ? region.toUpperCase() : 'XX';
};
const sourceOf = (ref = '', utm = '', host = '') => {
  const s = String(utm || ref).toLowerCase();
  if (!s) return 'direct';
  if (host && s.includes(host)) return null;
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('google')) return 'google';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('facebook') || s.includes('fb.')) return 'facebook';
  if (s.includes('whatsapp') || s.includes('wa.me')) return 'whatsapp';
  return 'others';
};
const COUNTED = ['pending', 'confirmed', 'shipped', 'delivered'];

const analytics = async (range = '7d') => {
  const DAY = 86400000, t = now();
  const back = (n) => Array.from({ length: n }, (_, i) => dayKey(t - (n - 1 - i) * DAY));
  const today = dayKey(), yesterday = dayKey(t - DAY);
  const span = range === 'today' ? [today] : range === '1y' ? back(365) : back(range === '30d' ? 30 : 7);
  const keys = [...new Set([...span, today, yesterday])];
  const days = await store.readDays(keys, range === 'today' ? today : null);

  let series;
  if (range === 'today') {
    series = days[today].h.map((v, i) => ({ label: `${(i % 12) || 12}${i < 12 ? 'AM' : 'PM'}`, value: v }));
  } else if (range === '1y') {
    const months = new Map();
    span.forEach(k => { const m = k.slice(0, 7); months.set(m, (months.get(m) || 0) + days[k].v); });
    series = [...months].slice(-12).map(([m, v]) => ({ label: new Date(m + '-15').toLocaleString('en-US', { month: 'short' }), value: v }));
  } else {
    series = span.map(k => ({ label: new Date(k + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }), value: days[k].v }));
  }

  const sum = (field) => {
    const out = {};
    span.forEach(k => Object.entries(days[k][field] || {}).forEach(([a, b]) => { out[a] = (out[a] || 0) + b; }));
    return out;
  };
  const share = (obj, names) => {
    const total = Object.values(obj).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(obj).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, name: names ? (names[k] || k) : k, value: v, pct: Math.round(v / total * 100) }));
  };
  let countries = share(sum('cty'), COUNTRY_NAMES);
  if (countries.length > 5) {
    const top = countries.filter(c => c.key !== 'XX').slice(0, 4);
    const rest = countries.filter(c => !top.includes(c)).reduce((s, c) => s + c.value, 0);
    countries = [...top, { key: 'XX', name: 'Others', value: rest }];
    const tot = countries.reduce((s, c) => s + c.value, 0) || 1;
    countries.forEach(c => { c.pct = Math.round(c.value / tot * 100); });
  }

  const inWin = (o, from, to) => { const ot = new Date(o.date).getTime(); return ot >= from && ot < to; };
  const win = (from, to) => db.orders.filter(o => COUNTED.includes(o.status) && inWin(o, from, to));
  const cur = win(t - 30 * DAY, t + 1), prev = win(t - 60 * DAY, t - 30 * DAY);
  const rev = (l) => l.reduce((s, o) => s + (o.total || 0), 0);
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : (a ? 100 : 0);

  const from = range === 'today' ? t - DAY : range === '30d' ? t - 30 * DAY : range === '1y' ? t - 365 * DAY : t - 7 * DAY;
  const sold = {};
  db.orders.filter(o => COUNTED.includes(o.status) && new Date(o.date).getTime() >= from)
    .forEach(o => o.items.forEach(it => { sold[it.id] = (sold[it.id] || 0) + it.qty; }));
  const views = sum('prod');
  const topProducts = db.products.map(p => ({
    id: p.id, name: p.name, img: (p.imgs || [])[0] ? thumbOf(p, p.imgs[0]) : '', price: finalPrice(p),
    sales: sold[p.id] || 0, views: views[p.id] || 0
  })).sort((a, b) => b.sales - a.sales || b.views - a.views).slice(0, 5);

  return {
    series, countries, sources: share(sum('src')), topProducts,
    revenue: rev(cur), revenueChange: pct(rev(cur), rev(prev)),
    orders: cur.length, ordersChange: pct(cur.length, prev.length),
    visitorsToday: days[today].v, visitorsChange: pct(days[today].v, days[yesterday].v),
    liveNow: await store.liveCount()
  };
};

/* ===================== orders, stock, coupons ===================== */
const nextOrderId = () => {
  const n = db.orders.reduce((m, o) => Math.max(m, Number(String(o.id).replace(/\D/g, '')) || 1000), 1000);
  return 'MM-' + (n + 1);
};
/* a bag line can carry "Colour / Size" — each part is matched to its variant */
const findVariants = (p, label) => String(label || '').split(' / ').map(part => {
  const c = (p.colors || []).find(v => v.name === part);
  const z = (p.sizes || []).find(v => v.name === part);
  return z ? { v: z, kind: 'size' } : c ? { v: c, kind: 'color' } : null;
}).filter(Boolean);
/* stock leaves the shelf when an order is confirmed, and returns if it is
   cancelled or returned afterwards */
const applyStock = (order, dir) => {
  order.items.forEach(it => {
    const p = db.products.find(x => x.id === it.id);
    if (!p || p.trackInventory === false) return;
    const vs = it.variant ? findVariants(p, it.variant) : [];
    if (vs.length) vs.forEach(({ v }) => { v.stock = Math.max(0, (Number(v.stock) || 0) - dir * it.qty); });
    else p.stock = Math.max(0, (Number(p.stock) || 0) - dir * it.qty);
  });
};
const setOrderStatus = (order, status) => {
  if (['confirmed', 'shipped', 'delivered'].includes(status) && !order.stockApplied) { applyStock(order, 1); order.stockApplied = true; }
  if (['cancelled', 'returned'].includes(status) && order.stockApplied) { applyStock(order, -1); order.stockApplied = false; }
  order.status = status;
};
const couponState = (c, t = now()) => {
  if (!c.active) return 'disabled';
  if (c.start && t < new Date(c.start).getTime()) return 'scheduled';
  if (c.end && t > new Date(c.end).getTime() + 86399999) return 'expired';
  return 'active';
};
const lineOf = (it) => {
  const [pid, variant] = String(it.id || '').split('::');
  const p = db.products.find(x => x.id === pid && x.active !== false);
  if (!p) return null;
  const vs = variant ? findVariants(p, variant) : [];
  const priced = (vs.find(x => x.kind === 'size') || vs[0] || {}).v;
  const qty = Math.max(1, Math.min(50, Number(it.qty) || 1));
  const price = priced ? finalPrice(p, Number(priced.price) || Number(p.price)) : finalPrice(p);
  return { p, qty, price, variant: vs.map(x => x.v.name).join(' / ') };
};
/* prices the bag from the catalogue; a coupon only reduces pieces that allow it */
const priceItems = (items) => {
  let subtotal = 0, eligible = 0;
  (Array.isArray(items) ? items : []).forEach(it => {
    const l = lineOf(it); if (!l) return;
    subtotal += l.price * l.qty;
    if (l.p.couponAllowed !== false) eligible += l.price * l.qty;
  });
  return { subtotal, eligible };
};
const checkCoupon = (code, subtotal, eligible = subtotal) => {
  const c = db.coupons.find(x => x.code.toUpperCase() === String(code || '').trim().toUpperCase());
  if (!c) return { ok: false, error: 'This code is not valid.' };
  const st = couponState(c);
  if (st !== 'active') return { ok: false, error: st === 'scheduled' ? 'This code is not active yet.' : 'This code has expired.' };
  if (subtotal < (Number(c.minOrder) || 0)) return { ok: false, error: `Minimum order for this code is EGP ${Number(c.minOrder).toLocaleString('en-US')}.` };
  if (c.type !== 'freeship' && eligible <= 0) return { ok: false, error: 'This code does not apply to the pieces in your bag.' };
  let discount = 0, label = 'Free shipping';
  if (c.type === 'percentage') { discount = Math.round(eligible * c.value / 100); label = `${c.value}% off`; }
  else if (c.type === 'fixed') { discount = Math.min(eligible, Number(c.value)); label = `EGP ${Number(c.value).toLocaleString('en-US')} off`; }
  return { ok: true, code: c.code, type: c.type, discount, label };
};

/* ===================== plumbing ===================== */
/* what every visitor reads is cached at Vercel's edge for a short while, so
   thousands of visits cost one database read; changes from the dashboard
   reach every visitor within two minutes at most */
/* after the first minute a visitor is still answered at once from the edge,
   while a fresh copy is fetched behind them */
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=120, stale-while-revalidate=86400';
const send = (res, code, data, cache = 'no-store') => {
  const isObj = data !== null && typeof data === 'object' && !Buffer.isBuffer(data);
  res.writeHead(code, { 'Content-Type': isObj ? 'application/json' : 'text/plain', 'Cache-Control': cache });
  res.end(isObj ? JSON.stringify(data) : (data || ''));
};
const readBody = (req, limit) => new Promise((resolve, reject) => {
  if (Buffer.isBuffer(req.body)) return resolve(req.body);
  const chunks = []; let size = 0;
  req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const readJSON = async (req) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const buf = await readBody(req, 2 * 1024 * 1024);
  try { return buf.length ? JSON.parse(buf.toString('utf8')) : {}; } catch { return {}; }
};
const tokenOf = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const validSession = (tok) => !!(tok && db.sessions && db.sessions[tok] && db.sessions[tok] > now());

/* the first visit to an empty database fills it with the demo store */
const ensureDoc = async () => {
  for (let i = 0; i < 3; i++) {
    const got = await store.loadDoc();
    if (got.doc) return got;
    const { build } = require('../tools/seed.js');
    const { doc, days } = build();
    if (await store.saveDoc(doc, got.ver)) { await store.seedAnalytics(days); }
  }
  return store.loadDoc();
};

/* ===================== routes ===================== */
/* each returns [status, body] and sets ctx.dirty when it changed the store */
const COLLECTIONS = { products: 'id', categories: 'slug', coupons: 'id', orders: 'id' };

const route = async (req, p, url, body, ctx) => {
  const M = req.method;
  /* ---------- public ---------- */
  if (M === 'GET' && p === '/api/catalog') return [200, catalog()];
  if (M === 'GET' && p === '/api/content') return [200, db.content];
  if (M === 'POST' && p === '/api/coupon') {
    if (Array.isArray(body.items)) { const t = priceItems(body.items); return [200, checkCoupon(body.code, t.subtotal, t.eligible)]; }
    return [200, checkCoupon(body.code, Number(body.subtotal) || 0)];
  }
  /* an order from the bag: prices always come from the catalogue */
  if (M === 'POST' && p === '/api/orders') {
    /* name and phone are collected later, in the Instagram chat */
    const name = String(body.name || '').trim().slice(0, 80) || 'Instagram customer';
    const phone = String(body.phone || '').trim().slice(0, 30);
    const items = (Array.isArray(body.items) ? body.items : []).map(it => {
      const l = lineOf(it);
      return l && { id: l.p.id, name: l.p.name, variant: l.variant, price: l.price, qty: l.qty, img: (l.p.imgs || [])[0] ? thumbOf(l.p, l.p.imgs[0]) : '' };
    }).filter(Boolean);
    if (!items.length) return [400, { error: 'Your bag is empty.' }];
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const c = body.coupon ? checkCoupon(body.coupon, subtotal, priceItems(body.items).eligible) : null;
    const discount = c && c.ok ? c.discount : 0;
    const order = {
      id: nextOrderId(), date: new Date().toISOString(),
      name, phone, city: String(body.city || '').trim().slice(0, 60), note: String(body.note || '').slice(0, 300),
      items, subtotal, coupon: c && c.ok ? c.code : '', discount, total: subtotal - discount,
      status: 'pending', stockApplied: false,
      /* share: part of the order's link · photoKey: lets this customer add the order photo */
      share: crypto.randomBytes(4).toString('hex'), photoKey: crypto.randomBytes(12).toString('hex'), photo: ''
    };
    if (c && c.ok) { const cp = db.coupons.find(x => x.code === c.code); if (cp) cp.uses = (cp.uses || 0) + 1; }
    db.orders.unshift(order);
    ctx.dirty = true;
    const origin = out.originOf(req);
    /* the email goes out after the customer has their answer */
    ctx.later = () => out.sendOrderEmail(order, origin);
    return [200, { ok: true, id: order.id, total: order.total, subtotal, discount,
      link: out.orderLink(origin, order), key: order.photoKey }];
  }
  if (!p.startsWith('/api/admin/')) return [404, { error: 'Not found' }];

  /* ---------- sign in ---------- */
  if (M === 'POST' && p === '/api/admin/login') {
    /* too many wrong tries from one place locks sign-in for a while */
    const who = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
    if (await store.failCount(who) >= 8) return [429, { error: 'Too many attempts — please try again in 15 minutes.' }];
    const user = String(body.username || '').trim();
    const okUser = user === (db.settings.adminUser || 'maison1111');
    const okPw = checkPw(body.password, db.settings.adminHash);
    if (!okUser || !okPw) { await store.failAdd(who, 900); return [401, { error: 'Wrong username or password' }]; }
    await store.failClear(who);
    const tok = crypto.randomBytes(24).toString('hex');
    db.sessions = db.sessions || {};
    Object.keys(db.sessions).forEach(k => { if (db.sessions[k] < now()) delete db.sessions[k]; });
    db.sessions[tok] = now() + 30 * 86400000;
    ctx.dirty = true;
    return [200, { token: tok }];
  }
  if (!validSession(tokenOf(req))) return [401, { error: 'Please sign in' }];

  if (M === 'POST' && p === '/api/admin/logout') { delete db.sessions[tokenOf(req)]; ctx.dirty = true; return [200, { ok: true }]; }

  if (M === 'GET' && p === '/api/admin/state') {
    const { adminHash, ...settings } = db.settings;
    return [200, {
      products: db.products.map(x => ({ ...x, status: stockStatus(x), stockTotal: stockOf(x), finalPrice: finalPrice(x) })),
      categories: [...db.categories].sort((a, b) => (a.order || 0) - (b.order || 0)),
      coupons: db.coupons.map(c => ({ ...c, state: couponState(c) })),
      orders: db.orders, order: db.order, content: db.content,
      settings: { ...settings, uploadMode: CLD ? 'cloudinary' : BLOB ? 'blob' : 'local', storage: store.KIND }
    }];
  }
  /* the dashboard uploads straight to Cloudinary with this signature */
  if (M === 'POST' && p === '/api/admin/cld-sign') {
    if (!CLD) return [400, { error: 'Cloudinary is not set up' }];
    const params = { folder: CLD_FOLDER + '/uploads', timestamp: Math.floor(Date.now() / 1000) };
    return [200, { cloud: CLD.cloud, apiKey: CLD.key, ...params, signature: cldSign(params) }];
  }
  if (M === 'GET' && p === '/api/admin/analytics') return [200, await analytics(url.searchParams.get('range') || '7d')];

  if (M === 'PUT' && p === '/api/admin/sort') {
    const ids = (body.ids || []).filter(id => db.products.some(x => x.id === id));
    if (body.scope === 'all') db.order.all = ids;
    else if (body.scope === 'bestsellers') db.order.bestsellers = ids;
    else if (db.categories.some(c => c.slug === body.scope)) db.order.cats[body.scope] = ids;
    else return [400, { error: 'Unknown list' }];
    ctx.dirty = true; return [200, { ok: true }];
  }
  if (M === 'PUT' && p === '/api/admin/content') { db.content = { ...db.content, ...body }; ctx.dirty = true; return [200, db.content]; }
  if (M === 'PUT' && p === '/api/admin/settings') {
    if (body.newPassword) {
      if (String(body.newPassword).length < 6) return [400, { error: 'Password must be at least 6 characters' }];
      db.settings.adminHash = hashPw(body.newPassword);
    }
    if (body.newUsername) {
      const u = String(body.newUsername).trim();
      if (u.length < 3) return [400, { error: 'Username must be at least 3 characters' }];
      db.settings.adminUser = u;
    }
    if ('siteSale' in body) {
      const s = body.siteSale || {};
      db.settings.siteSale = { on: !!s.on, value: Math.max(0, Math.min(90, Number(s.value) || 0)), start: String(s.start || ''), end: String(s.end || '') };
    }
    ['storeName', 'instagram', 'previewFill', 'currency'].forEach(k => { if (k in body) db.settings[k] = body[k]; });
    ctx.dirty = true; return [200, { ok: true }];
  }
  if (M === 'POST' && p === '/api/admin/reset') {
    db.orders = [];
    db.coupons.forEach(c => { c.uses = 0; });
    if (body.scope === 'all') { db.products = []; db.coupons = []; db.order = { all: [], bestsellers: [], cats: {} }; }
    ctx.dirty = true; ctx.after = () => store.resetAnalytics();
    return [200, { ok: true }];
  }

  /* create / update / delete for products, categories, coupons, orders */
  const m = p.match(/^\/api\/admin\/(products|categories|coupons|orders)(?:\/([^/]+))?$/);
  if (!m) return [404, { error: 'Not found' }];
  const [, coll, rawKey] = m;
  const key = COLLECTIONS[coll];
  const id = rawKey && decodeURIComponent(rawKey);
  const list = db[coll];

  if (M === 'DELETE' && id) {
    const i = list.findIndex(x => x[key] === id);
    if (i < 0) return [404, { error: 'Not found' }];
    list.splice(i, 1);
    if (coll === 'products') {
      db.order.all = db.order.all.filter(x => x !== id);
      db.order.bestsellers = db.order.bestsellers.filter(x => x !== id);
      Object.keys(db.order.cats).forEach(c => { db.order.cats[c] = db.order.cats[c].filter(x => x !== id); });
    }
    if (coll === 'categories') {
      delete db.order.cats[id];
      db.products.forEach(x => { x.cats = (x.cats || []).filter(c => c !== id); });
    }
    ctx.dirty = true; return [200, { ok: true }];
  }
  if (M !== 'POST' && M !== 'PUT') return [405, { error: 'Not allowed' }];

  const b = { ...body };
  delete b.stockTotal; delete b.finalPrice; delete b.state;
  if (coll === 'products') {
    delete b.status;
    if (!b.name) return [400, { error: 'Product name is required' }];
    b.slug = slugify(b.slug || b.name);
    if (!id) {
      b.id = b.slug;
      let n = 2; while (list.some(x => x.id === b.id)) b.id = `${b.slug}-${n++}`;
      b.added = now();
    }
  }
  if (coll === 'categories') {
    if (!b.name) return [400, { error: 'Category name is required' }];
    b.slug = slugify(b.slug || b.name);
    if (!id && list.some(x => x.slug === b.slug)) return [400, { error: 'A category with this slug already exists' }];
  }
  if (coll === 'coupons') {
    if (b.popup) db.coupons.forEach(x => { if (x.id !== id) x.popup = false; });
    b.code = String(b.code || '').trim().toUpperCase();
    if (!b.code) return [400, { error: 'Coupon code is required' }];
    if (list.some(x => x.code === b.code && x.id !== id)) return [400, { error: 'This code already exists' }];
    if (!id) { b.id = uid('c_'); b.uses = 0; }
  }

  if (!id) {
    if (coll === 'orders') return [400, { error: 'Orders come from the website' }];
    list.unshift(b);
    if (coll === 'products') db.order.all.unshift(b.id);
    ctx.dirty = true; return [200, b];
  }
  const cur = list.find(x => x[key] === id);
  if (!cur) return [404, { error: 'Not found' }];
  if (coll === 'orders') {
    if (b.status && b.status !== cur.status) setOrderStatus(cur, b.status);
    ['name', 'phone', 'city', 'note'].forEach(k => { if (k in b) cur[k] = b[k]; });
    ctx.dirty = true; return [200, cur];
  }
  if (coll === 'categories' && b.slug !== id) {
    if (list.some(x => x.slug === b.slug)) return [400, { error: 'A category with this slug already exists' }];
    db.products.forEach(x => { x.cats = (x.cats || []).map(c => c === id ? b.slug : c); });
    if (db.order.cats[id]) { db.order.cats[b.slug] = db.order.cats[id]; delete db.order.cats[id]; }
  }
  const keep = coll === 'products' ? { id: cur.id, added: cur.added } : coll === 'coupons' ? { id: cur.id, uses: cur.uses } : {};
  Object.keys(cur).forEach(k => delete cur[k]);
  Object.assign(cur, b, keep);
  ctx.dirty = true; return [200, cur];
};

/* ===================== uploads ===================== */
const uploads = async (req, res, p, url) => {
  /* on Vercel the browser uploads straight to Blob storage; this endpoint
     only signs the request (after checking the dashboard session) */
  if (p === '/api/admin/blob') {
    const body = await readJSON(req);
    const { handleUpload } = require('@vercel/blob/client');
    const { doc } = await ensureDoc(); db = doc;
    try {
      const out = await handleUpload({
        body, request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!validSession(String(clientPayload || ''))) throw new Error('Please sign in');
          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
            maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true
          };
        },
        onUploadCompleted: async () => {}
      });
      return send(res, 200, out);
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  /* on your own machine files are written to assets/uploads */
  if (p === '/api/admin/upload') {
    const { doc } = await ensureDoc(); db = doc;
    if (!validSession(tokenOf(req))) return send(res, 401, { error: 'Please sign in' });
    const ext = String(url.searchParams.get('ext') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov'].includes(ext)) return send(res, 400, { error: 'File type not allowed' });
    const buf = await readBody(req, 80 * 1024 * 1024);
    if (BLOB) {
      const { put } = require('@vercel/blob');
      const blob = await put(`uploads/${Date.now()}.${ext}`, buf, { access: 'public', addRandomSuffix: true });
      return send(res, 200, { path: blob.url });
    }
    fs.mkdirSync(UPLOADS, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return send(res, 200, { path: 'assets/uploads/' + name });
  }
  return null;
};

/* ===================== the order photo and its page ===================== */
/* the bag draws the order as a picture and sends it here once, with the key
   it was given when the order was made */
const orderPhoto = async (req, res, id, url) => {
  const key = String(url.searchParams.get('key') || '');
  const buf = await readBody(req, 4 * 1024 * 1024);
  const ext = buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : buf[0] === 0x89 && buf[1] === 0x50 ? 'png' : '';
  if (!ext) return send(res, 400, { error: 'Not an image' });
  const find = async () => { const got = await ensureDoc(); db = got.doc; return { ...got, o: db.orders.find(x => x.id === id) }; };
  const first = await find();
  if (!first.o || !key || first.o.photoKey !== key) return send(res, 403, { error: 'Not allowed' });
  if (first.o.photo) return send(res, 200, { photo: first.o.photo });
  let photo;
  if (CLD) {
    try { photo = await cldUpload(buf, 'orders', ext === 'jpg' ? 'image/jpeg' : 'image/png'); }
    catch (e) { return send(res, 502, { error: e.message }); }
  } else if (BLOB) {
    const { put } = require('@vercel/blob');
    photo = (await put(`orders/${id}.${ext}`, buf, { access: 'public', addRandomSuffix: true, contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png' })).url;
  } else {
    fs.mkdirSync(UPLOADS, { recursive: true });
    const name = `order-${id}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    photo = 'assets/uploads/' + name;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const { doc, ver, o } = attempt ? await find() : first;
    if (!o) break;
    o.photo = photo;
    if (await store.saveDoc(doc, ver)) return send(res, 200, { photo });
  }
  return send(res, 409, { error: 'The store is busy — please try again' });
};
const orderPageRoute = async (res, ref, req) => {
  const m = String(ref || '').match(/^(.+)-([0-9a-f]{8})$/);
  const { doc } = await ensureDoc(); db = doc;
  const o = m && db.orders.find(x => x.id === m[1] && x.share === m[2]);
  if (!o) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Order not found'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(out.orderPage(o, out.originOf(req)));
};

/* work that finishes after the answer is sent; on Vercel the function is
   kept alive until it is done */
const background = (task) => {
  const p = Promise.resolve().then(task).catch(e => console.error(e));
  try { require('@vercel/functions').waitUntil(p); } catch {}
};

/* ===================== entry ===================== */
module.exports = async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (!p.startsWith('/api/admin/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    if (p === '/api/admin/blob' || p === '/api/admin/upload') return await uploads(req, res, p, url);
    const ph = p.match(/^\/api\/orders\/([^/]+)\/photo$/);
    if (ph && req.method === 'POST') return await orderPhoto(req, res, decodeURIComponent(ph[1]), url);
    const op = p.match(/^\/(?:api\/)?o\/([^/]+)$/);
    if (op && req.method === 'GET') return await orderPageRoute(res, decodeURIComponent(op[1]), req);

    /* page views go straight to the counters */
    if (req.method === 'POST' && p === '/api/track') {
      const b = await readJSON(req);
      const vid = String(b.vid || '').slice(0, 40);
      if (vid) {
        const { date, h } = cairo();
        await store.track({
          date, h, vid, cty: countryOf(req, b.tz, b.lang),
          first: !!b.first,
          src: b.first ? sourceOf(b.ref, b.utm, req.headers.host) : null,
          product: String(b.product || '').slice(0, 80)
        });
      }
      return send(res, 204, '');
    }

    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJSON(req) : {};
    for (let attempt = 0; attempt < 5; attempt++) {
      const { doc, ver } = await ensureDoc();
      db = doc;
      const ctx = { dirty: false, after: null, later: null };
      const [code, data] = await route(req, p, url, JSON.parse(JSON.stringify(body)), ctx);
      if (ctx.dirty && code < 400) {
        if (!await store.saveDoc(doc, ver)) continue;      // someone saved first — run again on fresh data
        if (ctx.after) await ctx.after();
      }
      const cacheable = req.method === 'GET' && code === 200 && (p === '/api/catalog' || p === '/api/content');
      send(res, code, data, cacheable ? PUBLIC_CACHE : 'no-store');
      if (ctx.later && code < 400) background(ctx.later);
      return;
    }
    return send(res, 409, { error: 'The store is busy — please try again' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'Something went wrong' });
  }
};
