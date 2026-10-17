// ===================== Maison Meka dashboard — core ===================== //
/* The pieces every page uses: talking to the server, small UI helpers, the
   image cropper, drag-to-reorder, and the charts. */

const TOKEN_KEY = 'mm-admin-token';
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const money = (n) => 'EGP ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtDate = (d, withTime) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) +
    (withTime ? ' · ' + dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '');
};
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '');
const clone = (o) => JSON.parse(JSON.stringify(o));
/* flag images rather than emoji, which Windows shows as two letters */
const flag = (cc) => cc && cc !== 'XX' && cc.length === 2
  ? `<img class="flag" src="https://flagcdn.com/w40/${cc.toLowerCase()}.png" alt="${cc}" loading="lazy">`
  : '<span class="flag flag-globe">🌍</span>';
const site = (p) => p ? (/^(https?:|data:|blob:)/.test(p) ? p : '../' + p.replace(/^\/+/, '')) : '';

/* ---------- icons ---------- */
const I = {
  home:'<svg viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/></svg>',
  orders:'<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><line x1="8.5" y1="8.5" x2="15.5" y2="8.5"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15.5" x2="12.5" y2="15.5"/></svg>',
  box:'<svg viewBox="0 0 24 24"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5"/><line x1="12" y1="12" x2="12" y2="21"/></svg>',
  cats:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8"/><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2"/></svg>',
  ticket:'<svg viewBox="0 0 24 24"><path d="M3.5 8.5V6.5a1 1 0 011-1h15a1 1 0 011 1v2a2.5 2.5 0 000 5v2a1 1 0 01-1 1h-15a1 1 0 01-1-1v-2a2.5 2.5 0 000-5z"/><line x1="9.5" y1="9" x2="14.5" y2="15"/><circle cx="9.5" cy="9.5" r=".6"/><circle cx="14.5" cy="14.5" r=".6"/></svg>',
  tag:'<svg viewBox="0 0 24 24"><path d="M20.5 13l-7.5 7.5-9.5-9.5V3.5H11z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  page:'<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2"/><line x1="3.5" y1="9" x2="20.5" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16.5" x2="13" y2="16.5"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16" y2="16"/></svg>',
  dots:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg>',
  x:'<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  back:'<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/></svg>',
  grip:'<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/></svg>',
  sort:'<svg viewBox="0 0 24 24"><path d="M7 4v16"/><polyline points="3.5 7.5 7 4 10.5 7.5"/><path d="M17 20V4"/><polyline points="13.5 16.5 17 20 20.5 16.5"/></svg>',
  filter:'<svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="17" x2="14" y2="17"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 00-4-4L4 16z"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6 7l1 13h10l1-13"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  crop:'<svg viewBox="0 0 24 24"><path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/></svg>',
  up:'<svg viewBox="0 0 24 24"><polyline points="6 15 12 9 18 15"/></svg>',
  down:'<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
  top:'<svg viewBox="0 0 24 24"><line x1="5" y1="4" x2="19" y2="4"/><polyline points="7 13 12 8 17 13"/><line x1="12" y1="8" x2="12" y2="20"/></svg>',
  bag:'<svg viewBox="0 0 24 24"><path d="M5.5 8h13l-1.2 12.2a1.5 1.5 0 01-1.5 1.3H8.2a1.5 1.5 0 01-1.5-1.3z"/><path d="M8.8 8V6.2a3.2 3.2 0 016.4 0V8"/></svg>',
  img:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/></svg>',
  video:'<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="13" height="13" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>'
};

/* ---------- server ---------- */
const api = async (method, url, body) => {
  const opts = { method, headers: { Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') } };
  if (body instanceof Blob) { opts.body = body; }
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(url, opts);
  if (r.status === 401 && !url.endsWith('/login')) { localStorage.removeItem(TOKEN_KEY); location.reload(); throw new Error('Signed out'); }
  const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};
/* uploads: on Vercel the file goes straight from the browser to Blob storage
   (so large videos are fine); on your own machine it goes to the server */
let UPLOAD_MODE = 'local';
const BLOB_CLIENT = 'https://esm.sh/@vercel/blob@2.8.1/client';
const upload = async (blob, ext) => {
  /* Cloudinary: the server signs, the browser sends the file straight there */
  if (UPLOAD_MODE === 'cloudinary') {
    const s = await api('POST', '/api/admin/cld-sign', {});
    const form = new FormData();
    form.append('file', blob, 'upload.' + ext);
    ['api_key', 'timestamp', 'folder', 'signature'].forEach(k => form.append(k, k === 'api_key' ? s.apiKey : s[k]));
    const r = await fetch('https://api.cloudinary.com/v1_1/' + s.cloud + '/auto/upload', { method: 'POST', body: form });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || 'Upload failed');
    /* photos and videos are delivered in the best format and quality for each device */
    return d.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  if (UPLOAD_MODE === 'blob') {
    const { upload: blobUpload } = await import(BLOB_CLIENT);
    const name = `uploads/${Date.now()}.${ext}`;
    const out = await blobUpload(name, blob, {
      access: 'public', handleUploadUrl: '/api/admin/blob',
      clientPayload: localStorage.getItem(TOKEN_KEY) || '',
      contentType: blob.type || (ext === 'mp4' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg')
    });
    return out.url;
  }
  return (await api('POST', '/api/admin/upload?ext=' + ext, blob)).path;
};

/* ---------- toast + modal ---------- */
let toastT;
const toast = (msg, bad) => {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
};
const modal = {
  open(html, wide) {
    const card = $('#modalCard');
    card.className = 'modal-card' + (wide ? ' wide' : '');
    card.innerHTML = html;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
    return card;
  },
  close() {
    $('#modal').hidden = true;
    $('#modalCard').innerHTML = '';
    document.body.style.overflow = '';
    if (modal.onClose) { const f = modal.onClose; modal.onClose = null; f(); }
  }
};
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') modal.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) modal.close(); });

const confirmBox = (title, text, okLabel = 'Delete', danger = true) => new Promise(res => {
  const c = modal.open(`
    <div class="modal-h"><h2>${esc(title)}</h2></div>
    <p class="muted">${esc(text)}</p>
    <div class="modal-f">
      <button class="btn" data-no>Cancel</button>
      <button class="btn ${danger ? 'btn-solid-red' : 'btn-green'}" data-ok>${esc(okLabel)}</button>
    </div>`);
  modal.onClose = () => res(false);
  c.querySelector('[data-no]').onclick = () => modal.close();
  c.querySelector('[data-ok]').onclick = () => { modal.onClose = null; modal.close(); res(true); };
});

/* pick file(s) from the device */
const pickFiles = (accept, multiple) => new Promise(res => {
  const inp = $('#filePick');
  inp.value = ''; inp.accept = accept; inp.multiple = !!multiple;
  inp.onchange = () => res([...inp.files]);
  inp.click();
});

/* ---------- the ⋯ menu ---------- */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) $$('.menu').forEach(m => m.remove());
});
const openMenu = (anchor, items) => {
  $$('.menu').forEach(m => m.remove());
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}${esc(it.label)}</button>`).join('');
  anchor.closest('.menu-wrap').appendChild(m);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    e.stopPropagation();
    m.remove();
    items[Number(b.dataset.i)].run();
  });
};

/* ===================== image cropper ===================== */
/* Pan and zoom the photo inside a frame of the chosen shape; what is inside
   the frame becomes the image used on the website. */
const RATIOS = [
  { k:'1:1', v:1 }, { k:'4:5', v:4/5 }, { k:'3:4', v:3/4 }, { k:'4:3', v:4/3 }, { k:'16:9', v:16/9 }, { k:'Original', v:0 }, { k:'Free', v:0 }
];
const cropImage = (source, opts = {}) => new Promise((resolve) => {
  const ratios = opts.ratios ? RATIOS.filter(r => r.k === 'Free' || opts.ratios.includes(r.k)) : RATIOS;
  /* opens on the whole photo — nothing is cut until you pull an edge or pick a shape */
  let ratio = ratios.find(r => r.k === 'Free') || ratios[0];
  const isFile = source instanceof Blob;
  const url = isFile ? URL.createObjectURL(source) : site(source);
  const isPng = isFile ? source.type === 'image/png' : /\.png(\?|$)/i.test(source);

  const c = modal.open(`
    <div class="modal-h"><h2>${esc(opts.title || 'Crop image')}</h2><button class="icon-btn" data-x>${I.x}</button></div>
    <div class="crop-stage" id="cropStage"><div class="crop-box" id="cropBox"><div class="crop-frame" id="cropFrame"><img id="cropImg" alt=""></div>${['n','s','e','w','nw','ne','sw','se'].map(d => `<i class="crop-h h-${d}" data-h="${d}"></i>`).join('')}</div></div>
    <div class="crop-tools">
      <div class="ratios">${ratios.map(r => `<button data-r="${r.k}" class="${r === ratio ? 'on' : ''}">${r.k}</button>`).join('')}</div>
      <input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
    </div>
    <p class="hint" style="margin-top:8px">Drag the photo to position it · drag the edges or corners to crop · use the slider or pinch to zoom.</p>
    <div class="modal-f">
      ${isFile ? '<button class="btn" data-orig>Use without cropping</button>' : ''}
      ${opts.original ? '<button class="btn" data-reset>Reset to original</button>' : ''}
      <button class="btn" data-x>Cancel</button>
      <button class="btn btn-green" data-ok>Use this crop</button>
    </div>`, true);
  modal.onClose = () => resolve(null);

  const stage = $('#cropStage', c), box = $('#cropBox', c), frame = $('#cropFrame', c), img = $('#cropImg', c), zoom = $('#cropZoom', c);
  let iw = 0, ih = 0, fw = 0, fh = 0, fx = 0, fy = 0, base = 1, z = 1, tx = 0, ty = 0;

  const clamp = () => {
    const s = base * z;
    tx = Math.min(0, Math.max(fw - iw * s, tx));
    ty = Math.min(0, Math.max(fh - ih * s, ty));
  };
  const paint = () => { clamp(); img.style.transform = `translate(${tx}px,${ty}px) scale(${base * z})`; };
  const place = () => Object.assign(box.style, { left: fx + 'px', top: fy + 'px', width: fw + 'px', height: fh + 'px' });
  const layout = () => {
    const r = ratio.v || iw / ih;
    const sw = stage.clientWidth * 0.9, sh = stage.clientHeight * 0.9;
    fw = Math.min(sw, sh * r); fh = fw / r;
    fx = (stage.clientWidth - fw) / 2; fy = (stage.clientHeight - fh) / 2;
    place();
    base = Math.max(fw / iw, fh / ih);
    tx = (fw - iw * base * z) / 2; ty = (fh - ih * base * z) / 2;
    paint();
  };
  img.onload = () => { iw = img.naturalWidth; ih = img.naturalHeight; img.style.width = iw + 'px'; img.style.height = ih + 'px'; layout(); };
  if (!isFile) img.crossOrigin = 'anonymous';   // photos on another server — so the crop can be saved
  img.src = url;

  const setZoom = (nz, cx = fw / 2, cy = fh / 2) => {
    nz = Math.min(4, Math.max(1, nz));
    const s0 = base * z, s1 = base * nz;
    tx = cx - (cx - tx) * s1 / s0; ty = cy - (cy - ty) * s1 / s0;
    z = nz; zoom.value = z; paint();
  };
  zoom.oninput = () => setZoom(Number(zoom.value));
  frame.addEventListener('wheel', (e) => { e.preventDefault(); const r = frame.getBoundingClientRect(); setZoom(z * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

  const pts = new Map();
  let last = null, pinch = null;
  frame.addEventListener('pointerdown', (e) => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { x: e.clientX, y: e.clientY }; pinch = null; });
  frame.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) setZoom(pinch.z * d / pinch.d); else pinch = { d, z };
      return;
    }
    tx += e.clientX - last.x; ty += e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    paint();
  });
  /* the edges and corners: pull them in to cut the photo, like on a phone —
     the photo stays where it is and only the frame changes */
  const setRatio = (k) => { ratio = ratios.find(x => x.k === k); $$('[data-r]', c).forEach(b => b.classList.toggle('on', b.dataset.r === k)); };
  $$('[data-h]', c).forEach(h => {
    let st = null;
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); h.setPointerCapture(e.pointerId);
      const s = base * z;
      st = { x: e.clientX, y: e.clientY, L: fx, T: fy, R: fx + fw, B: fy + fh,
             iL: fx + tx, iT: fy + ty, iR: fx + tx + iw * s, iB: fy + ty + ih * s };
      if (ratio.k !== 'Free') setRatio('Free');
    });
    h.addEventListener('pointermove', (e) => {
      if (!st) return;
      const d = h.dataset.h, dx = e.clientX - st.x, dy = e.clientY - st.y, MIN = 40;
      let { L, T, R, B } = st;
      if (d.includes('w')) L = Math.min(R - MIN, Math.max(st.iL, 0, L + dx));
      if (d.includes('e')) R = Math.max(L + MIN, Math.min(st.iR, stage.clientWidth, R + dx));
      if (d.includes('n')) T = Math.min(B - MIN, Math.max(st.iT, 0, T + dy));
      if (d.includes('s')) B = Math.max(T + MIN, Math.min(st.iB, stage.clientHeight, B + dy));
      fx = L; fy = T; fw = R - L; fh = B - T;
      tx = st.iL - fx; ty = st.iT - fy;
      place(); paint();
    });
    const end = () => { st = null; };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });

  const up = (e) => { pts.delete(e.pointerId); pinch = null; if (pts.size === 1) last = [...pts.values()][0]; };
  frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);

  c.addEventListener('click', (e) => {
    const r = e.target.closest('[data-r]');
    if (r) { ratio = ratios.find(x => x.k === r.dataset.r); $$('[data-r]', c).forEach(b => b.classList.toggle('on', b === r)); z = 1; zoom.value = 1; layout(); return; }
    if (e.target.closest('[data-x]')) { modal.close(); return; }
    /* back to the photo exactly as it was first uploaded */
    if (e.target.closest('[data-reset]')) { modal.onClose = null; modal.close(); resolve({ reset: true }); return; }
    if (e.target.closest('[data-orig]')) {
      modal.onClose = null; modal.close();
      /* the whole photo, as it is — only made lighter */
      shrinkImage(source, PHOTO_MAX, 0.86).then(resolve, () => resolve({ blob: source, ext: (source.name.split('.').pop() || 'jpg').toLowerCase() }));
      return;
    }
    if (e.target.closest('[data-ok]')) {
      const s = base * z;
      const sx = -tx / s, sy = -ty / s, sw = fw / s, sh = fh / s;
      const ow = Math.round(Math.min(1800, sw)), oh = Math.round(ow * fh / fw);
      const cv = document.createElement('canvas');
      cv.width = ow; cv.height = oh;
      const ctx = cv.getContext('2d');
      if (!isPng && !CAN_WEBP) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ow, oh); }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
      encodeCanvas(cv, 0.86, isPng).then((blob) => {
        modal.onClose = null; modal.close();
        if (isFile) URL.revokeObjectURL(url);
        resolve({ blob, ext: extOf(blob), cropped: true });
      });
    }
  });
});

/* ===================== photos, made light ===================== */
/* Every photo is saved as WebP (JPEG where the browser cannot make WebP) and
   no larger than the site needs. Product photos also get a small copy for
   the cards, so a page of products loads a fraction of the bytes. */
const CAN_WEBP = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp'); } catch { return false; } })();
const PHOTO_MAX = 1800, THUMB_MAX = 640;
const encodeCanvas = (cv, q, keepPng) => new Promise(r => cv.toBlob(r,
  CAN_WEBP ? 'image/webp' : keepPng ? 'image/png' : 'image/jpeg', q));
const extOf = (blob) => ({ 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif' })[blob.type] || 'jpg';
const shrinkImage = async (src, max, q) => {
  const blob = src instanceof Blob ? src : await (await fetch(src, { mode: 'cors' })).blob();
  if (blob.type === 'image/gif') return { blob, ext: 'gif' };          // animations stay as they are
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * s)); cv.height = Math.max(1, Math.round(img.naturalHeight * s));
    const ctx = cv.getContext('2d');
    const png = blob.type === 'image/png';
    if (!CAN_WEBP && !png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const out = await encodeCanvas(cv, q, png);
    /* never send a "lighter" copy that came out heavier */
    return out && out.size < blob.size ? { blob: out, ext: extOf(out) } : { blob, ext: extOf(blob) };
  } finally { URL.revokeObjectURL(url); }
};
/* the small copy a product card shows; returns its path */
const uploadThumb = async (src) => {
  const t = await shrinkImage(src, THUMB_MAX, 0.8);
  return upload(t.blob, t.ext);
};

/* choose a photo from the device, crop it, upload it — returns its path */
const chooseImage = async (opts = {}) => {
  const [file] = await pickFiles('image/*');
  if (!file) return null;
  const out = await cropImage(file, opts);
  if (!out) return null;
  toast('Uploading…');
  const p = await upload(out.blob, out.ext);
  toast('Image uploaded');
  return p;
};
const recrop = async (path, opts = {}) => {
  const out = await cropImage(path, opts);
  if (!out) return null;
  const p = await upload(out.blob, out.ext);
  toast('Image updated');
  return p;
};

/* ===================== drag to reorder ===================== */
/* Works with a mouse and with a finger. The dragged item follows the pointer
   and the others make room; onEnd receives the new order. */
const sortable = (container, itemSel, { handle, onEnd } = {}) => {
  container.addEventListener('pointerdown', (e) => {
    const grip = handle ? e.target.closest(handle) : e.target.closest(itemSel);
    if (!grip || !container.contains(grip)) return;
    if (!handle && e.target.closest('button, a, input, select')) return;
    const item = grip.closest(itemSel);
    if (!item) return;
    e.preventDefault();
    const items = () => $$(itemSel, container);
    const r0 = item.getBoundingClientRect();
    const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    let moved = false, raf;
    item.classList.add('dragging');

    const place = (x, y) => {
      item.style.transform = '';
      const r = item.getBoundingClientRect();
      item.style.transform = `translate(${x - ox - r.left}px, ${y - oy - r.top}px)`;
    };
    const move = (ev) => {
      /* a tap that wobbles a little is still a tap, not a drag */
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 6) return;
      moved = true;
      const x = ev.clientX, y = ev.clientY;
      item.style.pointerEvents = 'none';
      const under = document.elementFromPoint(x, y)?.closest(itemSel);
      item.style.pointerEvents = '';
      if (under && under !== item && container.contains(under)) {
        const list = items();
        const a = list.indexOf(item), b = list.indexOf(under);
        container.insertBefore(item, b > a ? under.nextSibling : under);
      }
      place(x, y);
      cancelAnimationFrame(raf);
      if (y < 70) raf = requestAnimationFrame(() => scrollBy(0, -12));
      else if (y > innerHeight - 70) raf = requestAnimationFrame(() => scrollBy(0, 12));
    };
    const end = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      item.classList.remove('dragging');
      item.style.transform = '';
      if (moved && onEnd) onEnd(items().map(el => el.dataset.id));
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  });
};

/* ===================== charts ===================== */
const smoothPath = (pts) => {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
};
const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * p).find(m => m >= v);
};
const shortNum = (v) => v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0).replace('.0', '') + 'K' : String(v);

const lineChart = (el, series, unit = 'visitors') => {
  const W = el.clientWidth || 600, H = el.clientHeight || 250;
  const L = 36, R = 10, T = 14, B = 26;
  const max = niceMax(Math.max(...series.map(s => s.value), 1));
  const x = (i) => L + (series.length < 2 ? 0 : i * (W - L - R) / (series.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const pts = series.map((s, i) => [x(i), y(s.value)]);
  const step = Math.ceil(series.length / (W < 500 ? 5 : 8));
  const ticks = [0, .25, .5, .75, 1].map(f => Math.round(max * f));
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5a35" stop-opacity=".22"/><stop offset="1" stop-color="#3d5a35" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${shortNum(t)}</text>`).join('')}
      ${series.map((s, i) => i % step === 0 || i === series.length - 1 ? `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(s.label)}</text>` : '').join('')}
      <path class="ar" d="${smoothPath(pts)} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z"/>
      <path class="ln" d="${smoothPath(pts)}"/>
      ${series.length <= 31 ? pts.map(p => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('') : ''}
      <line class="cur" id="cur" y1="${T}" y2="${H - B}" style="display:none"/>
    </svg>
    <div class="tip" style="display:none"></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cur = el.querySelector('#cur');
  const showAt = (i) => {
    const s = series[i];
    cur.setAttribute('x1', x(i)); cur.setAttribute('x2', x(i)); cur.style.display = '';
    tip.style.display = ''; tip.style.top = y(s.value) + 'px';
    /* kept inside the chart so it never runs off the screen */
    const half = (tip.offsetWidth || 110) / 2;
    tip.style.left = Math.min(Math.max(x(i), half), W - half) + 'px';
    tip.innerHTML = `${esc(s.label)}<b>${num(s.value)} ${unit}</b>`;
  };
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(series.length - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, series.length - 1)))));
    showAt(i);
  });
  svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; cur.style.display = 'none'; });
  /* the most recent point is shown by default, like the reference */
  if (series.length) showAt(series.length - 1);
};

const DONUT_COLORS = ['#3d5a35', '#4a7fb5', '#c98a1e', '#c0533f', '#8f7aa8', '#9a948a'];
const donut = (el, data) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 60, C = 2 * Math.PI * R;
  let off = 0;
  el.innerHTML = `<svg viewBox="0 0 150 150"><g transform="rotate(-90 75 75)">
    ${data.map((d, i) => {
      const len = C * d.value / total;
      const seg = `<circle cx="75" cy="75" r="${R}" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="20" fill="none" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}"/>`;
      off += len; return seg;
    }).join('')}</g>
    <text x="75" y="72" text-anchor="middle" font-size="20" font-weight="600" fill="#2a2823" stroke="none">${shortNum(total)}</text>
    <text x="75" y="90" text-anchor="middle" font-size="10" fill="#8f897e" stroke="none">visits</text></svg>`;
};

/* ===================== rich text ===================== */
const cleanHTML = (html) => {
  const box = document.createElement('div');
  box.innerHTML = html;
  const OK = ['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P'];
  const walk = (node) => {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 1) {
        walk(ch);
        if (ch.tagName === 'DIV') { const p = document.createElement('p'); p.append(...ch.childNodes); ch.replaceWith(p); return; }
        if (!OK.includes(ch.tagName)) { ch.replaceWith(...ch.childNodes); return; }
        [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
      } else if (ch.nodeType !== 3) ch.remove();
    });
  };
  walk(box);
  return box.innerHTML.trim();
};
const rteHTML = (id, html) => `
  <div class="rte">
    <div class="rte-bar">
      <button type="button" data-cmd="bold"><b>B</b></button>
      <button type="button" data-cmd="italic"><i>I</i></button>
      <button type="button" data-cmd="underline"><u>U</u></button>
      <button type="button" data-cmd="insertUnorderedList">•≡</button>
      <button type="button" data-cmd="insertOrderedList">1≡</button>
    </div>
    <div class="rte-body" id="${id}" contenteditable="true">${html || ''}</div>
  </div>`;
document.addEventListener('mousedown', (e) => {
  const b = e.target.closest('.rte-bar [data-cmd]');
  if (!b) return;
  e.preventDefault();
  document.execCommand(b.dataset.cmd, false, null);
});
