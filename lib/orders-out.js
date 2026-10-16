// ===================== Maison Meka — orders, outward ===================== //
/* What leaves the store when someone orders:

     • an email to the store's Gmail with the order (set on Vercel by
       GMAIL_USER and GMAIL_APP_PASSWORD; ORDER_EMAIL_TO, if set, receives it
       instead of GMAIL_USER). Without them, no email is sent.
     • the order's own page, /o/<order>-<code>: the photo of the order with a
       preview Instagram shows in the chat when the customer pastes the link. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const money = (n) => 'EGP ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const abs = (origin, src) => !src ? '' : /^https?:/.test(src) ? src : origin + '/' + String(src).replace(/^\/+/, '');

/* the address the customer and the email see, e.g. https://maison-meka-lemon.vercel.app */
const originOf = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${String(proto).split(',')[0]}://${host}`;
};
const orderLink = (origin, o) => `${origin}/o/${encodeURIComponent(o.id)}-${o.share}`;

/* ---------- the email ---------- */
let transport = null;
const mailer = () => {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: pass.replace(/\s+/g, '') } });
  }
  return transport;
};

const sendOrderEmail = async (o, origin) => {
  const t = mailer();
  if (!t) return;
  const rows = o.items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee5d6;width:72px"><img src="${esc(abs(origin, it.img))}" width="60" height="60" style="display:block;width:60px;height:60px;object-fit:cover;border-radius:8px" alt=""></td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee5d6">
        <b style="color:#23201c">${esc(it.name)}</b>${it.variant ? `<br><span style="color:#8f897e">${esc(it.variant)}</span>` : ''}
        <br><span style="color:#8f897e">${money(it.price)} × ${it.qty}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #eee5d6;text-align:right;white-space:nowrap"><b>${money(it.price * it.qty)}</b></td>
    </tr>`).join('');
  const line = (l, v, bold) => `<tr><td style="padding:4px 0;color:${bold ? '#23201c' : '#5b564d'};${bold ? 'font-weight:600;font-size:17px' : ''}">${l}</td><td style="padding:4px 0;text-align:right;${bold ? 'font-weight:600;font-size:17px' : ''}">${v}</td></tr>`;
  const html = `
  <div style="background:#f5f1e8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#23201c">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
      <p style="margin:0;color:#a98a52;letter-spacing:2px;font-size:11px">MAISON MEKA · NEW ORDER</p>
      <h1 style="margin:6px 0 2px;font-family:Georgia,serif;font-weight:500;font-size:28px">Order ${esc(o.id)}</h1>
      <p style="margin:0 0 16px;color:#8f897e">${new Date(o.date).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' })} · Cairo time</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        ${line('Subtotal', money(o.subtotal))}
        ${o.discount ? line(`Discount${o.coupon ? ' (' + esc(o.coupon) + ')' : ''}`, '- ' + money(o.discount)) : ''}
        ${line('Total', money(o.total), true)}
      </table>
      <p style="margin:20px 0 0">
        <a href="${esc(origin)}/admin/#/orders?open=${encodeURIComponent(o.id)}" style="display:inline-block;background:#3d5a35;color:#fff;text-decoration:none;padding:11px 18px;border-radius:999px">Open in the dashboard</a>
        <a href="${esc(orderLink(origin, o))}" style="display:inline-block;margin-left:8px;color:#3d5a35">Order photo</a>
      </p>
      <p style="margin:16px 0 0;color:#8f897e;font-size:12px">The customer is sent to Instagram to complete the order by direct message.</p>
    </div>
  </div>`;
  const text = [`New order ${o.id}`, ...o.items.map(it => `- ${it.name}${it.variant ? ' (' + it.variant + ')' : ''} × ${it.qty} = ${money(it.price * it.qty)}`),
    o.discount ? `Discount: -${money(o.discount)}` : '', `Total: ${money(o.total)}`, '', `${origin}/admin/#/orders?open=${o.id}`].filter(Boolean).join('\n');
  const from = process.env.GMAIL_USER;
  /* an order never waits long on the email */
  await Promise.race([
    t.sendMail({ from: `"Maison Meka Website" <${from}>`, to: process.env.ORDER_EMAIL_TO || from,
      subject: `New order ${o.id} · ${money(o.total)}`, text, html }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('email timed out')), 9000))
  ]).catch(e => console.error('Order email failed:', e.message));
};

/* ---------- the order's page ---------- */
const orderPage = (o, origin) => {
  const img = o.photo ? abs(origin, o.photo) : abs(origin, (o.items[0] || {}).img);
  const title = `Maison Meka · Order ${o.id}`;
  const desc = o.items.map(it => `${it.name} × ${it.qty}`).join(' · ') + ` — Total ${money(o.total)}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Maison Meka">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(orderLink(origin, o))}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">` : ''}
<style>
  body{ margin:0; background:#f5f1e8; color:#23201c; font:15px/1.5 Arial,Helvetica,sans-serif; }
  main{ max-width:560px; margin:0 auto; padding:28px 16px 40px; text-align:center; }
  h1{ font:500 28px Georgia,serif; margin:0 0 4px; }
  p{ margin:0 0 18px; color:#5b564d; }
  img{ display:block; width:100%; height:auto; border-radius:14px; box-shadow:0 10px 30px rgba(35,32,28,.1); background:#fff; }
  ul{ list-style:none; padding:0; margin:0 0 18px; text-align:left; background:#fff; border-radius:14px; padding:6px 16px; }
  li{ display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #eee5d6; }
  li:last-child{ border:0; font-weight:600; }
  a.btn{ display:inline-block; margin-top:22px; padding:12px 22px; border-radius:999px; background:#23201c; color:#fff; text-decoration:none; }
</style></head>
<body><main>
  <h1>Order ${esc(o.id)}</h1>
  <p>Maison Meka</p>
  ${o.photo ? `<img src="${esc(abs(origin, o.photo))}" alt="Order ${esc(o.id)}">` : `
  <ul>${o.items.map(it => `<li><span>${esc(it.name)}${it.variant ? ' (' + esc(it.variant) + ')' : ''} × ${it.qty}</span><span>${money(it.price * it.qty)}</span></li>`).join('')}
    ${o.discount ? `<li style="font-weight:400"><span>Discount</span><span>- ${money(o.discount)}</span></li>` : ''}
    <li><span>Total</span><span>${money(o.total)}</span></li></ul>`}
  <a class="btn" href="${esc(origin)}/">Visit Maison Meka</a>
</main></body></html>`;
};

module.exports = { originOf, orderLink, sendOrderEmail, orderPage };
