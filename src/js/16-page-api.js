/* ---------- 页面：AI 接口 ---------- */
function renderApi() {
  const apis = store.list('apis');
  const calls = sum(apis.map(a => num(a.calls) || 0));
  const errs = sum(apis.map(a => num(a.errors) || 0));
  const down = apis.filter(a => a.status !== '正常').length;
  const okRate = calls ? ((calls - errs) / calls * 100) : null;

  return `
  <div class="sec-head">
    <h2>AI 接口</h2>
    <span class="sub">${apis.length} 个模型 / 接口 · 今日 ${calls} 次调用 · 异常 ${errs}</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn primary" data-new="apis">${ICON.plus} 新增接口</button>
    </div>
  </div>

  <div class="mini-kpis">
    <div><div class="v" style="color:${down ? 'var(--bad)' : 'var(--good)'}">${okRate == null ? '—' : f1(okRate)}${okRate == null ? '' : '<small>%</small>'}</div><div class="l">成功率</div></div>
    <div><div class="v">${calls}</div><div class="l">今日调用</div></div>
    <div><div class="v" style="color:${down ? 'var(--bad)' : ''}">${down}</div><div class="l">异常接口</div></div>
  </div>

  <div class="block-title" style="margin-top:24px">接入清单</div>
  ${table([{ t: '名称' }, { t: '用途' }, { t: '通道' }, { t: '今日调用', n: 1 }, { t: '异常', n: 1 }, { t: '负责人' }, { t: '状态' }, { t: '' }],
    apis.map(a => [
      { html: `<span style="font-weight:500">${esc(a.name)}</span>` },
      { html: `<span style="color:var(--ink2)">${esc(a.type || '—')}</span>` },
      { html: chipP(a.endpoint || '—', 'p2') },
      a.calls == null ? '—' : a.calls,
      a.errors == null ? '—' : a.errors,
      a.owner || '—',
      { html: stChip(a.status || '正常') },
      { html: acts('apis', a.id) }
    ]), '还没有接入记录')}`;
}
