   存储：团队云端共享（WorkBuddy 云服务）
   应用 wbapp_6H4ne4Pivj47cmkaQcnAzt 的数据库，472 条历史数据都在这里；
   打开链接即用，不需要登录（未登录走 anon 角色，权限已开放）；
   写操作只做差分 upsert / delete，不整库覆盖，避免互相冲掉。
   云端不可达时自动落本地缓存，页面照常可用，联网后再推上去。
   密码类信息不再进入工作台：账号只记「绑定人 + 手机后四位」。
   ========================================================= */
const LS_CFG = 'wb.signal.v3.cfg';
const LS_DB = 'wb.signal.v3.db';
const LS_ME = 'wb.signal.v3.me';
const DB_VER = 4;
const KINDS = ['shops', 'metrics', 'accounts', 'alerts', 'tasks', 'qc', 'assets', 'apis'];
const PAGE_ROWS = 1000;

/* 云配置由构建脚本注入 __WB_CFG__：{ endpoint, oauthRelayBaseUrl, publishableKey } */
const cloud = (function () {
  const cfg = window.__WB_CFG__;
  if (!cfg || !window.WorkBuddyCloud) return null;
  try {
    return window.WorkBuddyCloud.createWorkBuddyCloud({
      endpoint: cfg.endpoint,
      oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
      publishableKey: cfg.publishableKey
    });
  } catch (e) { return null; }
})();

async function dbSelectAll() {
  if (!cloud) return [];
  const out = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const r = await cloud.database.from('wb_records')
      .select('key,coll,rec_id,data').order('key').range(from, from + PAGE_ROWS - 1);
    if (r.error) throw r.error;
    const rows = r.data || [];
    out.push.apply(out, rows);
    if (rows.length < PAGE_ROWS) break;
  }
  return out;
}
async function kvGet(k) {
  if (!cloud) return null;
  const r = await cloud.database.from('wb_kv').select('v').eq('k', k).maybeSingle();
  if (r.error) throw r.error;
  return r.data ? r.data.v : null;
}
async function kvSet(k, v) {
  if (!cloud) return;
  const r = await cloud.database.from('wb_kv').upsert({ k: k, v: v, updated_at: new Date().toISOString() });
  if (r.error) throw r.error;
}

const store = {
  db: { meta: {} },
  cfg: { targets: { adopt: 60, gen: 75, conv: 40, resp: 98 }, range: 14 },
  session: null,
  cfgMeta: { at: 0, by: '' },   // 配置最后修改人/时间（团队共享）
  texts: {},         // 文案覆盖：'nav.board.name' -> '自定义名'
  code: null,        // 自定义样式/脚本：{ css, js, at, by }
  synced: {},        // key -> 上次同步时的 JSON 快照
  _timer: 0, _flushing: null, _again: false, _cfgTimer: 0,
  _dirty: false,        // 还有没推上云端的改动
  _del: {},             // key -> 1：本机明确删掉的记录，推完清空
  _probeSig: '',        // 上次对账时云端 (key,updated_at) 指纹
  _syncedAt: 0,         // 上次与云端对齐成功的时间

  /* 启动时只读本地缓存兜底，云端才是准的（loadCfg 会覆盖） */
  initCfg() {
    let c = null;
    try { c = localStorage.getItem(LS_CFG); } catch (e) {}
    if (c) { try {
      const o = JSON.parse(c) || {};
      if (o.targets) Object.assign(this.cfg.targets, o.targets);
      if (o.range) this.cfg.range = +o.range;
    } catch (e) {} }
  },
  cfgCache() { try { localStorage.setItem(LS_CFG, JSON.stringify(this.cfg)); } catch (e) {} },

  /* 团队级文案与自定义代码：和 cfg 一样存云端 kv，谁改所有人可见 */
  async loadTeam() {
    if (!cloud) {
      try {
        const t = localStorage.getItem('wb.signal.v3.texts');
        if (t) this.texts = JSON.parse(t) || {};
        const c = localStorage.getItem('wb.signal.v3.code');
        if (c) this.code = JSON.parse(c);
      } catch (e) {}
      return;
    }
    try { this.texts = (await kvGet('texts')) || {}; } catch (e) {}
    try { this.code = await kvGet('code'); } catch (e) {}
  },
  cacheTeam() {
    try {
      localStorage.setItem('wb.signal.v3.texts', JSON.stringify(this.texts || {}));
      localStorage.setItem('wb.signal.v3.code', JSON.stringify(this.code || null));
    } catch (e) {}
  },
  async saveTexts() {
    this.cacheTeam();
    if (!cloud) return;
    await kvSet('texts', this.texts);
  },
  async setText(k, v) {
    const val = String(v == null ? '' : v).trim();
    if (val) this.texts[k] = val; else delete this.texts[k];
    try { await this.saveTexts(); } catch (e) { toast('文案保存失败：' + ((e && e.message) || e), 'bad'); }
  },
  async saveCode(css, js) {
    this.code = { css: css || '', js: js || '', at: Date.now(), by: myName() };
    this.cacheTeam();
    if (!cloud) { toast('已存在本机（云端未连接）', 'ok'); return; }
    await kvSet('code', this.code);
  },
  async clearCode() {
    this.code = null;
    this.cacheTeam();
    if (cloud) await kvSet('code', { css: '', js: '', at: Date.now(), by: myName() });
  },

  async loadCfg() {
    let c = null, reachable = false;
    try { c = await kvGet('cfg'); reachable = !!cloud; } catch (e) { reachable = false; }
    if (reachable && c && c.targets) {
      Object.assign(this.cfg.targets, c.targets);
      if (c.range) this.cfg.range = +c.range;
      this.cfgMeta = { at: +c.at || 0, by: c.by || '' };
      this.cfgCache();
    } else if (reachable && c === null) {
      await this.pushCfg(true);
    }
  },
  /* 改配置：本地缓存即时生效，400ms 后写云端，全组同步 */
  saveCfg() {
    this.cfgCache();
    clearTimeout(this._cfgTimer);
    this._cfgTimer = setTimeout(() => { this.pushCfg(); }, 400);
  },
  async pushCfg(silent) {
    const blob = { targets: this.cfg.targets, range: this.cfg.range, at: Date.now(), by: myName() };
    try {
      await kvSet('cfg', blob);
      this.cfgMeta = { at: blob.at, by: blob.by };
      const el = document.getElementById('cfgSync');
      if (el) el.textContent = cfgSyncText();
    } catch (e) {
      this.cloudErr = (e && e.message) || String(e);
      if (!silent) toast('配置同步失败：' + this.cloudErr, 'bad');
    }
  },

  /* 本机缓存：云端连不上时的兜底，也让首屏更快 */
  readLocal() {
    try {
      const raw = localStorage.getItem(LS_DB);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const db = o && o.db;
      if (!db || !KINDS.some(k => Array.isArray(db[k]))) return null;
      const out = { meta: db.meta || { ver: DB_VER } };
      KINDS.forEach(k => { out[k] = Array.isArray(db[k]) ? db[k] : []; });
      return out;
    } catch (e) { return null; }
  },
  cacheLocal() {
    try { localStorage.setItem(LS_DB, JSON.stringify({ db: this.db, at: Date.now() })); } catch (e) {}
  },

  /* 拉全量：云端优先；云挂了读本机缓存；都没有才播种子 */
  async hydrate(opts) {
    let rows = null;
    this.cloudErr = '';
    if (cloud) {
      try { rows = await dbSelectAll(); }
      catch (e) { this.cloudErr = (e && e.message) || String(e); rows = null; }
    }
    this.synced = {};
    if (rows === null) {
      const local = this.readLocal();
      if (local) {
        this.db = local;
        await this.loadCfg();
        return { seeded: false, rows: 0, offline: !!cloud };
      }
      rows = [];
    }
    if (!rows.length) return (opts && opts.noSeed) ? { seeded: false, rows: 0 } : this.seedFresh();
    const db = { meta: {} };
    KINDS.forEach(k => { db[k] = []; });
    rows.forEach(r => {
      if (KINDS.indexOf(r.coll) < 0) return;
      db[r.coll].push(r.data);
      this.synced[r.key] = JSON.stringify(r.data);
    });
    this.db = db;
    this._dirty = false;
    this.db.meta = (await kvGet('meta').catch(() => null)) || { ver: DB_VER };
    await this.loadCfg();
    this.cacheLocal();
    return { seeded: false, rows: rows.length };
  },
  async seedFresh() {
    const s = buildSeed();
    this.db = Object.assign({ meta: { ver: DB_VER, seed: true, seededAt: todayStr() } }, s);
    this.synced = {};
    await this.flush();
    await kvSet('meta', this.db.meta);
    await this.loadCfg();
    return { seeded: true, rows: Object.keys(this.synced).length };
  },

  /* 写：300ms 合并一次，只推变化的行 */
  save() {
    clearTimeout(this._timer);
    this._lastWrite = Date.now();
    this._dirty = true;
    this._timer = setTimeout(() => { this.flush(); }, 300);
  },
  async flush() {
    if (!cloud) { this._dirty = false; this.cacheLocal(); return; }
    if (this._flushing) { this._again = true; return this._flushing; }
    this._flushing = (async () => {
      do {
        this._again = false;
        const ups = [];
        KINDS.forEach(k => (this.db[k] || []).forEach(rec => {
          if (!rec || !rec.id) return;
          const key = k + ':' + rec.id;
          const j = JSON.stringify(rec);
          if (this.synced[key] !== j) {
            ups.push({ key: key, coll: k, rec_id: String(rec.id), data: rec, updated_at: new Date().toISOString(), updated_by: myName() });
          }
        }));
        /* 只删「本机明确删掉的」那些行。
           以前按「本机没有 = 别人删了」推断，本地一旦拿到旧快照，
           就会把同事刚加的行删掉，结果两个人各看到各的版本。 */
        const dels = Object.keys(this._del);
        for (let i = 0; i < ups.length; i += 200) {
          const part = ups.slice(i, i + 200);
          const r = await cloud.database.from('wb_records').upsert(part);
          if (r.error) throw r.error;
          part.forEach(u => { this.synced[u.key] = JSON.stringify(u.data); });
        }
        for (let i = 0; i < dels.length; i += 200) {
          const part = dels.slice(i, i + 200);
          const r = await cloud.database.from('wb_records').delete().in('key', part);
          if (r.error) throw r.error;
          part.forEach(k => { delete this.synced[k]; delete this._del[k]; });
        }
        this._dirty = false;
      } while (this._again);
    })().catch(e => {
      this.cloudErr = (e && e.message) || String(e);
      /* 用顶部常驻提示代替红条 toast，避免每次改动都弹一次 */
      if (typeof syncNotice === 'function') syncNotice();
    }).finally(() => {
      this._flushing = null;
      this._lastWrite = Date.now();
      this.cacheLocal();
    });
    return this._flushing;
  },

  list(k) { return (this.db[k] || []).slice(); },
  get(k, id) { return (this.db[k] || []).find(x => x.id === id) || null; },
  add(k, obj) {
    const rec = Object.assign({ id: uid(k[0]) }, obj, { __mt: Date.now(), __src: 'ui' });
    this.db[k].unshift(rec); this.save(); return rec;
  },
  update(k, id, patch) {
    const r = this.get(k, id); if (!r) return null;
    Object.assign(r, patch, { __mt: Date.now() }); this.save(); return r;
  },
  remove(k, id) {
    this.db[k] = (this.db[k] || []).filter(x => x.id !== id);
    this._del[k + ':' + id] = 1;   // 明确记一笔，免得被别人的旧快照复活
    this.save();
  },
  upsertMetric(rec) {
    const hit = this.db.metrics.find(m => m.shop === rec.shop && m.date === rec.date);
    if (hit) { Object.assign(hit, rec, { __mt: Date.now() }); this.save(); return 'update'; }
    this.db.metrics.push(Object.assign({ id: uid('m') }, rec, { __mt: Date.now(), __src: 'ui' })); this.save(); return 'insert';
  },
  clearAll() {
    KINDS.forEach(k => {
      (this.db[k] || []).forEach(r => { if (r && r.id) this._del[k + ':' + r.id] = 1; });
      this.db[k] = [];
    });
    this.db.meta = { seed: false, ver: DB_VER };
    this.save();
  },

  /* 轻量对账：只取 (key, updated_at)，几百行也就十几 KB。
     指纹变了才去拉全量，省流量也省云端查询。 */
  async probe() {
    if (!cloud) return '';
    const rows = [];
    for (let from = 0; ; from += PAGE_ROWS) {
      const r = await cloud.database.from('wb_records')
        .select('key,updated_at').order('key').range(from, from + PAGE_ROWS - 1);
      if (r.error) throw r.error;
      const part = r.data || [];
      rows.push.apply(rows, part);
      if (part.length < PAGE_ROWS) break;
    }
    return rows.length + '|' + rows.map(r => r.key + '@' + (r.updated_at || '')).join(',');
  }
};

/* 写权限已统一为「登录即可写」，这里只在真没权限时兜底提示 */
function denyWrite() {
  toast('这一笔没写进云端，请确认已登录团队账号后再试', 'bad');
}

/* 「我是谁」：记在本机、不进云端；写库时带上改动人，方便追溯是谁改的。
   打开即用，不需要登录，名字只用于标记。 */
function myName() {
  /* 登录后优先用账号名；没登录才有本机记名 */
  try {
    const u = store.session && store.session.user;
    const n = u && (u.name || u.email || u.phone);
    if (n) return String(n);
  } catch (e) {}
  try {
    const n = localStorage.getItem(LS_ME);
    if (n) return n;
  } catch (e) {}
  return '组内成员';
}
function setMyName(n) {
  const v = String(n || '').trim().slice(0, 20);
  try {
    if (v) localStorage.setItem(LS_ME, v); else localStorage.removeItem(LS_ME);
  } catch (e) {}
  return v || '组内成员';
}
function agoText(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  return new Date(ts).toLocaleDateString('zh-CN');
}
function cfgSyncText() {
  const m = store.cfgMeta || {};
  const who = m.by ? m.by + ' ' : '';
  const when = m.at ? agoText(m.at) : '未同步';
  return '团队云端 · ' + who + when + '更新 · ' + store.list('metrics').length + ' 条指标';
}
