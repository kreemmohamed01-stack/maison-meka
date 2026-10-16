// ===================== Maison Meka — demo data ===================== //
/* Builds data/db.json from the current catalogue plus DEMO orders, coupons
   and statistics, so the dashboard has something to show.

     node tools/seed.js          rebuild everything with demo data
     node tools/reset.js         keep the catalogue, clear orders + statistics
     node tools/reset.js --all   start completely empty                    */

const crypto = require('crypto');
const seed = require('./seed-catalog.json');
const AR = require('./arabic.json');

/* the dashboard sign-in; on Vercel these can be overridden with the
   MM_ADMIN_USER / MM_ADMIN_PASSWORD environment variables */
const ADMIN_USER = process.env.MM_ADMIN_USER || 'maison1111';
const ADMIN_PASSWORD = process.env.MM_ADMIN_PASSWORD || 'maison1111';
const hashPw = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
};

/* a seeded random, so the demo looks the same every time it is rebuilt */
let s = 20261007;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));

const CARD = { tableaux: 'assets/c-tableaux.webp', jardiniere: 'assets/c-jardinere.webp' };

const build = () => {
s = 20261007;
const categories = seed.CATEGORIES.map((c, i) => ({
  slug: c.slug, name: c.name, desc: c.desc, img: c.img,
  card: CARD[c.slug] || `assets/c-${c.slug}.png`,
  banner: '', parent: '', nav: true, featured: true, order: i + 1,
  ar: AR.categories[c.slug] || {}
}));

const products = seed.PRODUCTS.map((p, i) => {
  const stock = p.stock === false ? 0 : p.low ? 3 : between(8, 40);
  return {
    id: p.id, slug: p.id, name: p.name, active: true,
    cats: p.cats, tags: [p.material.toLowerCase(), 'home decor'],
    price: p.price, salePrice: 0, costPrice: Math.round(p.price * 0.55 / 50) * 50,
    discount: { on: false, type: 'percentage', value: 0, start: '', end: '' },
    couponAllowed: true,
    labels: {
      featured: i < 4, bestseller: p.badge === 'Bestseller' || i < 5,
      newArrival: p.badge === 'New', onSale: false, limited: false
    },
    material: p.material, dims: p.dims || '',
    imgs: p.imgs, video: '', banner: '',
    desc: p.desc, shortDesc: '', details: p.details || [], care: p.care || '',
    trackInventory: true, stock, lowAlert: 5,
    sku: `MM-${p.cats[0].slice(0, 4).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, barcode: '',
    weight: '', length: '', width: '', height: '', shippingClass: 'fragile',
    colors: [], sizes: [],
    seo: { title: '', description: '' },
    ar: AR.products[p.id] || {},
    added: Date.now() - (10 - i) * 86400000
  };
});
/* one demo product on sale, so the offer flow can be seen on the site */
const owls = products.find(p => p.id === 'murano-owls');
if (owls) { owls.labels.onSale = true; owls.discount = { on: true, type: 'percentage', value: 15, start: '', end: '' }; }

const now = Date.now(), DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

const coupons = [
  { id: 'c_maison20',  code: 'MAISON20',  type: 'percentage', value: 20,  start: iso(now - 6 * DAY), end: iso(now + 24 * DAY), minOrder: 500,  active: true, uses: 14 },
  { id: 'c_welcome10', code: 'WELCOME10', type: 'percentage', value: 10,  start: '', end: '', minOrder: 300, active: true, uses: 31 },
  { id: 'c_freeship',  code: 'FREESHIP',  type: 'freeship',   value: 0,   start: '', end: '', minOrder: 800, active: true, uses: 9 },
  { id: 'c_ramadan15', code: 'RAMADAN15', type: 'fixed',      value: 150, start: iso(now + 150 * DAY), end: iso(now + 180 * DAY), minOrder: 1000, active: false, uses: 0 }
];

/* ---------- demo orders ---------- */
const FIRST = ['Mariam', 'Nour', 'Salma', 'Yasmin', 'Hana', 'Farida', 'Laila', 'Dina', 'Rana', 'Omar', 'Karim', 'Ahmed', 'Youssef', 'Mona', 'Heba', 'Aya', 'Sara', 'Mostafa'];
const LAST = ['Hassan', 'El Sayed', 'Mahmoud', 'Fahmy', 'Nabil', 'Shawky', 'Kamel', 'Adel', 'Saleh', 'Mansour', 'Fouad', 'Rizk'];
const CITIES = ['Cairo', 'Giza', 'New Cairo', 'Sheikh Zayed', 'Alexandria', '6th of October', 'Maadi', 'Heliopolis', 'Mansoura'];
const people = Array.from({ length: 46 }, () => ({
  name: `${pick(FIRST)} ${pick(LAST)}`,
  phone: '01' + pick(['0', '1', '2', '5']) + String(between(10000000, 99999999)),
  city: pick(CITIES)
}));
const orders = [];
for (let i = 0; i < 150; i++) {
  const t = now - Math.pow(rnd(), 1.4) * 95 * DAY;
  const who = pick(people);
  const items = Array.from({ length: rnd() < 0.75 ? 1 : 2 }, () => {
    const p = pick(products);
    return { id: p.id, name: p.name, variant: '', price: p.price, qty: rnd() < 0.85 ? 1 : 2, img: p.imgs[0] };
  });
  const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
  const useCoupon = rnd() < 0.18;
  const discount = useCoupon ? Math.round(subtotal * 0.1) : 0;
  const age = (now - t) / DAY;
  const status = age < 1.5 ? pick(['pending', 'pending', 'confirmed'])
               : age < 5 ? pick(['confirmed', 'shipped', 'shipped'])
               : pick(['delivered', 'delivered', 'delivered', 'delivered', 'cancelled', 'returned']);
  orders.push({
    id: '', date: new Date(t).toISOString(), ...who, note: '',
    items, subtotal, coupon: useCoupon ? 'WELCOME10' : '', discount, total: subtotal - discount,
    status, stockApplied: false
  });
}
orders.sort((a, b) => b.date.localeCompare(a.date));
orders.forEach((o, i) => { o.id = 'MM-' + (1001 + orders.length - 1 - i); });

/* ---------- demo statistics: a year of daily visits ---------- */
const days = {};
const SRC = [['instagram', 38], ['google', 28], ['direct', 18], ['tiktok', 10], ['others', 6]];
const CTY = [['EG', 62], ['SA', 12], ['US', 8], ['AE', 6], ['XX', 12]];
const HOURS = [2, 1, 1, 1, 1, 2, 3, 5, 7, 8, 9, 10, 11, 11, 10, 10, 11, 12, 14, 15, 14, 11, 7, 4];
const split = (total, weights) => {
  const sum = weights.reduce((a, [, w]) => a + w, 0);
  const out = {};
  weights.forEach(([k, w]) => { out[k] = Math.max(0, Math.round(total * w / sum * (0.85 + rnd() * 0.3))); });
  return out;
};
for (let d = 400; d >= 0; d--) {
  const t = now - d * DAY;
  const date = new Date(t);
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const trend = 600 + (400 - d) * 4.2;
  const weekend = [4, 5].includes(date.getDay()) ? 1.25 : 1;
  const v = Math.round(trend * weekend * (0.8 + rnd() * 0.4));
  const hSum = HOURS.reduce((a, b) => a + b, 0);
  const prod = {};
  products.forEach(p => { prod[p.id] = Math.round(v * (0.02 + rnd() * 0.06)); });
  days[k] = {
    v, pv: Math.round(v * (2.2 + rnd())),
    h: HOURS.map(w => Math.round(v * w / hSum * (0.8 + rnd() * 0.4))),
    src: split(v * 0.7, SRC), cty: split(v, CTY), prod
  };
}
/* today is still in progress */
const todayKey = Object.keys(days).pop();
const hourNow = new Date().getHours();
days[todayKey].h = days[todayKey].h.map((x, i) => i <= hourNow ? x : 0);
days[todayKey].v = days[todayKey].h.reduce((a, b) => a + b, 0);

const db = {
  settings: { storeName: 'Maison Meka', instagram: 'https://www.instagram.com/maisonmeka2', previewFill: true, adminUser: ADMIN_USER, adminHash: hashPw(ADMIN_PASSWORD) },
  sessions: {},
  categories, products, coupons, orders,
  order: {
    all: products.map(p => p.id),
    bestsellers: products.filter(p => p.labels.bestseller).map(p => p.id),
    cats: {}
  },
  content: {
    hero: {
      eyebrow: 'CURATED', title: 'HOME ART', script: 'Elegance in every detail.',
      desc: 'Timeless pieces chosen to bring character, beauty, and elegance into your space.',
      button: 'SHOP THE COLLECTION'
    },
    collections: { kicker: 'EXPLORE OUR COLLECTION', title: 'Shop by Category', desc: 'Curated pieces to elevate every corner of your home' },
    best: { kicker: 'OUR FAVORITES', title: 'Best Sellers', desc: 'The most loved pieces, chosen by our community to bring beauty and warmth into every home.', button: 'Shop Best Sellers' },
    allCategory: seed.ALL_CATEGORY,
    ar: AR.content
  },
};
return { doc: db, days };
};

module.exports = { build, ADMIN_USER };

/* run directly: writes the demo data to whichever storage is configured
   (files here, or the Redis database when its variables are set) */
if (require.main === module) {
  (async () => {
    const store = require('../lib/store');
    const { doc, days } = build();
    const { ver } = await store.loadDoc();
    if (!await store.saveDoc(doc, ver)) throw new Error('Could not save — try again');
    await store.seedAnalytics(days);
    console.log(`Demo data written (${store.KIND}). Dashboard sign-in: ${ADMIN_USER} / ${ADMIN_PASSWORD}`);
  })().catch(e => { console.error(e); process.exit(1); });
}
