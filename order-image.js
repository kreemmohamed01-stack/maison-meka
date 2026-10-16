// ===================== Maison Meka — order photo ===================== //
/* "Save order photo" in the bag: draws a clean picture of what the customer
   has chosen — each piece with its photo, quantity and price, the discount
   and the total — so they can send it to us with their message. On a phone
   it opens the share sheet (Instagram, WhatsApp…); elsewhere it downloads. */

/* with { blob: true } it only returns the picture, as a JPEG file, without
   sharing it — used to attach the photo to the order itself */
window.mmOrderImage = async function (items, totals, opts = {}) {
  const AR = window.MM_LANG === 'ar';
  const T = (en, ar) => (AR ? ar : en);
  const money = (n) => AR ? `${Math.round(n).toLocaleString('en-US')} ج.م` : `EGP ${Math.round(n).toLocaleString('en-US')}`;
  const serif = AR ? 'Amiri, serif' : '"Cormorant Garamond", Georgia, serif';
  const sans = AR ? 'Tajawal, sans-serif' : 'Jost, sans-serif';
  try { await document.fonts.ready; } catch {}

  const load = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const photos = await Promise.all(items.map(i => load(i.img)));

  const W = 1080, PAD = 72, ROW = 190;
  const H = 360 + items.length * ROW + 300;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.direction = AR ? 'rtl' : 'ltr';
  const L = AR ? W - PAD : PAD;           // start edge
  const R = AR ? PAD : W - PAD;           // end edge
  const startAlign = AR ? 'right' : 'left';
  const endAlign = AR ? 'left' : 'right';

  /* paper */
  c.fillStyle = '#f6f1e8'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(169,138,82,.45)'; c.lineWidth = 2;
  c.strokeRect(28, 28, W - 56, H - 56);

  /* house mark */
  c.fillStyle = '#23201c'; c.textAlign = 'center';
  c.font = `500 64px ${serif}`; c.fillText(AR ? 'ميزون ميكا' : 'MAISON MEKA', W / 2, 130);
  c.fillStyle = '#a98a52'; c.font = `400 22px ${sans}`;
  c.fillText(AR ? 'فن المنزل' : 'H O M E   A R T', W / 2, 170);

  /* title + date */
  c.fillStyle = '#23201c'; c.textAlign = startAlign;
  c.font = `500 44px ${serif}`;
  c.fillText(totals.orderId ? `${T('Order', 'طلب')} ${totals.orderId}` : T('My Order', 'طلبي'), L, 260);
  c.fillStyle = '#7a7266'; c.font = `400 24px ${sans}`; c.textAlign = endAlign;
  c.fillText(new Date().toLocaleDateString(AR ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), R, 260);
  c.fillStyle = 'rgba(35,32,28,.15)'; c.fillRect(PAD, 296, W - PAD * 2, 2);

  /* the pieces */
  let y = 330;
  const fit = (text, max) => { let t = String(text); while (c.measureText(t).width > max && t.length > 3) t = t.slice(0, -2); return t === String(text) ? t : t + '…'; };
  items.forEach((it, i) => {
    const S = 140;
    const px = AR ? W - PAD - S : PAD;
    c.save();
    c.beginPath(); c.roundRect ? c.roundRect(px, y, S, S, 18) : c.rect(px, y, S, S); c.clip();
    c.fillStyle = '#e9e1d2'; c.fillRect(px, y, S, S);
    const ph = photos[i];
    if (ph) { const r = Math.max(S / ph.width, S / ph.height); const w = ph.width * r, h = ph.height * r; c.drawImage(ph, px + (S - w) / 2, y + (S - h) / 2, w, h); }
    c.restore();
    const tx = AR ? W - PAD - S - 30 : PAD + S + 30;
    c.textAlign = startAlign;
    c.fillStyle = '#23201c'; c.font = `500 36px ${serif}`;
    c.fillText(fit(it.name, 520), tx, y + 50);
    c.fillStyle = '#7a7266'; c.font = `400 24px ${sans}`;
    if (it.meta) c.fillText(fit(it.meta, 520), tx, y + 88);
    c.fillText(`${it.qty} × ${money(it.price)}`, tx, y + 128);
    c.textAlign = endAlign; c.fillStyle = '#23201c'; c.font = `600 30px ${sans}`;
    c.fillText(money(it.price * it.qty), R, y + 88);
    y += ROW;
    if (i < items.length - 1) { c.fillStyle = 'rgba(35,32,28,.08)'; c.fillRect(PAD, y - 24, W - PAD * 2, 2); }
  });

  /* totals */
  c.fillStyle = 'rgba(35,32,28,.15)'; c.fillRect(PAD, y, W - PAD * 2, 2);
  y += 56;
  const line = (label, value, bold) => {
    c.textAlign = startAlign; c.fillStyle = bold ? '#23201c' : '#5b564d'; c.font = `${bold ? 600 : 400} ${bold ? 34 : 26}px ${sans}`;
    c.fillText(label, L, y);
    c.textAlign = endAlign; c.fillText(value, R, y);
    y += bold ? 60 : 46;
  };
  line(T('Subtotal', 'المجموع الفرعي'), money(totals.subtotal));
  if (totals.discountLabel) line(totals.discountLabel, totals.discountValue);
  line(T('Total', 'الإجمالي'), money(totals.total), true);

  /* foot */
  c.textAlign = 'center'; c.fillStyle = '#a98a52'; c.font = `400 24px ${sans}`;
  c.fillText(T('Send this to us on Instagram · @maisonmeka2', 'أرسل هذه الصورة لنا على إنستجرام · @maisonmeka2'), W / 2, H - 70);
  if (totals.orderId) {
    c.fillStyle = '#7a7266'; c.font = `400 20px ${sans}`;
    c.fillText(T(`Order number: ${totals.orderId}`, `رقم الطلب: ${totals.orderId}`), W / 2, H - 110);
  }

  if (opts.blob) return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.86));

  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `maison-meka-order-${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Maison Meka' }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
};
