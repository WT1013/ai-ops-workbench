   指标导入（对接探域 OMS：粘贴 CSV/TSV 或 JSON）
   ========================================================= */
function parseTable(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], err: '至少需要表头 + 1 行数据' };
  const delim = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(',') >= 0 ? ',' : /\s{2,}/);
  const head = lines[0].split(delim).map(s => s.trim().replace(/^"|"$/g, ''));
  const map = head.map(h => HEAD_MAP[h] || HEAD_MAP[h.replace(/%$/, '')] || null);
  if (map.indexOf('shop') < 0 || map.indexOf('date') < 0) return { rows: [], err: '表头必须包含「店铺」和「日期」两列' };
  const rows = [], bad = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(s => s.trim().replace(/^"|"$/g, ''));
    const o = {};
    cells.forEach((c, j) => {
      const k = map[j];
      if (!k) return;
      if (k === 'date') o.date = normDate(c);
      else if (k === 'shop' || k === 'note') o[k] = c;
      else o[k] = num(c);
    });
    if (!o.shop || !o.date) { bad.push(i + 1); continue; }
    rows.push(o);
  }
  return { rows, bad };
}

function normDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return new Date().getFullYear() + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  return '';
}

function openImport() {
  const tpl = '店铺,日期,采纳率,生成率,转化率,风控率,纯智占比,回复率\nEXAMPLE 旗舰店,2026-11-11,58.4,74.2,38.1,2.0,86.0,98.1';
  openModal({
    title: '导入指标数据',
    wide: true,
    body: `
      <div class="imp-tabs">
        <button class="on" data-imp="csv">CSV / 从表格粘贴</button>
        <button data-imp="json">JSON</button>
        <button data-imp="file">选择文件</button>
      </div>
      <div id="imp-csv">
        <textarea class="imp-area" id="impText" spellcheck="false" placeholder="${esc(tpl)}"></textarea>
        <div class="fld" style="margin-top:8px">
          <span class="tip">表头需含「店铺」「日期」，其余列按名称匹配：采纳率 / 生成率 / 转化率 / 风控率 / 纯智占比 / 回复率。支持 Excel 直接复制（制表符分隔）。</span>
        </div>
      </div>
      <div id="imp-file" style="display:none">
        <input type="file" id="impFile" accept=".csv,.tsv,.json,.txt" style="font-size:12px;color:var(--ink2)" />
        <div class="fld" style="margin-top:8px"><span class="tip">支持 .csv / .tsv / .json</span></div>
      </div>
      <div class="imp-preview" id="impPrev">等待解析…</div>`,
    buttons: [
      { label: '取消', cls: 'ghost' },
      { label: '校验', fn: () => previewImport() },
      { label: '导入', cls: 'primary', fn: (close) => doImport(close) }
    ],
    onMount: (root) => {
      let mode = 'csv';
      $('#impText', root).addEventListener('input', () => previewImport());
      $$('[data-imp]', root).forEach(b => b.addEventListener('click', () => {
        $$('[data-imp]', root).forEach(x => x.classList.toggle('on', x === b));
        mode = b.dataset.imp;
        $('#imp-csv', root).style.display = mode === 'csv' || mode === 'json' ? 'block' : 'none';
        $('#imp-file', root).style.display = mode === 'file' ? 'block' : 'none';
        const t = $('#impText', root);
        if (t) t.placeholder = mode === 'json'
          ? '[{"店铺":"ZEAMO 京东自营","日期":"2026-11-11","采纳率":58.4,"生成率":74.2}]'
          : tpl;
      }));
      $('#impFile', root).addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { $('#impText', root).value = String(r.result); previewImport(); };
        r.readAsText(f, 'utf-8');
      });
      window.__impMode = () => mode;
      previewImport();
    }
  });
}

function collectImport() {
  const txt = ($('#impText') || {}).value || '';
  const mode = (window.__impMode && window.__impMode()) || 'csv';
  if (!txt.trim()) return { rows: [], err: '内容为空' };
  if (mode === 'json' || /^\s*[\[{]/.test(txt)) {
    try {
      let arr = JSON.parse(txt);
      if (!Array.isArray(arr)) arr = arr.rows || arr.data || [];
      const rows = [], bad = [];
      arr.forEach((o, i) => {
        const r = {};
        Object.keys(o).forEach(k => {
          const kk = HEAD_MAP[k] || k;
          if (kk === 'date') r.date = normDate(o[k]);
          else if (kk === 'shop' || kk === 'note') r[kk] = String(o[k] || '');
          else if (M_KEYS.indexOf(kk) >= 0) r[kk] = num(o[k]);
        });
        if (!r.shop || !r.date) bad.push(i + 1); else rows.push(r);
      });
      return { rows, bad };
    } catch (e) { return { rows: [], err: 'JSON 解析失败：' + e.message }; }
  }
  return parseTable(txt);
}

function previewImport() {
  const box = $('#impPrev'); if (!box) return;
  const r = collectImport();
  if (r.err) { box.innerHTML = `<span class="bad">${esc(r.err)}</span>`; return; }
  if (!r.rows.length) { box.innerHTML = `<span class="bad">没有可导入的行</span>`; return; }
  const shops = new Set(r.rows.map(x => x.shop));
  const dates = Array.from(new Set(r.rows.map(x => x.date))).sort();
  const exist = r.rows.filter(x => store.list('metrics').some(m => m.shop === x.shop && m.date === x.date)).length;
  box.innerHTML = `可导入 <b>${r.rows.length}</b> 条 · 涉及 <b>${shops.size}</b> 家店 ·
    日期 <b>${esc(dates[0])}</b> → <b>${esc(dates[dates.length - 1])}</b><br>
    新增 <b class="ok">${r.rows.length - exist}</b> 条 · 覆盖 <b>${exist}</b> 条
    ${r.bad && r.bad.length ? ` · <span class="bad">${r.bad.length} 行缺店铺或日期已跳过（第 ${r.bad.slice(0, 5).join('、')} 行）</span>` : ''}`;
}

function doImport(close) {
  const r = collectImport();
  if (r.err || !r.rows.length) { toast(r.err || '没有可导入的行', 'bad'); return; }
  let ins = 0, upd = 0, newShops = 0;
  const known = new Set(store.list('shops').map(s => s.name));
  r.rows.forEach(x => {
    if (!known.has(x.shop)) {
      store.add('shops', {
        name: x.shop, platform: '未分类', account: '', owner: '未分配',
        tag: '常规', auth: '未授权', opstat: '运营中', third: '', note: '由指标导入自动建档，待补全'
      });
      known.add(x.shop); newShops++;
    }
    const t = store.upsertMetric(x);
    t === 'insert' ? ins++ : upd++;
  });
  store.save();
  if (store.db.meta && store.db.meta.seed) { store.db.meta = { seed: false }; store.save(); }
  close();
  toast(`导入完成：新增 ${ins} · 覆盖 ${upd}${newShops ? ` · 新建店铺 ${newShops}` : ''}`, 'ok');
  render();
}

/* =========================================================
