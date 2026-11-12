/* ---------- 页面：信号带 ---------- */
function renderSignal() {
  const c = agg.counts();
  const T = store.cfg.targets;
  const alerts = store.list('alerts')
    .filter(a => a.status !== '已处理')
    .sort((a, b) => (a.level || 'P9').localeCompare(b.level || 'P9'));

  const kpis = [
    { v: c.alertOpen, l: '待处理预警', k: 'alert' },
    { v: c.badShops, l: '未达标店铺', k: 'warn' },
    { v: c.keyShops, l: '重点店铺' },
    { v: c.records, l: '指标记录' },
    { v: c.tasksTodo, l: '未完成任务' },
    { v: c.qcActive, l: '生效规则' },
    { v: c.apiDown, l: '接口异常', k: c.apiDown ? 'alert' : 'good' }
  ].map(k => `<div class="kpi ${k.k || ''}"><div class="v">${k.v}</div><div class="l">${k.l}</div></div>`).join('');

  const rows = alerts.map(a => `
    <div class="arow" data-lv="${esc(a.level || 'P2')}">
      <div>${lvlChip(a.level || 'P2')}</div>
      <div style="font-size:11.5px;color:var(--ink3)">${esc(a.type || '—')}</div>
      <div>
        <div class="t">${esc(a.shop || '—')}</div>
        <div class="d">${esc(a.desc || '')}</div>
      </div>
      <div class="due ${a.due && a.due < todayStr() ? 'late' : ''}">${a.due ? (a.due < todayStr() ? '逾期 · ' : '') + esc(a.due.slice(5)) : '—'}</div>
      <div class="act">${acts('alerts', a.id, { done: 1, doneLabel: '标记已处理' })}</div>
    </div>`).join('');

  const ins = agg.insight();
  let insHtml;
  if (!ins) {
    insHtml = emptyBlock('暂无指标数据', '导入 OMS 数据后会自动生成洞察', null);
  } else {
    const w = ins.worst;
    const hit = w.v < T.adopt;
    insHtml = `<div class="insight">
      <h3><em>INSIGHT</em><span>${hit
        ? `最该修的是 ${esc(w.shop)} —— 采纳率 ${f1(w.v)}%，比目标 ${T.adopt}% 低 ${f1(T.adopt - w.v)} pt`
        : `全组采纳率均达标（目标 ${T.adopt}%），最低为 ${esc(w.shop)} ${f1(w.v)}%`}</span></h3>
      <div class="ev">依据：${ins.total} 家店最新一条指标记录中，<b>${ins.below}</b> 家低于采纳率目标 <b>${T.adopt}%</b>；
        最低为 <b>${esc(w.shop)}</b>（<b>${f1(w.v)}%</b>），日期 <b>${esc(w.rec.date)}</b>。
        ${hit ? '建议今天优先核查该店的比价 / 价格类应答。' : '可把精力放在生成率与转化率的提升上。'}</div>
      <div class="insight-acts">
        <button class="btn primary" data-go="board">去数据看板下钻</button>
        <button class="btn ghost" data-new="alerts">就其上报预警</button>
      </div>
    </div>`;
  }

  return `
  <div class="sec-head">
    <h2>今日信号带</h2>
    <span class="sub">${todayStr()} · 待处理 ${c.alertOpen} 项</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn" data-import>${ICON.down} 导入指标</button>
      <button class="btn primary" data-new="alerts">${ICON.plus} 上报预警</button>
    </div>
  </div>
  <div class="kpis">${kpis}</div>

  <div class="sec-head" style="margin-top:24px">
    <h2 style="font-size:13px;font-weight:500">待处理预警 ${alerts.length} 项</h2>
    <span class="sub">按级别排序</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn sm" data-go="qc">查看质检规则</button>
    </div>
  </div>
  ${alerts.length ? `<div class="alist">${rows}</div>` : emptyBlock('没有待处理预警', '所有预警都已处理完', 'alerts', '上报预警')}

  <div class="block-title" style="margin-top:26px">今日洞察 · 规则自动推导</div>
  ${insHtml}`;
}
