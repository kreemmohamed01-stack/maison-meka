// Adds the Arabic translations in tools/arabic.json to the saved store —
// only where a product, category or text has no Arabic yet, so nothing typed
// in the dashboard is overwritten.
//   node tools/add-arabic.js                          local files
//   node --env-file=.env.local tools/add-arabic.js    the live database
const store = require('../lib/store');
const AR = require('./arabic.json');
const empty = (o) => !o || !Object.values(o).some(v => (Array.isArray(v) ? v.length : String(v || '').trim()));

(async () => {
  for (let i = 0; i < 3; i++) {
    const { doc, ver } = await store.loadDoc();
    if (!doc) return console.log('No data yet.');
    let n = 0;
    doc.products.forEach(p => { if (empty(p.ar) && AR.products[p.id]) { p.ar = AR.products[p.id]; n++; } });
    doc.categories.forEach(c => { if (empty(c.ar) && AR.categories[c.slug]) { c.ar = AR.categories[c.slug]; n++; } });
    if (!doc.content.ar) { doc.content.ar = AR.content; n++; }
    if (!n) return console.log('Arabic already in place.');
    if (await store.saveDoc(doc, ver)) return console.log(`Arabic added to ${n} items (${store.KIND}).`);
  }
  console.log('The store was busy — run it again.');
})().catch(e => { console.error(e); process.exit(1); });
