// ===================== Maison Meka — storage ===================== //
/* Where the store's data lives. Two interchangeable backends with the same
   interface:

     • files  — data/db.json + data/analytics.json, used on your own machine
     • redis  — an Upstash Redis database, used on Vercel (set by the
                KV_REST_API_URL / KV_REST_API_TOKEN environment variables)

   The main document (products, categories, orders, coupons, content,
   settings) is saved with a version check, so two saves at the same moment
   can never silently overwrite each other — the loser simply retries.
   Visitor statistics are kept apart, as small per-day counters. */

const fs = require('fs');
const path = require('path');

const REDIS_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KIND = REDIS_URL && REDIS_TOKEN ? 'redis' : 'files';

const blankDay = () => ({ v: 0, pv: 0, h: Array(24).fill(0), src: {}, cty: {}, prod: {} });

/* =====================================================================
   files
   ===================================================================== */
/* Vercel's disk is read-only apart from /tmp, which is wiped often — fine
   only until the Redis database is connected */
const DATA = process.env.VERCEL ? '/tmp/mm-data' : path.join(__dirname, '..', 'data');
const DOC_FILE = path.join(DATA, 'db.json');
const AN_FILE = path.join(DATA, 'analytics.json');
const writeAtomic = (file, obj) => {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(obj));
  fs.renameSync(file + '.tmp', file);
};
let fileDoc = null, fileVer = 0, fileAn = null, anTimer = null;
const liveMap = new Map();
const failMap = new Map();

const files = {
  async loadDoc() {
    if (!fileDoc) {
      if (!fs.existsSync(DOC_FILE)) return { doc: null, ver: '0' };
      fileDoc = JSON.parse(fs.readFileSync(DOC_FILE, 'utf8'));
      /* older files kept statistics inside the main document */
      if (fileDoc.analytics) {
        if (!fs.existsSync(AN_FILE)) writeAtomic(AN_FILE, fileDoc.analytics);
        delete fileDoc.analytics;
      }
    }
    return { doc: JSON.parse(JSON.stringify(fileDoc)), ver: String(fileVer) };
  },
  async saveDoc(doc, ver) {
    if (String(ver) !== String(fileVer)) return false;
    fileDoc = doc; fileVer++;
    writeAtomic(DOC_FILE, doc);
    return true;
  },
  an() {
    if (!fileAn) fileAn = fs.existsSync(AN_FILE) ? JSON.parse(fs.readFileSync(AN_FILE, 'utf8')) : { days: {} };
    return fileAn;
  },
  flushAn() { clearTimeout(anTimer); anTimer = setTimeout(() => writeAtomic(AN_FILE, files.an()), 1500); },
  async track(hit) {
    const days = files.an().days;
    Object.entries(days).forEach(([k, d]) => { if (k !== hit.date) { delete d._v; delete d._vh; } });
    const d = days[hit.date] || (days[hit.date] = blankDay());
    d._v = d._v || []; d._vh = d._vh || [];
    d.pv++;
    if (!d._v.includes(hit.vid)) { d._v.push(hit.vid); d.v++; d.cty[hit.cty] = (d.cty[hit.cty] || 0) + 1; }
    const hk = hit.vid + '|' + hit.h;
    if (!d._vh.includes(hk)) { d._vh.push(hk); d.h[hit.h]++; }
    if (hit.src) d.src[hit.src] = (d.src[hit.src] || 0) + 1;
    if (hit.product) d.prod[hit.product] = (d.prod[hit.product] || 0) + 1;
    liveMap.set(hit.vid, Date.now());
    files.flushAn();
  },
  async readDays(keys) {
    const days = files.an().days;
    const out = {};
    keys.forEach(k => { const d = days[k]; out[k] = d ? { v: d.v, pv: d.pv, h: d.h, src: d.src, cty: d.cty, prod: d.prod } : blankDay(); });
    return out;
  },
  async liveCount() {
    const t = Date.now();
    for (const [vid, seen] of liveMap) if (t - seen > 300000) liveMap.delete(vid);
    return liveMap.size;
  },
  async resetAnalytics() { fileAn = { days: {} }; writeAtomic(AN_FILE, fileAn); },
  /* sign-in attempts per visitor, forgotten after the window */
  async failCount(key) { const r = failMap.get(key); return r && r.until > Date.now() ? r.n : 0; },
  async failAdd(key, sec) { const r = failMap.get(key); const live = r && r.until > Date.now(); failMap.set(key, { n: live ? r.n + 1 : 1, until: live ? r.until : Date.now() + sec * 1000 }); },
  async failClear(key) { failMap.delete(key); },
  async seedAnalytics(days) { fileAn = { days }; writeAtomic(AN_FILE, fileAn); }
};

/* =====================================================================
   redis (Upstash REST — plain HTTPS, no client library)
   ===================================================================== */
const pipe = async (cmds) => {
  if (!cmds.length) return [];
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('Database error ' + r.status);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
};
const chunked = async (cmds, size = 400) => {
  const out = [];
  for (let i = 0; i < cmds.length; i += size) out.push(...await pipe(cmds.slice(i, i + size)));
  return out;
};
const K = { doc: 'mm:doc', ver: 'mm:ver', days: 'mm:days', live: 'mm:live',
  day: (d) => `mm:a:${d}`, uniq: (d) => `mm:u:${d}`, uniqH: (d, h) => `mm:uh:${d}:${h}` };
/* saves only if nobody else saved since we loaded */
const CAS = `local v = redis.call('GET', KEYS[2]) or '0'
if v ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('INCR', KEYS[2])
return 1`;
const pairs = (arr) => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0; return o; };

const redis = {
  async loadDoc() {
    const [doc, ver] = await pipe([['GET', K.doc], ['GET', K.ver]]);
    return { doc: doc ? JSON.parse(doc) : null, ver: ver || '0' };
  },
  async saveDoc(doc, ver) {
    const [ok] = await pipe([['EVAL', CAS, '2', K.doc, K.ver, JSON.stringify(doc), String(ver)]]);
    return ok === 1;
  },
  /* one round trip per visit */
  async track(hit) {
    const cmds = [
      ['PFADD', K.uniq(hit.date), hit.vid],
      ['PFADD', K.uniqH(hit.date, hit.h), hit.vid],
      ['ZADD', K.live, Date.now(), hit.vid]
    ];
    if (hit.first) {
      cmds.push(['SADD', K.days, hit.date], ['HINCRBY', K.day(hit.date), 'cty:' + hit.cty, 1]);
      if (hit.src) cmds.push(['HINCRBY', K.day(hit.date), 'src:' + hit.src, 1]);
    }
    if (hit.product) cmds.push(['HINCRBY', K.day(hit.date), 'p:' + hit.product, 1]);
    await pipe(cmds);
  },
  /* visitors = counted uniques + any imported (demo) baseline */
  async readDays(keys, hoursFor) {
    const cmds = [];
    keys.forEach(k => cmds.push(['HGETALL', K.day(k)], ['PFCOUNT', K.uniq(k)]));
    if (hoursFor) for (let h = 0; h < 24; h++) cmds.push(['PFCOUNT', K.uniqH(hoursFor, h)]);
    const res = await chunked(cmds);
    const out = {};
    keys.forEach((k, i) => {
      const f = pairs(res[i * 2]);
      const d = blankDay();
      d.v = (f.v || 0) + (Number(res[i * 2 + 1]) || 0);
      d.pv = f.pv || 0;
      Object.entries(f).forEach(([name, val]) => {
        if (name.startsWith('src:')) d.src[name.slice(4)] = val;
        else if (name.startsWith('cty:')) d.cty[name.slice(4)] = val;
        else if (name.startsWith('p:')) d.prod[name.slice(2)] = val;
        else if (name.startsWith('h:')) d.h[Number(name.slice(2))] = val;
      });
      out[k] = d;
    });
    if (hoursFor && out[hoursFor]) {
      const base = keys.length * 2;
      out[hoursFor].h = out[hoursFor].h.map((v, h) => v + (Number(res[base + h]) || 0));
    }
    return out;
  },
  async failCount(key) { const [n] = await pipe([['GET', 'mm:fail:' + key]]); return Number(n) || 0; },
  async failAdd(key, sec) { await pipe([['INCR', 'mm:fail:' + key], ['EXPIRE', 'mm:fail:' + key, sec, 'NX']]); },
  async failClear(key) { await pipe([['DEL', 'mm:fail:' + key]]); },
  async liveCount() {
    const t = Date.now();
    const [, n] = await pipe([['ZREMRANGEBYSCORE', K.live, '-inf', t - 300000], ['ZCARD', K.live]]);
    return Number(n) || 0;
  },
  async resetAnalytics() {
    const [days] = await pipe([['SMEMBERS', K.days]]);
    const keys = [];
    (days || []).forEach(d => { keys.push(K.day(d), K.uniq(d)); for (let h = 0; h < 24; h++) keys.push(K.uniqH(d, h)); });
    const cmds = [];
    for (let i = 0; i < keys.length; i += 300) cmds.push(['DEL', ...keys.slice(i, i + 300)]);
    cmds.push(['DEL', K.days, K.live]);
    await chunked(cmds, 50);
  },
  async seedAnalytics(days) {
    await redis.resetAnalytics();
    const cmds = [];
    Object.entries(days).forEach(([date, d]) => {
      const f = ['v', d.v, 'pv', d.pv];
      d.h.forEach((v, h) => f.push('h:' + h, v));
      Object.entries(d.src).forEach(([k, v]) => f.push('src:' + k, v));
      Object.entries(d.cty).forEach(([k, v]) => f.push('cty:' + k, v));
      Object.entries(d.prod).forEach(([k, v]) => f.push('p:' + k, v));
      cmds.push(['HSET', K.day(date), ...f], ['SADD', K.days, date]);
    });
    await chunked(cmds, 200);
  }
};

module.exports = { KIND, ...(KIND === 'redis' ? redis : files) };
