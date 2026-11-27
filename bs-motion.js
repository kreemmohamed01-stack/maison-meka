/* Home motion: Best Sellers (scroll-scrubbed photo window, outlined marquee,
   blur-in words, cards swinging in) and Shop by Category (curtain-wipe tiles,
   columns drifting at different speeds, pointer glow). */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* split an element's words into blur-in spans; re-split if its text is replaced later */
  const words = (el, start = 0) => {
    if (!el) return;
    const run = () => {
      if (el.querySelector('.mw')) return;
      const html = el.innerHTML.trim(); if (!html) return;
      let i = start;
      el.innerHTML = html.split(/(<br\s*\/?>)/i).map(part => /^<br/i.test(part) ? part :
        part.trim().split(/\s+/).filter(Boolean).map(w => `<span class="mw" style="--i:${i++}">${w}</span>`).join(' ')).join('');
    };
    run();
    new MutationObserver(run).observe(el, { childList: true });
  };
  const watch = (el, target, cls, th, cb) => el && new IntersectionObserver((es, o) => {
    if (es[0].isIntersecting) { target.classList.add(cls); o.disconnect(); cb && cb(); }
  }, { threshold: th }).observe(el);

  /* ---------- 02 · Best Sellers ---------- */
  const bs = document.getElementById('best');
  const track = bs && bs.querySelector('#bsTrack');
  if (bs) {
    words(bs.querySelector('.bs-title'));
    if (reduce) bs.classList.add('m-on');
    else {
      bs.classList.add('mo');
      bs.querySelectorAll('.bs-arc path').forEach(p => p.setAttribute('pathLength', '1'));
      const mq = document.createElement('div'); mq.className = 'bs-marq'; mq.setAttribute('aria-hidden', 'true');
      mq.innerHTML = '<span>' + 'Best Sellers ✦ Most Loved ✦ '.repeat(4) + '</span>';
      bs.prepend(mq);
      const idx = () => track && [...track.querySelectorAll('.bsc')].forEach((c, k) => c.style.setProperty('--k', Math.min(k, 6)));
      idx(); if (track) new MutationObserver(idx).observe(track, { childList: true });
      watch(bs, bs, 'm-on', .15, () => setTimeout(() => bs.classList.add('m-done'), 2400));
    }
  }

  /* ---------- 03 · Shop by Category ---------- */
  const col = document.getElementById('collections');
  if (col) {
    words(col.querySelector('.collections-intro .kicker'));
    words(col.querySelector('.collections-title'), 2);
    if (reduce) col.classList.add('m-on');
    else watch(col.querySelector('.collections-intro'), col, 'm-on', .3);
  }
  if (reduce) return;

  /* ---------- scroll-driven pieces ---------- */
  const shape = bs && bs.querySelector('.bs-shape');
  const marq = bs && bs.querySelector('.bs-marq span');
  let last = scrollY, vel = 0, drift = 0;
  const frame = () => {
    const vh = innerHeight;
    vel = vel * .85 + (scrollY - last) * .15; last = scrollY;
    if (bs) {
      const r = bs.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const e = clamp((vh - r.top) / (vh * .85), 0, 1);           // entry 0 → 1
        const p = (vh - r.top) / (vh + r.height);                     // pass 0 → 1
        const ease = 1 - Math.pow(1 - e, 3);
        bs.style.setProperty('--e', ease.toFixed(3));
        if (shape) {
          shape.style.setProperty('--rad', (ease * 150).toFixed(1) + '%');
          shape.style.setProperty('--sc', (1.3 - ease * .22 + p * .08).toFixed(3));
        }
        if (marq) {
          drift -= .6 + Math.abs(vel) * .35;
          const w = marq.offsetWidth / 4; if (w && -drift > w) drift += w;
          marq.style.transform = `translate3d(${drift.toFixed(1)}px,0,0)`;
        }
        if (track && bs.classList.contains('m-done')) bs.style.setProperty('--tx', ((.5 - p) * 70).toFixed(1) + 'px');
      }
    }
    if (col) {
      const r = col.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = (vh - r.top) / (vh + r.height) - .5;
        const lanes = innerWidth > 760 ? [0, 40, -20, 60] : [0, 30];
        col.querySelectorAll('.cat-card').forEach((c, k) => c.style.setProperty('--cy', (p * lanes[k % lanes.length]).toFixed(1) + 'px'));
      }
    }
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } }, { passive: true });
  /* the marquee keeps gliding while Best Sellers is on screen */
  if (bs) new IntersectionObserver(es => {
    bs._vis = es[0].isIntersecting;
    if (bs._vis && !bs._run) { bs._run = true; (function g() { if (!bs._vis) { bs._run = false; return; } frame(); requestAnimationFrame(g); })(); }
  }).observe(bs);
  frame();

  /* pointer: tilt + light on best-seller cards, glow on category tiles */
  if (matchMedia('(hover:hover)').matches) {
    const follow = (root, sel, tilt) => root && root.addEventListener('pointermove', e => {
      const c = e.target.closest(sel); if (!c) return;
      const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
      if (tilt) { c.style.setProperty('--ry', ((x - .5) * 8).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg'); }
    });
    follow(track, '.bsc', true);
    follow(col, '.cat-card', false);
    if (track) track.addEventListener('pointerout', e => {
      const c = e.target.closest('.bsc'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
    });
  }
})();
