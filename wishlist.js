// ===================== Maison Meka — wishlist ===================== //

/* The list is kept in the browser under one key, so a piece hearted on the
   search page is still here on the next visit. Each entry carries everything
   a card needs to draw itself: id, name, meta line, price and image. */
const WL_KEY = 'mm-wishlist';

/* localStorage is unavailable in a few contexts (private windows, blocked
   site data), so every read and write is guarded and simply falls back to
   an empty list rather than breaking the page. */
const wlRead = () => {
  try {
    const raw = localStorage.getItem(WL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};
const wlWrite = (list) => {
  try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch {}
};

/* the bag lives under its own key; pieces added here appear in it on every page */
const CART_KEY = 'mm-cart';
const cartAdd = (item) => {
  try {
    /* older saves used the product name as the id — the bag fixes it on load */
    const list = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const have = list.find(i => i.id === item.id);
    if (have) have.qty += 1;
    else list.push({ id: item.id, name: item.name, meta: item.meta || '', price: Number(item.price) || 0, qty: 1, img: item.img });
    localStorage.setItem(CART_KEY, JSON.stringify(list));
  } catch {}
};

const wlMoney = (n) => 'EGP ' + Number(n || 0).toLocaleString('en-US');

document.addEventListener('DOMContentLoaded', () => {

  const grid   = document.getElementById('wlGrid');
  const empty  = document.getElementById('wlEmpty');
  const ledger = document.getElementById('wlLedger');
  const elCount = document.getElementById('wlCount');
  const elTotal = document.getElementById('wlTotal');
  const addAll  = document.getElementById('wlAddAll');
  const clear   = document.getElementById('wlClear');
  const toast   = document.getElementById('wlToast');
  const toastTx = document.getElementById('wlToastText');

  /* ---------- the note that slides up on an action ---------- */
  let toastTimer;
  const say = (msg) => {
    toastTx.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  /* ---------- the intro glides in, piece by piece ---------- */
  const intro = [...document.querySelectorAll('.wl-rise')];
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

  /* ---------- one card ---------- */
  const cardHTML = (item) => `
    <article class="wl-card" data-id="${item.id}">
      <div class="wlc-shot">
        <img src="${item.img}" alt="${item.name}" loading="lazy" decoding="async">
        <span class="wlc-tag">SAVED</span>
        <button class="wlc-drop" aria-label="Remove ${item.name} from wishlist">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.3-4.7-9.6-9.2C.8 7.9 2.2 4.5 5.4 3.7c1.9-.5 3.9.3 5 1.9.4.7 1 1.5 1.6 1.5s1.2-.8 1.6-1.5c1.1-1.6 3.1-2.4 5-1.9 3.2.8 4.6 4.2 3 7.6C19.3 15.8 12 20.5 12 20.5z"/></svg>
        </button>
      </div>
      <div class="wlc-body">
        <h3>${item.name}</h3>
        <p class="wlc-meta">${item.meta || ''}</p>
        <span class="wlc-price">${wlMoney(item.price)}</span>
        <div class="wlc-foot">
          <button class="wlc-add" aria-label="Add ${item.name} to cart">
            <svg viewBox="0 0 24 24"><path d="M5.5 8h13l-1.2 12.2a1.5 1.5 0 01-1.5 1.3H8.2a1.5 1.5 0 01-1.5-1.3z"/><path d="M8.8 8V6.2a3.2 3.2 0 016.4 0V8"/></svg>
            <span>ADD TO CART</span>
          </button>
        </div>
      </div>
    </article>`;

  /* ---------- draw the whole list ---------- */
  const render = (animate = true) => {
    const list = wlRead();

    elCount.textContent = list.length;
    elTotal.textContent = wlMoney(list.reduce((s, i) => s + Number(i.price || 0), 0));

    const bare = list.length === 0;
    empty.classList.toggle('show', bare);
    ledger.style.display = bare ? 'none' : '';
    addAll.disabled = bare;
    clear.disabled = bare;

    grid.innerHTML = list.map(cardHTML).join('');
    [...grid.querySelectorAll('.wl-card')].forEach(c => {
      if (animate) io.observe(c);
      else c.classList.add('in');
    });
  };

  /* the first wave waits for the intro to finish before it starts */
  render(true);

  /* ---------- remove + add to cart ---------- */
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.wl-card');
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.closest('.wlc-drop')) {
      const list = wlRead();
      const gone = list.find(i => i.id === id);
      wlWrite(list.filter(i => i.id !== id));
      // the card folds away first, then the list redraws under it
      card.classList.add('leaving');
      setTimeout(() => render(false), 460);
      say(gone ? `${gone.name} removed` : 'Removed');
      return;
    }

    const add = e.target.closest('.wlc-add');
    if (add) {
      add.classList.add('added');
      setTimeout(() => add.classList.remove('added'), 900);
      const item = wlRead().find(i => i.id === id);
      if (item) { cartAdd(item); if (window.mmFlyToBag) window.mmFlyToBag(); }
      say(item ? `${item.name} added to your bag` : 'Added to cart');
    }
  });

  /* ---------- move everything to the cart ---------- */
  addAll.addEventListener('click', () => {
    const n = wlRead().length;
    if (!n) return;
    wlRead().forEach(cartAdd);
    [...grid.querySelectorAll('.wlc-add')].forEach((b, i) => {
      setTimeout(() => {
        b.classList.add('added');
        setTimeout(() => b.classList.remove('added'), 900);
      }, i * 90);
    });
    say(`${n} ${n === 1 ? 'piece' : 'pieces'} added to cart`);
  });

  /* ---------- clear the list ---------- */
  clear.addEventListener('click', () => {
    if (!wlRead().length) return;
    const cards = [...grid.querySelectorAll('.wl-card')];
    cards.forEach((c, i) => setTimeout(() => c.classList.add('leaving'), i * 70));
    wlWrite([]);
    setTimeout(() => render(false), cards.length * 70 + 460);
    say('Wishlist cleared');
  });

});
