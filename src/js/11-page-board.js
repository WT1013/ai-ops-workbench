/* ---------- 页面：数据看板 ---------- */
function renderBoard() {
  const series = agg.series(store.cfg.range);
  const stats = agg.sixStats();
  const T = store.cfg.targets;

  const six = table(
    [{ t: '指标' }, { t: '近 7 天', n: 1 }, { t: '前 7 天', n: 1 }, { t: '环比', n: 1 }, { t: '状态' }, { t: '目标' }],
    stats.map(s => {
      const d = (s.cur != null && s.prev != null) ? +(s.cur - s.prev).toFixed(1) : null;
      const dir = d == null ? 'flat' : d > 0 ? (s.def.hi ? 'up' : 'down') : (s.def.hi ? 'down' : 'up');
      const tgt = s.def.tgt ? T[s.def.tgt] : null;
      let st = '—', cls = 'mute';
      if (tgt != null && s.cur != null) {
        const ok = s.def.hi ? s.cur >= tgt : s.cur <= tgt;
        st = ok ? '达标' : '未达标'; cls = ok ? 'ok' : 'p0';
      }
      return [
        s.def.l,
        s.cur == null ? '—' : f1(s.cur),
        s.prev == null ? '—' : f1(s.prev),
        { html: d == null ? '<span style="color:var(--ink3)">—</span>' : `<span class="delta ${dir}">${d > 0 ? '+' : ''}${d} pt</span>` },
        { html: chipP(st, cls) },
        tgt == null ? '—' : tgt + '%'
      ];
    })
  );

  const dates = agg.dates();
  const scope = dates.length ? `${esc(dates[dates.length - 1])} → ${esc(dates[0])}` : '无数据';

  return `
  <div class="sec-head">
    <h2>数据看板</h2>
    <span class="sub">${scope} · ${agg.shopNames().length} 家店 · 指标由原始记录实时聚合</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn" data-import>${ICON.down} 导入指标</button>
      <button class="btn primary" data-new="metrics">${ICON.plus} 录入指标</button>
    </div>
  </div>
  ${cfgBar()}

  <div class="card pad">
    <div class="chart-head">
      <div>
        <div style="font-size:13px;font-weight:500">采纳率 / 生成率 · 近 ${store.cfg.range} 天</div>
        <div style="font-size:11px;color:var(--ink3);margin-top:2px">虚线为目标值 · 每点为当日全组均值</div>
      </div>
      <div class="legend">
        <span><i style="background:var(--amber)"></i>采纳率</span>
        <span><i style="background:var(--info)"></i>生成率</span>
        <span><i class="dash"></i>目标 ${T.adopt} / ${T.gen}</span>
      </div>
    </div>
    <div class="chart-wrap" id="chartWrap">
      ${buildChart(series)}
      <div class="tip" id="tip"></div>
    </div>
    ${series.length ? `<div class="readout" id="readout"></div>` : ''}
  </div>

  <div class="block-title" style="margin-top:24px">六项核心指标 · 近 7 天 vs 前 7 天</div>
  ${six}

  <div class="block-title" style="margin-top:24px">单店下钻</div>
  <div id="drillBox"></div>`;
}

function renderDrill() {
  const box = $('#drillBox'); if (!box) return;
  /* 下钻只列「有指标记录」的店，92 家全列出来没意义 */
  const withData = agg.shopNames().filter(n => store.list('metrics').some(m => m.shop === n));
  const shops = withData.length ? withData : agg.shopNames();
  if (!shops.length) { box.innerHTML = emptyBlock('还没有店铺', '先到店铺库新增店铺，再录入指标', 'shops', '新增店铺'); return; }
  const sel = window.__drillShop && shops.indexOf(window.__drillShop) >= 0 ? window.__drillShop : shops[0];
  window.__drillShop = sel;
  const recs = store.list('metrics').filter(m => m.shop === sel).sort((a, b) => a.date < b.date ? 1 : -1);
  const last = recs[0];
  const T = store.cfg.targets;

  const m = METRICS.map(def => {
    const v = last ? num(last[def.k]) : null;
    const tgt = def.tgt ? T[def.tgt] : null;
    let color = '';
    if (v != null && tgt != null) color = (def.hi ? v < tgt : v > tgt) ? 'color:var(--bad)' : 'color:var(--good)';
    return `<div><div class="v" style="${color}">${v == null ? '—' : f1(v) + '%'}</div><div class="l">${def.l}${tgt != null ? ' · 目标 ' + tgt : ''}</div></div>`;
  }).join('');

  const spark = recs.slice(0, store.cfg.range).reverse();
  const sp = spark.length > 1 ? (() => {
    const vals = spark.map(r => num(r.adopt)).filter(v => v != null);
    if (!vals.length) return '';
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const w = 220, h = 34;
    const pts = spark.map((r, i) => {
      const v = num(r.adopt); if (v == null) return null;
      const px = (i / (spark.length - 1)) * w;
      const py = hi === lo ? h / 2 : h - ((v - lo) / (hi - lo)) * h;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).filter(Boolean).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:220px;height:34px;display:block" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="1.6"/></svg>`;
  })() : '';

  const breach = agg.breaches().filter(b => b.shop === sel);

  box.innerHTML = `
    <div class="toolbar">
      <div class="seg" id="drillTabs">
        ${shops.length > 10
          ? `<select id="drillSel" style="min-width:220px">${shops.map(s => `<option ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`
          : shops.map(s => `<button data-drill="${esc(s)}" class="${s === sel ? 'on' : ''}">${esc(s)}</button>`).join('')}
      </div>
    </div>
    ${last ? `
    <div class="mini-kpis four">${m}</div>
    <div style="display:flex;align-items:center;gap:14px;margin:14px 0 8px;flex-wrap:wrap">
      <div class="block-title" style="margin:0;flex:1">采纳率近 ${spark.length} 天</div>
      ${sp}
      <span style="font-family:var(--mono);font-size:11px;color:var(--ink3)">最新记录 ${esc(last.date)}</span>
      <button class="btn sm" data-new="metrics">补录</button>
    </div>
    ${breach.length ? table([{ t: '未达标指标' }, { t: '当前', n: 1 }, { t: '目标', n: 1 }, { t: '差值', n: 1 }],
      breach.map(b => [b.metric, { html: f1(b.v) }, b.tgt, { html: `<span class="delta ${b.gap < 0 ? 'down' : 'up'}">${b.gap > 0 ? '+' : ''}${b.gap} pt</span>` }]))
      : `<div class="note" style="color:var(--good)">该店所有设目标指标均已达标</div>`}
    ` : emptyBlock('该店还没有指标记录', '导入或录入后显示', 'metrics', '录入指标')}`;
}
