// ===================== Maison Meka — Vercel build ===================== //
/* Copies only the public files into public/, which is what Vercel serves.
   The server code, the data and these tools are never published.

   Speed: every stylesheet and script gets a version stamp from its content
   (style.css?v=3f9a1c), so browsers can keep them for a year and still pick
   up a new version the moment it changes. Original PNG/JPG images that have
   a WebP copy are left out — the site only uses the WebP files. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const PRIVATE_JS = new Set(['server.js']);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const hasWebp = (file) => /\.(png|jpe?g)$/i.test(file) && fs.existsSync(file.replace(/\.(png|jpe?g)$/i, '.webp'));
const copyDir = (from, to, skip = () => false) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (skip(src)) continue;
    if (e.isDirectory()) copyDir(src, dst, skip);
    else fs.copyFileSync(src, dst);
  }
};

const pages = [];
for (const f of fs.readdirSync(ROOT)) {
  const ext = path.extname(f).toLowerCase();
  if (['.html', '.css'].includes(ext) || (ext === '.js' && !PRIVATE_JS.has(f))) {
    fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
    if (ext === '.html') pages.push(path.join(OUT, f));
  }
}
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'),
  (p) => p.includes(path.join('assets', 'uploads')) || hasWebp(p) || /insta\.mp4$/.test(p));
copyDir(path.join(ROOT, 'admin'), path.join(OUT, 'admin'));
pages.push(path.join(OUT, 'admin', 'index.html'));

/* where uploaded product photos are served from (vercel_blob_rw_<store>_<secret>) */
const BLOB_HOST = (() => {
  const m = String(process.env.BLOB_READ_WRITE_TOKEN || '').match(/^vercel_blob_rw_([^_]+)_/);
  return m ? m[1].toLowerCase() + '.public.blob.vercel-storage.com' : '';
})();

/* version stamps on every local .css / .js the pages load */
const stamp = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
for (const page of pages) {
  const dir = path.dirname(page);
  let html = fs.readFileSync(page, 'utf8');
  html = html.replace(/(href|src)="([^"?#:]+\.(?:css|js))"/g, (m, attr, ref) => {
    const file = path.join(dir, ref);
    return fs.existsSync(file) ? `${attr}="${ref}?v=${stamp(file)}"` : m;
  });
  /* shop pages start the catalogue and the photo store's connection while
     the page is still loading, instead of after their scripts have run */
  if (/products\.js/.test(html) && !html.includes('href="/api/catalog"')) {
    const hints = ['<link rel="preload" href="/api/catalog" as="fetch" crossorigin="anonymous">'];
    if (BLOB_HOST) hints.push(`<link rel="preconnect" href="https://${BLOB_HOST}">`);
    html = html.replace('<link rel="preconnect"', hints.join('\n') + '\n<link rel="preconnect"');
  }
  fs.writeFileSync(page, html);
}
console.log(`public/ ready — ${pages.length} pages stamped, assets and dashboard copied`);

/* ---------- search engines: robots.txt + a sitemap of every page ---------- */
(async () => {
  const SITE = (process.env.SITE_URL || 'https://maison-meka-lemon.vercel.app').replace(/\/$/, '');
  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  const urls = ['', 'category.html', 'search.html', 'returns.html', 'shipping.html', 'about.html', 'faq.html', 'terms.html', 'privacy.html'];
  try {
    /* the live products and categories, when the database is reachable */
    const store = require('../lib/store');
    const { doc } = await store.loadDoc();
    if (doc) {
      doc.categories.forEach(c => urls.push('category.html?c=' + encodeURIComponent(c.slug)));
      doc.products.filter(p => p.active !== false).forEach(p => urls.push('product.html?id=' + encodeURIComponent(p.id)));
    }
  } catch (e) { console.log('sitemap: pages only (' + e.message + ')'); }
  const today = new Date().toISOString().slice(0, 10);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${SITE}/${u.replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), xml);
  console.log(`sitemap.xml — ${urls.length} pages`);
})();
