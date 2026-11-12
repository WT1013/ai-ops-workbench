/* ---------- 页面：资产库 ---------- */
const ASSET_TYPES = ['话术模板', '知识切片', '词表', '配置', '业务流程', 'AI 技能', '其他'];

function renderAssets() {
  const all = store.list('assets');
  const f = window.__assetF || 'all';
  const q = (window.__assetQ || '').trim().toLowerCase();

  const cnt = t => all.filter(a => (a.type || '其他') === t).length;
  const byState = s => all.filter(a => (a.status || '草稿') === s).length;
  const live = byState('已生效'), draft = byState('草稿'), arch = byState('已归档');

  let list = all.slice();
  if (f !== 'all') list = list.filter(a => (a.type || '其他') === f);
  if (q) list = list.filter(a => [a.name, a.type, a.cat, a.shop, a.owner, a.note, a.url]
    .join(' ').toLowerCase().indexOf(q) >= 0);

  const tabs = [{ k: 'all', l: '全部', n: all.length }]
    .concat(ASSET_TYPES.map(t => ({ k: t, l: t, n: cnt(t) })).filter(x => x.n));

  const rows = list.map(a => [
    { html: `<span style="font-weight:500">${esc(a.name)}</span>
      ${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener" style="margin-left:6px;font-size:10.5px;color:var(--amber)">打开 ↗</a>` : ''}
      ${a.note ? `<div style="font-size:10.5px;color:var(--ink3);margin-top:2px;line-height:1.5">${esc(a.note)}</div>` : ''}` },
    { html: chipP(a.type || '其他', a.type === '业务流程' ? 'amber' : a.type === 'AI 技能' ? 'ok' : 'mute') },
    { html: `<span style="color:var(--ink2)">${esc(a.cat || '—')}</span>` },
    { html: `<span style="font-family:var(--mono);font-size:11.5px">${esc(a.shop || '—')}</span>` },
    { html: `<span style="color:var(--ink2)">${esc(a.owner || '—')}</span>` },
    { html: `<span style="font-family:var(--mono);font-size:11.5px;color:var(--ink3)">${esc(a.date || '—')}</span>` },
    { html: stChip(a.status || '草稿') },
    { html: acts('assets', a.id) }
  ]);

  const steps = [
    { ix: '01', nm: '登记', ds: '新建资产默认草稿，只有登记人与负责人可见', n: all.length, u: '份已登记' },
    { ix: '02', nm: '评审', ds: '负责人核对口径与话术，冲突项退回重写', n: draft, u: '份待评审' },
    { ix: '03', nm: '生效', ds: '生效后自动挂到关联店铺的回复与质检链路', n: live, u: '份生效中' },
    { ix: '04', nm: '归档', ds: '过期或换版后留档，不再参与调用', n: arch, u: '份已归档' }
  ];

  return `
  <div class="sec-head">
    <h2>资产库</h2>
    <span class="sub">${all.length} 份资产 · 已生效 ${live} · 草稿 ${draft} · ${new Set(all.map(a => a.owner).filter(Boolean)).size} 位负责人</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn primary" data-new="assets">${ICON.plus} 新增资产</button>
    </div>
  </div>

  <div class="mini-kpis four">
    <div><div class="v">${all.length}</div><div class="l">资产总数</div></div>
    <div><div class="v" style="color:var(--good)">${live}</div><div class="l">已生效</div></div>
    <div><div class="v" style="color:var(--warn)">${draft}</div><div class="l">草稿待评审</div></div>
    <div><div class="v" style="color:var(--ink3)">${arch}</div><div class="l">已归档</div></div>
  </div>

  <div class="toolbar" style="margin-top:14px">
    <div class="seg" id="assetTabs">
      ${tabs.map(t => `<button data-f="${esc(t.k)}" class="${f === t.k ? 'on' : ''}">${esc(t.l)}<b>${t.n}</b></button>`).join('')}
    </div>
    <label class="search">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6L14 14"/></svg>
      <input id="assetSearch" placeholder="搜索资产 / 分类 / 店铺 / 负责人" value="${esc(window.__assetQ || '')}" />
    </label>
    <div style="margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink3)">显示 ${list.length} / ${all.length} 份</div>
  </div>

  ${table([{ t: '资产' }, { t: '类型' }, { t: '分类' }, { t: '关联店铺' }, { t: '负责人' }, { t: '更新' }, { t: '状态' }, { t: '' }],
    rows, '还没有资产，点右上「新增资产」登记话术模板 / 词表 / 流程 / AI 技能')}

  <div class="block-title" style="margin-top:26px">资产全流程</div>
  <div class="flow">
    ${steps.map(s => `<div>
      <div class="st">${s.ix}</div>
      <div class="nm">${s.nm}</div>
      <div class="ds">${s.ds}</div>
      <div class="ds" style="margin-top:8px;color:var(--ink2);font-family:var(--mono)">${s.n} ${s.u}</div>
    </div>`).join('')}
  </div>`;
}

function bindAssets() {
  const tabs = $('#assetTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    window.__assetF = b.dataset.f; render();
  });
  const q = $('#assetSearch');
  if (q) q.addEventListener('input', () => {
    window.__assetQ = q.value;
    clearTimeout(window.__assetTimer);
    window.__assetTimer = setTimeout(render, 220);
  });
}
