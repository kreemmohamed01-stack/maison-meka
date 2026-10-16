// Sets the new Best Sellers section text (English + Arabic) — only where the
// old default text is still in place, so wording typed in the dashboard stays.
//   node tools/update-best-content.js                         local files
//   node --env-file=.env.local tools/update-best-content.js   the live database
const store = require('../lib/store');
const AR = require('./arabic.json');
const EN = { kicker: 'OUR FAVORITES', title: 'Best Sellers', desc: 'The most loved pieces, chosen by our community to bring beauty and warmth into every home.', button: 'Shop Best Sellers' };
const OLD_TITLES = ['BEST SELLERS', 'الأكثر مبيعاً', ''];

(async () => {
  for (let i = 0; i < 3; i++) {
    const { doc, ver } = await store.loadDoc();
    if (!doc) return console.log('No data yet.');
    const b = doc.content.best || {};
    if (OLD_TITLES.includes(b.title || '') && !b.kicker) doc.content.best = { ...EN };
    doc.content.ar = doc.content.ar || {};
    const ab = doc.content.ar.best || {};
    if (!ab.kicker) doc.content.ar.best = { ...AR.content.best };
    if (await store.saveDoc(doc, ver)) return console.log(`Best Sellers text updated (${store.KIND}).`);
  }
  console.log('The store was busy — run it again.');
})().catch(e => { console.error(e); process.exit(1); });
