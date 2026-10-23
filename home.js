// ===================== Maison Meka — home page ===================== //
/* The hero copy, the category grid and the best sellers all come from the
   dashboard. The HTML keeps a static version underneath, so the page still
   reads well for the split second before the data arrives. */

document.addEventListener('DOMContentLoaded', () => {

  const $ = (sel) => document.querySelector(sel);

  /* the Instagram video loads only when it comes near the screen, and pauses
     when it leaves — nothing is downloaded for visitors who never reach it */
  const vid = $('.insta-phone video[data-src]');
  if (vid && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!vid.src) { vid.src = vid.dataset.src; vid.load(); }
        vid.play().catch(() => {});
      } else if (vid.src) vid.pause();
    }, { rootMargin: '300px 0px' }).observe(vid);
  }
  const setText = (sel, text) => { const el = $(sel); if (el && text) el.textContent = text; };

  /* ---------- hero + section copy ---------- */
  MM_READY.then(() => CONTENT).then(c => {
    if (c.hero) {
      setText('.hero-eyebrow', c.hero.eyebrow);
      setText('.hero-title .line', c.hero.title);
      setText('.hero-script', c.hero.script);
      setText('.hero-desc', c.hero.desc);
      setText('.btn-shop .bs-label', c.hero.button);
    }
    if (c.collections) {
      setText('.collections-intro .kicker', c.collections.kicker);
      setText('.collections-title', c.collections.title);
      setText('.collections-desc', c.collections.desc);
    }
    if (c.best) {
      setText('.bs-title', c.best.title);
      setText('.bs-desc', c.best.desc);
      setText('.bs-kicker', c.best.kicker);
      setText('.bs-btn span', c.best.button);
    }
  }).catch(() => {});

  MM_READY.then(() => {
    const reveal = (els) => { if (window.mmReveal) window.mmReveal(els); else els.forEach(e => e.classList.add('in')); };

    /* ---------- shop by category: the categories marked "featured" ---------- */
    const grid = $('.cat-grid');
    const cats = CATEGORIES_ALL.filter(c => c.featured);
    if (grid && cats.length) {
      /* the grid closes on two wide cards; a third leftover runs full width under them */
      const rem = cats.length % 4;
      const fullAt = rem === 3 ? cats.length - 1 : -1;
      const wideFrom = rem === 2 ? cats.length - 2 : rem === 3 ? cats.length - 3 : cats.length;
      grid.innerHTML = cats.map((c, i) => `
        <a href="category.html?c=${encodeURIComponent(c.slug)}" class="cat-card${i === fullAt ? ' cat-full' : i >= wideFrom ? ' cat-wide' : ''}">
          <span class="cat-head"><span class="cat-num">${String(i + 1).padStart(2, '0')}</span></span>
          <span class="cat-shot"><img src="${MM.esc(c.card || c.img)}" alt="${MM.esc(c.name)}"></span>
          <span class="cat-label"><span class="cat-name">${MM.esc(c.name)}</span></span>
        </a>`).join('');
      reveal(grid.querySelectorAll('.cat-card'));
    }

    /* ---------- best sellers: a sliding row, in the dashboard's order ---------- */
    const track = $('#bsTrack');
    const list = BESTSELLERS.map(id => MM.byId(id)).filter(Boolean).slice(0, 12);
    if (track && list.length) {
      const CART = '<svg viewBox="0 0 24 24"><path d="M3 4h2.2l2.1 11.2a1.6 1.6 0 001.6 1.3h8.6a1.6 1.6 0 001.6-1.2L21 8H6.1"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M12 8.8v4.4M9.8 11h4.4"/></svg>';
      track.innerHTML = list.map((p, i) => {
        const href = 'product.html?id=' + encodeURIComponent(p.id);
        const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
        const badge = off ? `<span class="bsc-badge sale">Sale ${off}%</span>`
                    : p.badge ? `<span class="bsc-badge">${MM.esc(p.badge)}</span>` : '';
        const tint = off ? 't-pink' : (i % 3 === 2 ? 't-sage' : '');
        const st = MM.status(p);
        return `
          <article class="bsc" data-id="${MM.esc(p.id)}">
            <a class="bsc-shot mm-sq" href="${href}" style="${MM.fitStyle(p)}">${MM.squareImg(p)}</a>
            ${badge}
            <button class="bsc-fav${MM.wlHas(p.id) ? ' on' : ''}" aria-label="Save to wishlist">${MM.ICON.heart}</button>
            <div class="bsc-body">
              <h3 class="bsc-name"><a href="${href}">${MM.esc(p.name)}</a></h3>
              <p class="bsc-price${off ? ' sale' : ''}"><b>${MM.money(p.price)}</b>${off ? `<s>${MM.money(p.compareAt)}</s>` : ''}</p>
              <button class="bsc-add ${tint}${st === 'low' ? ' is-low' : ''}" ${st === 'out' ? 'disabled' : ''}>${CART}<span>${st === 'out' ? 'Sold Out' : 'Add to Cart'}</span></button>
            </div>
          </article>`;
      }).join('');

      track.addEventListener('click', (e) => {
        const card = e.target.closest('.bsc'); if (!card) return;
        const p = MM.byId(card.dataset.id); if (!p) return;
        const fav = e.target.closest('.bsc-fav');
        if (fav) {
          const on = MM.wlToggle(p);
          fav.classList.toggle('on', on);
          MM.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist', on ? 'VIEW' : '', () => { location.href = 'wishlist.html'; });
          return;
        }
        const add = e.target.closest('.bsc-add');
        if (add && !add.disabled) {
          MM.addToBag(p, 1);
          add.classList.add('added');
          add.querySelector('span').textContent = 'Added';
          setTimeout(() => { add.classList.remove('added'); add.querySelector('span').textContent = 'Add to Cart'; }, 1600);
          MM.toast(p.name + ' added to your bag', 'VIEW BAG', MM.openBag);
        }
      });

      /* arrows move one card; dots show and jump between pages */
      const prev = $('#bsPrev'), next = $('#bsNext'), dots = $('#bsDots');
      const rtl = document.documentElement.dir === 'rtl';
      const cards = () => [...track.querySelectorAll('.bsc')];
      const step = () => { const c = cards(); return c.length > 1 ? Math.abs(c[1].offsetLeft - c[0].offsetLeft) : track.clientWidth; };
      const perPage = () => Math.max(1, Math.round(track.clientWidth / step()));
      const pages = () => Math.max(1, Math.ceil(cards().length - perPage() + 1));
      const pos = () => Math.abs(track.scrollLeft);
      const paint = () => {
        const n = pages(), cur = Math.min(n - 1, Math.round(pos() / step()));
        if (dots.children.length !== n) {
          dots.innerHTML = Array.from({ length: n }, (_, i) => `<button aria-label="Go to ${i + 1}"></button>`).join('');
        }
        [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
        prev.disabled = pos() < 4;
        next.disabled = pos() >= track.scrollWidth - track.clientWidth - 4;
        dots.hidden = n < 2;
        /* the arrows sit level with the middle of the photos */
        const shot = track.querySelector('.bsc-shot');
        if (shot) track.parentElement.style.setProperty('--navy', (shot.offsetTop + shot.offsetHeight / 2) + 'px');
      };
      const go = (dir) => track.scrollBy({ left: dir * step() * (rtl ? -1 : 1), behavior: 'smooth' });
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
      dots.addEventListener('click', (e) => {
        const i = [...dots.children].indexOf(e.target.closest('button'));
        if (i >= 0) track.scrollTo({ left: i * step() * (rtl ? -1 : 1), behavior: 'smooth' });
      });
      let raf;
      track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
      window.addEventListener('resize', paint);
      paint();
      reveal(cards());
    }
  });
});
