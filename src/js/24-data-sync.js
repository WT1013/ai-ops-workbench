/* =========================================================
   数据源同步：data/*.csv → 页面
   - CSV 是团队共享的数据源，随仓库一起发布
   - 启动时读一次，之后每 60 秒查一次 manifest.json（只有几百字节）
   - manifest 里的版本变了 = 有人改了 CSV → 自动重新拉取并刷新页面
   - 合并规则「谁更晚谁生效」：界面改动带 __mt 时间戳，
     比 CSV 发布时间新就保留界面版本，否则用 CSV 覆盖
   ========================================================= */

const DATA_KINDS = ['shops', 'accounts', 'metrics', 'alerts', 'tasks', 'qc', 'assets', 'apis'];
const DATA_NUM_FIELDS = {
  shops: ['order'],
  metrics: ['adopt', 'gen', 'conv', 'risk', 'agent', 'resp'],
  qc: ['hits'],
  apis: ['calls', 'errors']
};
const LS_DATA_VER = 'wb.signal.v3.dataver';

let dataCache = null;   // { version, publishedAt, counts, byKind }
let dataCheckedAt = 0;  // 上次检查时间
let dataErr = '';

function dataBase() {
  const c = window.__OPS_CFG__ || {};
  return String(c.dataBase || 'data/').replace(/\/+$/, '') + '/';
}
/* 正式域名（app.workbuddy.host）下静态资源要带 sharecode 才放行，
   裸路径 /data/xx.csv 会 403。这里统一拼成绝对地址并补上 sharecode。 */
function dataUrl(file) {
  let u;
  try { u = new URL(dataBase() + file, location.href); }
  catch (e) { u = null; }
  if (!u) return dataBase() + file + '?t=' + Date.now();
  try {
    const sc = new URLSearchParams(location.search).get('sharecode');
    if (sc && !u.searchParams.get('sharecode')) u.searchParams.set('sharecode', sc);
  } catch (e) {}
  u.searchParams.set('t', String(Date.now()));
  return u.toString();
}
function dataPollMs() {
  const c = window.__OPS_CFG__ || {};
  const s = +c.pollSeconds || 60;
  return Math.max(15, s) * 1000;
}

/* RFC4180 够用的 CSV 解析：支持引号包裹、字段内逗号、双引号转义、CRLF */
function csvParse(text) {
  let t = String(text || '');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const rows = [];
  let field = '', row = [], q = false, i = 0;
  while (i < t.length) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(x => String(x).trim() !== ''))
    .map(r => {
      const o = {};
      head.forEach((h, ix) => { o[h] = r[ix] == null ? '' : r[ix]; });
      return o;
    });
}

/* CSV 里全是字符串，按字段类型还原成数字，避免聚合时变成字符串拼接 */
function typed(kind, obj) {
  const nums = DATA_NUM_FIELDS[kind] || [];
  nums.forEach(f => {
    if (obj[f] === '' || obj[f] == null) { obj[f] = null; return; }
    const n = parseFloat(obj[f]);
    obj[f] = isNaN(n) ? null : n;
  });
  return obj;
}

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

/* 读 manifest，版本变了就把所有 CSV 拉下来。
   返回 true 表示数据有更新。 */
async function loadDataCsv(force) {
  try {
    const mf = JSON.parse(await fetchText(dataUrl('manifest.json')));
    if (!mf || !mf.version) throw new Error('manifest 格式不对');
    if (!force && dataCache && dataCache.version === mf.version) {
      dataCheckedAt = Date.now();
      dataErr = '';
      return false;
    }
    const byKind = {};
    const files = Array.isArray(mf.files) ? mf.files : [];
    for (let i = 0; i < DATA_KINDS.length; i++) {
      const kind = DATA_KINDS[i];
      if (files.length && files.indexOf(kind + '.csv') < 0) continue;
      try {
        const txt = await fetchText(dataUrl(kind + '.csv'));
        byKind[kind] = csvParse(txt).map(r => typed(kind, r));
      } catch (e) { /* 单个文件坏了不影响其它集合 */ }
    }
    const changed = !dataCache || dataCache.version !== mf.version;
    dataCache = {
      version: mf.version,
      publishedAt: Date.parse(mf.publishedAt) || 0,
      counts: mf.counts || {},
      byKind: byKind
    };
    dataCheckedAt = Date.now();
    dataErr = '';
    try { localStorage.setItem(LS_DATA_VER, mf.version); } catch (e) {}
    return changed;
  } catch (e) {
    dataErr = (e && e.message) || String(e);
    dataCheckedAt = Date.now();
    return false;
  }
}

/* 把 CSV 合并进内存库。规则：
   1) 同一 id：界面改动时间 __mt 晚于 CSV 发布时间 → 保留界面版本，否则 CSV 覆盖
   2) CSV 里没有的 id：只有「上次确实来自 CSV」的行才会被删除；
      界面上新建/历史遗留的行一律保留，绝不因为一次同步丢数据
   返回被改动的行数 */
function mergeCsvData() {
  if (!dataCache || !dataCache.byKind) return 0;
  const mfAt = dataCache.publishedAt;
  let touched = 0;

  DATA_KINDS.forEach(kind => {
    const rows = dataCache.byKind[kind];
    if (!rows || !rows.length) return;
    if (!Array.isArray(store.db[kind])) store.db[kind] = [];

    const list = store.db[kind];
    const byId = {};
    list.forEach(r => { if (r && r.id) byId[r.id] = r; });

    rows.forEach(src => {
      if (!src || !src.id) return;
      const cur = byId[src.id];
      if (cur && +cur.__mt && +cur.__mt > mfAt) return;  // 界面上的更新更晚，别覆盖
      if (cur) {
        const before = JSON.stringify(cur);
        Object.keys(src).forEach(k => { cur[k] = src[k]; });
        cur.__src = 'csv';
        if (JSON.stringify(cur) !== before) touched++;
      } else {
        const rec = Object.assign({ id: src.id }, src, { __src: 'csv' });
        list.push(rec);
        byId[rec.id] = rec;
        touched++;
      }
    });

    const csvIds = {};
    rows.forEach(r => { if (r && r.id) csvIds[r.id] = 1; });
    const kept = list.filter(r => {
      if (!r || !r.id) return false;
      if (csvIds[r.id]) return true;
      if (r.__src !== 'csv') return true;             // 界面新增或历史数据，保留
      if (+r.__mt && +r.__mt > mfAt) return true;     // 界面上刚改过，保留
      return false;                                   // CSV 里删掉了 → 一起删
    });
    if (kept.length !== list.length) {
      touched += list.length - kept.length;
      store.db[kind] = kept;
    }
  });
  return touched;
}

/* 检查一次：有更新就合并 + 重渲染。
   silent=true 用于轮询，不给弹窗、不在用户打字时打断。 */
async function refreshDataCsv(silent) {
  const changed = await loadDataCsv(false);
  if (!changed) { renderDataStatus(); return false; }
  const ae = document.activeElement;
  const typing = ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName);
  if (typing && silent) return false;                 // 等用户打完字下一轮再说
  const n = mergeCsvData();
  render();
  renderDataStatus();
  if (!silent && n) toast('数据源已更新 · ' + n + ' 行 · 版本 ' + dataCache.version, 'ok');
  return true;
}

function dataStatusText() {
  if (!dataCache) {
    if (dataErr) return '数据源未连上（' + dataErr + '）';
    return '数据源未加载';
  }
  return '数据源 ' + dataCache.version + ' · ' + agoText(Date.parse(dataCache.publishedAt) || 0) + '发布';
}

/* 设置页里的数据源面板（只读信息 + 手动刷新） */
function renderDataStatus() {
  const el = document.getElementById('dataStatus');
  if (el) {
    const mf = dataCache;
    const rows = mf ? DATA_KINDS.map(k => `<tr><td>data/${k}.csv</td><td class="mono">${(mf.byKind[k] || []).length} 行</td></tr>`).join('') : '';
    el.innerHTML = !mf
      ? `<div class="set-tip">还没读到数据源${dataErr ? '：' + esc(dataErr) : ''}。确认 <code>data/</code> 已随站点发布。</div>`
      : `<table class="set-tbl"><tbody>
          <tr><td class="set-lb">当前版本</td><td class="mono">${esc(mf.version)}</td><td class="set-def">${esc(mf.publishedAt ? new Date(mf.publishedAt).toLocaleString('zh-CN') : '—')}</td></tr>
          <tr><td class="set-lb">检查时间</td><td class="mono">${esc(dataCheckedAt ? new Date(dataCheckedAt).toLocaleTimeString('zh-CN') : '—')}</td><td class="set-def">每 ${Math.round(dataPollMs() / 1000)} 秒自动检查一次</td></tr>
          ${rows}
        </tbody></table>`;
  }
  const pill = document.getElementById('dataPill');
  if (pill) {
    pill.textContent = dataCache ? '数据源 ' + dataCache.version : '数据源未连';
    pill.title = dataStatusText();
  }
}
function startDataSync() {
  renderDataStatus();
  setInterval(() => { if (!document.hidden) refreshDataCsv(true); }, dataPollMs());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshDataCsv(true);
  });
}
