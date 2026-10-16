// ===================== Maison Meka — local server ===================== //
/* For running the store on your own machine:  node server.js
   It serves the website and the dashboard as files, and hands every
   /api/... request to lib/app.js — the same code Vercel runs.

     Website    http://localhost:3000
     Dashboard  http://localhost:3000/admin                                  */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const handle = require('./lib/app.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.mp4':'video/mp4', '.webm':'video/webm',
  '.mov':'video/quicktime', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };

/* the server's own code and data are never served as files */
const BLOCKED = /^\/(data|tools|lib|api|node_modules|public|\.vercel)(\/|$)|^\/(server\.js|package\.json|package-lock\.json|vercel\.json|README\.md)$/i;

const serveStatic = (req, res, pathname) => {
  if (pathname === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (BLOCKED.test(pathname)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;
    if (range && type.startsWith('video/')) {
      const [s, e] = range.replace(/bytes=/, '').split('-');
      const start = Number(s) || 0, end = e ? Number(e) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size,
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400' });
    fs.createReadStream(file).pipe(res);
  });
};

http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/o/')) return handle(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, pathname);
}).listen(PORT, () => {
  console.log(`\n  Maison Meka is running`);
  console.log(`  Website    http://localhost:${PORT}`);
  console.log(`  Dashboard  http://localhost:${PORT}/admin\n`);
});
