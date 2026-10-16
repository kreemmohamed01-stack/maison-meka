// ===================== Maison Meka — search page ===================== //

document.addEventListener('DOMContentLoaded', () => MM_READY.then(() => {

  const grid  = document.getElementById('spGrid');

  /* the results come from the live catalogue, so every product added in the
     dashboard can be found here */
  if (PRODUCTS.length) {
    grid.innerHTML = PRODUCTS.map(p => {
      const cat = MM.homeCat(p);
      const meta = [cat ? cat.name : '', p.dims].filter(Boolean).join('  •  ');
      return `
      <article class="sp-card" data-price="${p.price}" data-name="${MM.esc(p.name)}" data-id="${MM.esc(p.id)}">
        <div class="spc-shot mm-sq" style="${MM.fitStyle(p)}">
          <a href="product.html?id=${encodeURIComponent(p.id)}">${MM.squareImg(p)}</a>
          <button class="spc-fav" aria-label="Add to favourites">${MM.ICON.heart}</button>
        </div>
        <div class="spc-body">
          <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${MM.esc(p.name)}</a></h3>
          <p class="spc-meta">${MM.esc(meta)}</p>
          <div class="spc-foot">
            <span class="spc-price">${MM.money(p.price)}</span>
            <button class="spc-add" aria-label="Add to cart" ${p.stock ? '' : 'disabled'}>${MM.ICON.plus}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  } else grid.innerHTML = '';
  const input = document.getElementById('spInput');
  const sort  = document.getElementById('spSort');
  const count = document.getElementById('spCount');
  const cards = [...grid.querySelectorAll('.sp-card')];
  count.textContent = cards.length;

  /* ---------- the page assembles itself, piece by piece ---------- */
  // header, bar and meta row glide in first, in document order
  const intro = [...document.querySelectorAll('.sp-rise')];
  intro.forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), 180 + i * 150);
  });

  /* ---------- cards drift in as they reach the viewport ---------- */
  const io = new IntersectionObserver((entries) => {
    const wave = entries.filter(e => e.isIntersecting).map(e => e.target);
    wave.forEach((el, i) => {
      io.unobserve(el);
      setTimeout(() => el.classList.add('in'), Math.min(i, 8) * 110);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

  // the first row waits for the intro to finish before it starts
  setTimeout(() => cards.forEach(c => io.observe(c)), 180 + intro.length * 150);

  /* ---------- filter + sort ---------- */
  const apply = () => {
    const q = input.value.trim().toLowerCase();

    let shown = 0;
    cards.forEach(card => {
      const hay = (card.dataset.name + ' ' + card.querySelector('.spc-meta').textContent)
        .toLowerCase();
      const hit = !q || hay.includes(q);
      card.classList.toggle('hidden', !hit);
      if (hit) {
        shown++;
        // a card revealed by a search should not stay invisible
        card.classList.add('in');
        io.unobserve(card);
      }
    });

    count.textContent = shown;
    grid.classList.toggle('is-empty', shown === 0);
  };

  const reorder = () => {
    const mode = sort.value;
    const ordered = [...cards].sort((a, b) => {
      if (mode === 'low')  return a.dataset.price - b.dataset.price;
      if (mode === 'high') return b.dataset.price - a.dataset.price;
      if (mode === 'name') return a.dataset.name.localeCompare(b.dataset.name);
      return 0;                                   // relevance keeps document order
    });
    ordered.forEach(c => grid.appendChild(c));
  };

  input.addEventListener('input', apply);
  document.getElementById('spForm').addEventListener('submit', apply);
  sort.addEventListener('change', () => { reorder(); apply(); });

  /* ---------- favourites: kept in the same store the wishlist page reads ---------- */
  const WL_KEY = 'mm-wishlist';
  const wlRead = () => {
    try {
      const list = JSON.parse(localStorage.getItem(WL_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  };
  const wlWrite = (list) => {
    try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch {}
  };
  // the card's name doubles as its id — it is what the wishlist keys on
  const idOf = (card) => card.dataset.id || card.dataset.name;

  // hearts already saved come back filled on every visit
  const saved = new Set(wlRead().map(i => i.id));
  cards.forEach(card => {
    if (saved.has(idOf(card))) card.querySelector('.spc-fav').classList.add('on');
  });

  /* ---------- favourites + add to cart ---------- */
  grid.addEventListener('click', (e) => {
    const fav = e.target.closest('.spc-fav');
    if (fav) {
      const card = fav.closest('.sp-card');
      const id   = idOf(card);
      const list = wlRead();
      const on   = fav.classList.toggle('on');

      if (on) {
        if (!list.some(i => i.id === id)) {
          list.push({
            id,
            name:  card.dataset.name,
            meta:  card.querySelector('.spc-meta').textContent.trim(),
            price: Number(card.dataset.price),
            img:   card.querySelector('.spc-shot img').getAttribute('src')
          });
          wlWrite(list);
        }
      } else {
        wlWrite(list.filter(i => i.id !== id));
      }
      return;
    }

    const add = e.target.closest('.spc-add');
    if (add && !add.disabled) {
      const p = MM.byId(add.closest('.sp-card').dataset.id);
      if (p) { MM.addToBag(p, 1); MM.toast(p.name + ' added to your bag'); }
      add.classList.add('added');
      setTimeout(() => add.classList.remove('added'), 900);
    }
  });

  /* ---------- filters button (placeholder for a future panel) ---------- */
  document.getElementById('spFilters').addEventListener('click', () => {
    input.focus();
  });

}));
