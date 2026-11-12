/* ---------- 页面：质检风控 ---------- */
function renderQc() {
  const qc = store.list('qc');
  const active = qc.filter(q => q.status === '生效中').length;
  const pend = qc.filter(q => q.status === '待复核').length;
  const hits = sum(qc.map(q => num(q.hits) || 0));
  const conflicts = qc.filter(q => q.type === '口径冲突');

  return `
  <div class="sec-head">
    <h2>质检风控与设置</h2>
    <span class="sub">${active} 条生效 · ${pend} 条待复核 · 近 7 天命中 ${hits}</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn primary" data-new="qc">${ICON.plus} 新增规则</button>
    </div>
  </div>

  <div class="mini-kpis">
    <div><div class="v" style="color:var(--good)">${active}</div><div class="l">生效中规则</div></div>
    <div><div class="v" style="color:var(--warn)">${pend}</div><div class="l">待复核</div></div>
    <div><div class="v">${hits}</div><div class="l">命中总数</div></div>
  </div>

  <div class="block-title" style="margin-top:24px">规则清单</div>
  ${table([{ t: '规则' }, { t: '类型' }, { t: '适用' }, { t: '阈值' }, { t: '级别' }, { t: '命中', n: 1 }, { t: '状态' }, { t: '' }],
    qc.map(q => [
      { html: `<span style="font-weight:500">${esc(q.name)}</span>` },
      { html: `<span style="color:var(--ink2)">${esc(q.type || '—')}</span>` },
      { html: `<span style="font-family:var(--mono);font-size:11.5px">${esc(q.shop || '—')}</span>` },
      q.threshold || '—',
      { html: chipP(q.level || '中', q.level === '高' ? 'p0' : q.level === '中' ? 'p1' : 'mute') },
      q.hits == null ? '—' : q.hits,
      { html: stChip(q.status || '生效中') },
      { html: acts('qc', q.id) }
    ]), '还没有质检规则')}

  ${conflicts.length ? `<div class="block-title" style="margin-top:24px">口径冲突 · 待裁决</div>
  ${table([{ t: '冲突项' }, { t: '说明' }, { t: '适用' }, { t: '状态' }, { t: '' }],
    conflicts.map(q => [
      { html: `<span style="font-weight:500">${esc(q.name)}</span>` },
      { html: `<span style="color:var(--ink2)">${esc(q.note || '—')}</span>` },
      { html: `<span style="font-family:var(--mono)">${esc(q.shop || '—')}</span>` },
      { html: stChip(q.status || '待复核') },
      { html: acts('qc', q.id) }
    ]))}
  <div class="note">口径冲突不裁决，模型会同时学到两套说法，是采纳率波动的隐性来源之一。</div>` : ''}`;
}
