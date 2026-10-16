// ===================== Maison Meka — coupon popup ===================== //
/* When a coupon is set to "Show as popup" in the dashboard, it appears in the
   middle of the screen once a visitor has spent one minute on the site
   (across pages). Each visitor sees a given code once. "Copy code" copies it
   and the bag applies it on its own. */

MM_READY.then(() => {
  const c = typeof POPUP !== 'undefined' ? POPUP : null;
  if (!c) return;
  const SEEN = 'mm-popup-seen';
  try { if (localStorage.getItem(SEEN) === c.code) return; } catch { return; }

  /* one minute on the site, counted from the first page of the visit */
  let t0 = Date.now();
  try {
    t0 = Number(sessionStorage.getItem('mm-t0')) || t0;
    sessionStorage.setItem('mm-t0', String(t0));
  } catch {}
  const wait = Math.max(1500, 60000 - (Date.now() - t0));

  const money = (n) => 'EGP ' + Number(n || 0).toLocaleString('en-US');
  const headline = c.type === 'percentage' ? `${c.value}% OFF`
                 : c.type === 'fixed' ? `${money(c.value)} OFF` : 'FREE SHIPPING';
  const endTxt = c.end ? new Date(c.end + 'T12:00:00').toLocaleDateString(window.MM_LANG === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }) : '';

  const show = () => {
    /* never over the intro film, an open bag or menu */
    if (document.documentElement.classList.contains('intro-on') ||
        document.querySelector('.cart-drawer.open, .side-menu.open')) { setTimeout(show, 8000); return; }
    try { localStorage.setItem(SEEN, c.code); } catch {}

    const box = document.createElement('div');
    box.className = 'cp-pop';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `
      <div class="cp-card">
        <button class="cp-x" aria-label="Close"><svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
        <div class="cp-top">
          <i class="cp-dot d1"></i><i class="cp-dot d2"></i><i class="cp-dot d3"></i><i class="cp-dot d4"></i><i class="cp-dot d5"></i><i class="cp-dot d6"></i>
          <span class="cp-gift"><svg viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19v-3h-19z"/><line x1="12" y1="6" x2="12" y2="20.5"/><path d="M12 6C10.5 3 7 2.6 6.5 4.6S9.5 6 12 6zM12 6c1.5-3 5-3.4 5.5-1.4S14.5 6 12 6z"/></svg></span>
          <p class="cp-kicker">A gift for you</p>
          <p class="cp-head">${headline}</p>
        </div>
        <div class="cp-body">
          <p class="cp-sub">Use this code on your order</p>
          <div class="cp-code" data-no-i18n>${c.code}</div>
          <p class="cp-terms">${c.minOrder ? `Minimum order ${money(c.minOrder)}` : 'On any order'}${endTxt ? ` · Valid until ${endTxt}` : ''}</p>
          <button class="cp-copy"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/></svg><span>Copy code</span></button>
          <button class="cp-later">Continue shopping</button>
        </div>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('in'));

    const close = () => { box.classList.remove('in'); setTimeout(() => box.remove(), 400); };
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    box.querySelector('.cp-x').onclick = close;
    box.querySelector('.cp-later').onclick = close;
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    box.querySelector('.cp-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(c.code); } catch {}
      try { localStorage.setItem('mm-coupon-auto', c.code); } catch {}
      box.querySelector('.cp-copy span').textContent = 'Copied!';
      if (window.MM && MM.toast) MM.toast('Code copied — it will be applied in your bag');
      setTimeout(close, 900);
    };
  };
  setTimeout(show, wait);
});
