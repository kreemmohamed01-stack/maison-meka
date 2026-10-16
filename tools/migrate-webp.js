// Points the saved store (products, categories, content) at the WebP images
// made by tools/optimize.py. Safe to run more than once.
//   node tools/migrate-webp.js                          local files
//   node --env-file=.env.local tools/migrate-webp.js    the live database
const store = require('../lib/store');
const map = require('./webp-map.json');

(async () => {
  for (let i = 0; i < 3; i++) {
    const { doc, ver } = await store.loadDoc();
    if (!doc) return console.log('No data yet.');
    let text = JSON.stringify(doc), n = 0;
    for (const [from, to] of Object.entries(map)) {
      const parts = text.split(from);
      n += parts.length - 1;
      text = parts.join(to);
    }
    if (!n) return console.log('Already up to date.');
    if (await store.saveDoc(JSON.parse(text), ver)) return console.log(`${n} image paths updated (${store.KIND}).`);
  }
  console.log('The store was busy — run it again.');
})().catch(e => { console.error(e); process.exit(1); });
