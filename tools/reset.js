// ===================== Maison Meka — start from zero ===================== //
/* For launch day (the dashboard's Settings page has the same buttons):

     node tools/reset.js         keep products + categories, clear the demo
                                 orders, customers, coupon uses and statistics
     node tools/reset.js --all   also remove every product and coupon

   It works on whichever storage is configured: the files here, or the
   Redis database when its variables are set. Stop the local server first. */

const store = require('../lib/store');
const all = process.argv.includes('--all');

(async () => {
  for (let i = 0; i < 3; i++) {
    const { doc, ver } = await store.loadDoc();
    if (!doc) { console.log('No data yet.'); return; }
    doc.orders = [];
    doc.coupons.forEach(c => { c.uses = 0; });
    if (all) { doc.products = []; doc.coupons = []; doc.order = { all: [], bestsellers: [], cats: {} }; }
    if (await store.saveDoc(doc, ver)) break;
  }
  await store.resetAnalytics();
  console.log(all ? 'Everything cleared — the store is empty.'
                  : 'Orders, customers and statistics cleared. Products and categories kept.');
})().catch(e => { console.error(e); process.exit(1); });
