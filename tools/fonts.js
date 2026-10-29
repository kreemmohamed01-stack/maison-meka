// ===================== Maison Meka — self-hosted fonts ===================== //
/* Downloads the Google fonts the site uses into assets/fonts/, so the pages
   never wait on fonts.googleapis.com / fonts.gstatic.com. Only the latin
   subsets are kept for the English faces (the Arabic file keeps arabic too).

     node tools/fonts.js

   Writes assets/fonts/fonts.css (inlined into every page by the build) and
   assets/fonts/arabic.css (loaded by i18n.js for Arabic visitors). */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SETS = [
  ['fonts.css', 'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Italiana&family=Marcellus&family=Dancing+Script:wght@400;500;600&family=Jost:wght@200;300;400;500;600', ['latin', 'latin-ext'], 'assets/fonts/'],
  ['arabic.css', 'family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700', ['arabic', 'latin', 'latin-ext'], '']
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, query, keep, prefix] of SETS) {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`, { headers: { 'User-Agent': UA } })).text();
    const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face\s*{[^}]+})/g)].filter(m => keep.includes(m[1]));
    let out = '';
    for (const [, , block] of blocks) {
      const url = block.match(/url\(([^)]+)\)/)[1];
      const name = url.split('/').slice(-2).join('-').replace(/[^\w.-]/g, '');
      if (!fs.existsSync(path.join(OUT, name))) fs.writeFileSync(path.join(OUT, name), Buffer.from(await (await fetch(url)).arrayBuffer()));
      out += block.replace(url, prefix + name).replace(/\s+/g, ' ') + '\n';
    }
    fs.writeFileSync(path.join(OUT, file), out);
    console.log(file, blocks.length, 'faces');
  }
})();
