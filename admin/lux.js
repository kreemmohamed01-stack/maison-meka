// ===================== Maison Meka — dashboard, in depth ===================== //
/* Motion over the dashboard, without touching how anything works:

     • each page flies in, piece by piece, when you open it from the menu
     • tiles and cards lean toward the pointer in 3D, with a soft sheen

   Cards that hold fields, drag-to-reorder lists, the cropper, the framing
   square or a chart never tilt, so typing, dragging and reading stay still.
   Nothing runs for people who ask for less motion. */

(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const view = document.getElementById('view');
  if (!view) return;

  /* ---------- entrances: once per page, not on every redraw ----------
     (the same page with a new filter, e.g. ?tab=, does not fly in again) */
  const PIECES = '.ph, .hello, .back, .utabs, .tabs, .toolbar, .arrange-bar, .kpis > *, .card, .list, .empty, .save-bar';
  let shownFor = null;
  const enter = () => {
    const key = location.hash.split('?')[0] || '#/';
    if (key === shownFor) return;
    shownFor = key;
    const picked = [];
    view.querySelectorAll(PIECES).forEach(el => {
      if (picked.length >= 30) return;
      if (picked.some(p => p.contains(el))) return;   // a piece inside a moving piece already moves
      picked.push(el);
    });
    picked.forEach((el, i) => {
      el.animate([
        { opacity: 0, transform: 'perspective(1200px) rotateX(10deg) translate3d(0, 34px, -40px) scale(.97)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 700, delay: Math.min(i, 14) * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
  };
  new MutationObserver(() => requestAnimationFrame(enter)).observe(view, { childList: true });

  /* ---------- numbers count up when they arrive ---------- */
  /* the tiles get their figures after the statistics load; each new figure
     runs up from zero and ends on exactly the text the dashboard wrote */
  const COUNTED = '.kpi b';
  const countUp = (el) => {
    const final = el.textContent;
    const m = final.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    if (!(target > 0)) return;
    const decimals = (m[2].split('.')[1] || '').length;
    const t0 = performance.now(), dur = Math.min(1600, 700 + Math.log10(target + 1) * 180);
    el.classList.add('lux-counting');
    const job = el.__luxJob = {};
    const step = (now) => {
      if (el.__luxJob !== job) return;            // a newer figure took over
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      const n = target * e;
      el.__luxLast = k < 1
        ? m[1] + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + m[3]
        : final;
      el.textContent = el.__luxLast;
      if (k < 1) requestAnimationFrame(step); else el.classList.remove('lux-counting');
    };
    requestAnimationFrame(step);
  };
  new MutationObserver((muts) => {
    const seen = new Set();
    muts.forEach(mu => {
      const node = mu.target.nodeType === 1 ? mu.target : mu.target.parentElement;
      if (!node) return;
      const hits = node.matches && node.matches(COUNTED) ? [node] : [...(node.querySelectorAll ? node.querySelectorAll(COUNTED) : [])];
      /* our own frames are skipped: the text is the one we just wrote */
      hits.forEach(el => { if (el.textContent !== el.__luxLast) seen.add(el); });
    });
    seen.forEach(countUp);
  }).observe(view, { childList: true, subtree: true, characterData: true });

  /* ---------- 3D tilt toward the pointer ---------- */
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const STILL = 'input, select, textarea, [contenteditable], .sortable, .imgs, .chart, .donut-wrap, .fit-sq, .crop-stage, table, canvas, .rte, .handle, .menu-wrap';
  const canTilt = (el) => el.matches('.kpi, .login-card') || (el.matches('.card') && !el.querySelector(STILL) && !el.closest('.modal'));
  const MAX = { '.kpi': 9, '.login-card': 5, '.card': 3.2 };
  const maxOf = (el) => el.matches('.kpi') ? MAX['.kpi'] : el.matches('.login-card') ? MAX['.login-card'] : MAX['.card'];

  let cur = null, raf = 0, last = null;
  const release = (el) => {
    el.classList.remove('lux-on');
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--ty', '0px');
    setTimeout(() => {
      if (el === cur) return;
      el.classList.remove('lux-tilt');
      ['--rx', '--ry', '--ty', '--gx', '--gy'].forEach(p => el.style.removeProperty(p));
      const g = el.querySelector(':scope > .lux-glare'); if (g) g.remove();
    }, 320);
  };
  const paint = () => {
    raf = 0;
    if (!cur || !last) return;
    const r = cur.getBoundingClientRect();
    const px = (last.clientX - r.left) / r.width, py = (last.clientY - r.top) / r.height;
    const m = maxOf(cur);
    cur.style.setProperty('--ry', ((px - 0.5) * 2 * m).toFixed(2) + 'deg');
    cur.style.setProperty('--rx', ((0.5 - py) * 2 * m).toFixed(2) + 'deg');
    cur.style.setProperty('--ty', cur.matches('.kpi') ? '-6px' : '-4px');
    cur.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    cur.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  };
  document.addEventListener('pointermove', (e) => {
    if (e.buttons) return;                       // never while dragging something
    last = e;
    const el = e.target.closest && e.target.closest('.kpi, .login-card, .card');
    const next = el && canTilt(el) ? el : null;
    if (next !== cur) {
      if (cur) release(cur);
      cur = next;
      if (cur) {
        cur.classList.add('lux-tilt', 'lux-on');
        if (!cur.querySelector(':scope > .lux-glare')) {
          const g = document.createElement('span'); g.className = 'lux-glare'; g.setAttribute('aria-hidden', 'true');
          cur.appendChild(g);
        }
      }
    }
    if (cur && !raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerdown', () => { if (cur) { release(cur); cur = null; } }, true);
  document.addEventListener('pointerleave', () => { if (cur) { release(cur); cur = null; } });
})();
