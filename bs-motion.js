/* Best Sellers: split-letter title, image curtain reveal, drawn lines,
   staggered 3D card rise, scroll parallax and a soft card tilt. */
(() => {
  const sec = document.getElementById('best');
  if (!sec) return;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const title = sec.querySelector('.bs-title');

  const split = () => {
    const txt = title.textContent.trim();
    if (title.dataset.split === txt) return;
    let i = 0;
    title.innerHTML = txt.split(/\s+/).map(w =>
      `<span class="w">${[...w].map(ch => `<span class="c" style="--i:${i++}">${ch.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</span>`).join('')}</span>`
    ).join(' ');
    title.setAttribute('aria-label', txt);
    title.dataset.split = txt;
  };
  split();
  new MutationObserver(() => { if (!title.querySelector('.c')) split(); }).observe(title, { childList: true });
  if (reduce) { sec.classList.add('on'); return; }

  sec.classList.add('mo');
  sec.querySelectorAll('.bs-arc path, .bs-note-arrow path, .bs-note-arrow polyline').forEach(p => p.setAttribute('pathLength', '1'));

  const track = sec.querySelector('#bsTrack');
  const index = () => track && [...track.querySelectorAll('.bsc')].forEach((c, k) => c.style.setProperty('--k', Math.min(k, 6)));
  index();
  if (track) new MutationObserver(index).observe(track, { childList: true });

  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return;
    sec.classList.add('on'); o.disconnect();
    setTimeout(() => sec.classList.add('settled'), 2600);
  }, { threshold: .18 }).observe(sec);

  /* scroll parallax: photo drifts, cards lag a touch behind each other */
  const img = sec.querySelector('.bs-shape');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const r = sec.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const p = (vh - r.top) / (vh + r.height) - .5;          // -0.5 … 0.5
    img && img.style.setProperty('--py', (p * -60).toFixed(1) + 'px');
    if (sec.classList.contains('settled') && track)
      track.querySelectorAll('.bsc').forEach((c, k) => c.style.setProperty('--lag', (p * (k % 2 ? -18 : 12)).toFixed(1) + 'px'));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* soft 3D tilt + light that follows the pointer */
  if (track && matchMedia('(hover:hover)').matches) {
    track.addEventListener('pointermove', e => {
      const c = e.target.closest('.bsc'); if (!c) return;
      const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      c.style.setProperty('--ry', ((x - .5) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
    });
    track.addEventListener('pointerout', e => {
      const c = e.target.closest('.bsc'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
    });
  }
})();
