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

/* every stylesheet and script is minified — the same code, fewer bytes */
let esbuild = null;
try { esbuild = require('esbuild'); } catch { console.log('esbuild missing — files are copied unminified'); }
const minifyDir = (dir) => {
  if (!esbuild) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') minifyDir(f); continue; }
    const loader = { '.css': 'css', '.js': 'js' }[path.extname(f)];
    if (!loader) continue;
    try { fs.writeFileSync(f, esbuild.transformSync(fs.readFileSync(f, 'utf8'), { loader, minify: true, charset: 'utf8', legalComments: 'none' }).code); }
    catch (err) { console.log('kept unminified:', f, err.message.split('\n')[0]); }
  }
};
minifyDir(OUT);

/* the fonts live on this site: their @font-face rules are written into each
   page, and the two faces the first screen uses are fetched straight away */
const FONT_CSS = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'fonts.css'), 'utf8');
const fontFile = (family, weight) => {
  const m = FONT_CSS.split('\n').find(l => l.includes(`'${family}'`) && l.includes('font-style: normal') && l.includes(`font-weight: ${weight}`) && l.includes('U+0000-00FF'));
  return m && m.match(/url\(([^)]+)\)/)[1];
};
const FONT_HEAD = ['Jost', 'Italiana'].map((f, i) => fontFile(f, i ? 400 : 300)).filter(Boolean)
  .map(u => `<link rel="preload" href="${u}" as="font" type="font/woff2" crossorigin>`).join('\n') +
  `\n<style>${FONT_CSS.replace(/\n/g, '')}</style>`;

/* a page's own stylesheets are joined into one file, so the first paint
   waits on a single request instead of three or four */
const bundles = new Map();
const bundleCss = (refs) => {
  const code = refs.map(r => fs.readFileSync(path.join(OUT, r), 'utf8')).join('\n');
  const name = 'b-' + crypto.createHash('sha1').update(code).digest('hex').slice(0, 10) + '.css';
  if (!bundles.has(name)) { fs.writeFileSync(path.join(OUT, name), code); bundles.set(name, refs); }
  return name;
};

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
  if (dir === OUT) {
    html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>/, FONT_HEAD);
    html = html.replace(/(?:<link rel="stylesheet" href="[\w.-]+\.css">\s*){2,}/, (block) =>
      `<link rel="stylesheet" href="${bundleCss([...block.matchAll(/href="([^"]+)"/g)].map(m => m[1]))}">\n`);
  }
  html = html.replace(/(href|src)="([^"?#:]+\.(?:css|js))"/g, (m, attr, ref) => {
    const file = path.join(dir, ref);
    return fs.existsSync(file) ? `${attr}="${ref}?v=${stamp(file)}"` : m;
  });
  /* shop pages start the catalogue and the photo store's connection while
     the page is still loading, instead of after their scripts have run */
  if (/products\.js/.test(html) && !html.includes('href="/api/catalog"')) {
    const hints = ['<link rel="preload" href="/api/catalog" as="fetch" crossorigin="anonymous">'];
    if (BLOB_HOST) hints.push(`<link rel="preconnect" href="https://${BLOB_HOST}">`);
    hints.push('<link rel="preconnect" href="https://res.cloudinary.com">');
    html = html.replace('</title>', '</title>\n' + hints.join('\n'));
  }
  fs.writeFileSync(page, html);
}
console.log(`public/ ready — ${pages.length} pages stamped, assets and dashboard copied`);

/* ---------- the first photo of the shop and product pages ----------
   Each page learns its main photo from the catalogue, which arrives after
   the scripts. A small map written into the page lets it ask for that photo
   straight away instead, with the same srcset the page uses — so the browser
   simply reuses it. A photo changed after this deploy is still shown
   correctly; it just is not fetched early until the next deploy. */
const CLD = 'https://res.cloudinary.com/';
const hintScript = (param, fallback, map, sizes) =>
  `<script>(function(){var M=${JSON.stringify(map)};var u=M[new URLSearchParams(location.search).get('${param}')||'${fallback}'];` +
  `if(!u)return;var l=document.createElement('link');l.rel='preload';l.as='image';l.fetchPriority='high';` +
  `if(u.indexOf('~')===0){u='${CLD}'+u.slice(1);var k='/upload/f_auto,q_auto/';` +
  `l.imageSrcset=[320,480,720,1080].map(function(w){return u.replace(k,'/upload/f_auto,q_auto,c_limit,w_'+w+'/')+' '+w+'w'}).join(', ')+', '+u+' 2400w';l.imageSizes='${sizes}';}` +
  `l.href=u;document.head.appendChild(l);})();</script>`;
/* Cloudinary photos are written short (~ stands for the host) and get the
   same widths the pages ask for; any other photo is fetched as it is */
const short = (u) => /^https:\/\/res\.cloudinary\.com\/.+\/upload\/f_auto,q_auto\//.test(u) ? '~' + u.slice(CLD.length) : u;
const heroHints = (doc) => {
  const inject = (file, script) => {
    const f = path.join(OUT, file);
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</title>', '</title>\n' + script));
  };
  const cats = {};
  const all = (doc.content && doc.content.allCategory) || {};
  const allImg = all.banner || all.img || 'assets/cat-potiches.webp';
  cats.all = short(allImg);
  doc.categories.forEach(c => { const u = c.banner || c.img; if (u) cats[c.slug] = short(u); });
  inject('category.html', hintScript('c', 'all', cats, '(max-width:640px) 45vw, 400px'));
  const prods = {};
  doc.products.filter(p => p.active !== false && (p.imgs || [])[0]).forEach(p => { prods[p.id] = short(p.imgs[0]); });
  inject('product.html', hintScript('id', '', prods, '(max-width:900px) 100vw, 55vw'));
  console.log(`early photos — ${Object.keys(cats).length} collections, ${Object.keys(prods).length} products`);
};

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
      heroHints(doc);
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
