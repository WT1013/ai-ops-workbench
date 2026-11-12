/* ---------- 页面：店铺库（平台分组 · 缺口筛选 · 行内账号） ---------- */
const PLAT_ORDER = ['拼多多', '天猫', '京东', '抖音', '其他'];
const uiState = () => (window.__sb = window.__sb || { open: {}, acctOpen: {} });

function acctPanel(s, accts) {
  const rows = accts.length ? accts.map(a => `<tr>
      <td>${a.role ? chipP(a.role, a.role === '主账号' ? 'amber' : 'mute') : '<span class="dim">—</span>'}</td>
      <td class="mono">${a.login ? esc(a.login) : '<span class="miss">未填</span>'}</td>
      <td>${a.binder ? esc(a.binder) : '<span class="miss">未填</span>'}</td>
      <td class="mono tail-cell">${a.tail ? esc(a.tail) : '<span class="dim">••••</span>'}</td>
      <td>${esc(a.owner || '—')}</td>
      <td>${esc(a.post || '—')}</td>
      <td>${a.status === '停用' ? chipP('停用', 'p1') : chipOk('启用')}</td>
      <td>${esc(a.note || '—')}</td>
      <td>${acts('accounts', a.id)}</td>
    </tr>`).join('')
    : `<tr><td colspan="9" class="acct-empty">这家店还没有账号 —— 点右上「新增账号」，按 角色 / 登录账号 / 绑定人 / 尾号 逐项填第一条</td></tr>`;

  return `<div class="acct-panel">
    <div class="acct-head">
      <span class="acct-title">账号汇总</span>
      <span class="acct-flag">${accts.length} 个账号</span>
      <div style="margin-left:auto"><button class="btn sm primary" data-new="accounts" data-pre-shop="${esc(s.name)}">${ICON.plus} 新增账号</button></div>
    </div>
    <div class="acct-sub">账号只记「绑定人 + 手机后四位」，工作台不保存登录密码。</div>
    <div class="tbl-wrap"><table class="acct-tbl">
      <thead><tr><th>角色</th><th>登录账号</th><th>绑定人</th><th>尾号</th><th>使用人</th><th>岗位</th><th>状态</th><th>备注</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function renderStores() {
  const shops = store.list('shops');
  const acctMap = agg.accountsByShop();
  const st = uiState();

  const f = window.__storeFilter || 'all';
  const q = (window.__storeQ || '').trim().toLowerCase();

  const acctsOf = s => acctMap[s.name] || [];
  const hasAcct = s => acctsOf(s).length > 0;
  const hasOwner = s => !!(s.owner || '').trim();

  /* 店铺库只看「店 + 账号」口径，不参与采纳率等经营指标判定 */
  const statusOf = s => {
    if (s.tag === '历史' || s.opstat === '已下架') return { t: '已下架', c: 'mute' };
    if (s.auth === '未授权' || s.auth === '已失效') return { t: s.auth, c: 'p1' };
    if (!hasOwner(s)) return { t: '缺负责人', c: 'p1' };
    if (!hasAcct(s)) return { t: '缺账号', c: 'p1' };
    return { t: '正常', c: 'ok' };
  };

  const sorted = shops.slice().sort((a, b) => {
    const oa = a.order == null || a.order === '' ? 9999 : +a.order;
    const ob = b.order == null || b.order === '' ? 9999 : +b.order;
    return oa !== ob ? oa - ob : String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
  });

  const list = sorted.filter(s => {
    if (f === 'key' && s.tag !== '重点') return false;
    if (f === 'history' && s.tag !== '历史') return false;
    if (f === 'live' && s.tag === '历史') return false;
    if (f === 'noacct' && hasAcct(s)) return false;
    if (f === 'noowner' && hasOwner(s)) return false;
    if (q) {
      const hay = [s.name, s.platform, s.owner, s.binder, acctsOf(s).map(a => a.login || '').join(' ')]
        .join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  const groups = {};
  list.forEach(s => { const p = s.platform || '其他'; (groups[p] = groups[p] || []).push(s); });
  const gKeys = Object.keys(groups).sort((a, b) => {
    const ia = PLAT_ORDER.indexOf(a), ib = PLAT_ORDER.indexOf(b);
    return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b, 'zh-Hans-CN');
  });

  const forceOpen = !!q || f !== 'all';
  const anyOpen = Object.keys(st.open).some(k => st.open[k]);

  const rowsOf = items => items.map(s => {
    const stt = statusOf(s);
    const accts = acctsOf(s);
    const open = !!st.acctOpen[s.name];
    let out = `<tr class="srow${open ? ' is-open' : ''}">
      <td class="s-name">
        <button type="button" class="s-toggle" data-acct="${esc(s.name)}" aria-expanded="${open}">
          <span class="caret">${ICON.chev}</span><span class="nm">${esc(s.name)}</span>
          ${s.tag === '重点' ? '<span class="chip amber">重点</span>' : ''}
          ${s.tag === '历史' ? `<span class="chip mute" title="${esc(s.note || '')}">历史</span>` : ''}
        </button>
        ${accts.length ? `<span class="acct-flag">账号 ${accts.length}</span>` : ''}
      </td>
      <td>${chipP(stt.t, stt.c)}</td>
      <td>${hasOwner(s) ? esc(s.owner) : chipP('待分配', 'p1')}</td>
      <td>${s.binder ? esc(s.binder) : '<span class="dim">—</span>'}</td>
      <td class="n mono">${accts.length ? '<b style="font-weight:500">' + accts.length + '</b>' : '<span class="dim">—</span>'}</td>
      <td class="n">${acts('shops', s.id)}</td>
    </tr>`;
    if (open) out += `<tr class="acct-detail"><td colspan="6">${acctPanel(s, accts)}</td></tr>`;
    return out;
  }).join('');

  const body = gKeys.map(p => {
    const items = groups[p];
    const kc = items.filter(s => s.tag === '重点').length;
    const rc = items.filter(hasAcct).length;
    const missAcct = items.filter(s => !hasAcct(s)).length;
    const open = forceOpen || !!st.open[p];
    return `<section class="sgroup${open ? ' open' : ''}" data-platform="${esc(p)}">
      <div class="sg-head" data-group="${esc(p)}" role="button" tabindex="0" aria-expanded="${open}">
        <span class="sg-caret">${ICON.chev}</span>
        <span class="sg-name">${esc(p)}</span>
        <span class="sg-meta">
          <span class="sg-pill">${items.length} 家</span>
          ${kc ? `<span class="sg-pill key">重点 ${kc}</span>` : ''}
          <span class="sg-pill">已建账号 ${rc}</span>
          ${missAcct ? `<span class="sg-pill warn">缺账号 ${missAcct}</span>` : ''}
        </span>
      </div>
      <div class="sg-body">
        <div class="tbl-wrap"><table class="store-tbl">
          <thead><tr><th>店铺</th><th>状态</th><th>负责人</th><th>绑定人</th><th class="n">账号</th><th></th></tr></thead>
          <tbody>${rowsOf(items)}</tbody>
        </table></div>
      </div>
    </section>`;
  }).join('');

  const total = shops.length;
  const histN = shops.filter(s => s.tag === '历史').length;
  const liveN = total - histN;
  const liveShops = shops.filter(s => s.tag !== '历史');
  const keyN = liveShops.filter(s => s.tag === '重点').length;
  const noAcctN = liveShops.filter(s => !hasAcct(s)).length;
  const noOwnerN = liveShops.filter(s => !hasOwner(s)).length;
  /* 缺口按平台拆开，一眼看出是「某平台整体未接入」还是个别漏填 */
  const mixBy = pred => {
    const m = {};
    liveShops.filter(pred).forEach(s => { const p = s.platform || '其他'; m[p] = (m[p] || 0) + 1; });
    return Object.keys(m)
      .sort((a, b) => ((PLAT_ORDER.indexOf(a) < 0 ? 99 : PLAT_ORDER.indexOf(a)) - (PLAT_ORDER.indexOf(b) < 0 ? 99 : PLAT_ORDER.indexOf(b))))
      .map(p => `${p} ${m[p]}`).join(' · ');
  };
  const noOwnerMix = mixBy(s => !hasOwner(s));
  const noAcctMix = mixBy(s => !hasAcct(s));
  const acctAll = store.list('accounts');
  const acctN = acctAll.length;
  const acctStopN = acctAll.filter(a => a.status === '停用').length;

  const tabs = [
    { k: 'all', l: '全部', n: total },
    { k: 'live', l: '在营', n: liveN },
    { k: 'key', l: '重点', n: keyN },
    { k: 'history', l: '历史/关店', n: histN },
    { k: 'noacct', l: '缺账号', n: noAcctN },
    { k: 'noowner', l: '缺负责人', n: noOwnerN }
  ];

  const owners = agg.owners().map(o => {
    const own = shops.filter(s => s.owner === o);
    const ownLive = own.filter(s => s.tag !== '历史');
    const tasks = store.list('tasks').filter(t => t.owner === o && t.status !== '已完成').length;
    return `<div class="owner">
      <div class="hd"><div class="av">${esc(o.slice(0, 1))}</div>
        <div><div class="nm">${esc(o)}</div><div class="rl">负责店铺</div></div></div>
      <div class="row2">
        <div><span>${own.length}</span><em>家店</em></div>
        <div><span>${own.filter(s => s.tag === '重点').length}</span><em>重点</em></div>
        <div><span>${ownLive.filter(s => !hasAcct(s)).length}</span><em>缺账号</em></div>
        <div><span>${tasks}</span><em>待办</em></div>
      </div></div>`;
  }).join('');

  return `
  <div class="sec-head">
    <h2>店铺库</h2>
    <span class="sub">${liveN} 家在营 · ${histN} 家历史/关店 · 账号 ${acctN} 条 · 缺账号 ${noAcctN} · 缺负责人 ${noOwnerN}</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn" data-go="assets">资产库 ${store.list('assets').length} 份 →</button>
      <button class="btn primary" data-new="shops">${ICON.plus} 新增店铺</button>
    </div>
  </div>

  <div class="vault">
    <div class="vault-l">
      <span class="vault-ic">${ICON.lock}</span>
      <div>
        <b>账号信息 · 只记绑定人与尾号</b>
        <span class="vault-t">${acctN} 条账号 · ${acctStopN} 条已停用。工作台不再保存登录密码，账号名下只留绑定人与其手机号后四位，团队共用时可对照核对。</span>
      </div>
    </div>
    <div class="vault-r">
      <button class="btn sm" data-new="accounts">${ICON.plus} 补一条账号</button>
    </div>
  </div>

  <div class="store-stats">
    <div class="ss"><em>在营店铺</em><b>${liveN}</b><i>${gKeys.length} 个平台 · 历史 ${histN}</i></div>
    <div class="ss"><em>重点店铺</em><b>${keyN}</b><i>需重点跟进</i></div>
    <div class="ss"><em>账号总数</em><b>${acctN}</b><i>覆盖 ${Object.keys(acctMap).length} 家店</i></div>
    <div class="ss ${noAcctN ? 'warn' : ''}"><em>缺账号</em><b>${noAcctN}</b><i>${noAcctMix || '登录信息待补'}</i></div>
    <div class="ss ${noOwnerN ? 'warn' : ''}"><em>缺负责人</em><b>${noOwnerN}</b><i>${noOwnerMix || '待指派'}</i></div>
  </div>

  <div class="toolbar">
    <div class="seg" id="storeTabs">
      ${tabs.map(t => `<button data-f="${t.k}" class="${f === t.k ? 'on' : ''}">${t.l}<b>${t.n}</b></button>`).join('')}
    </div>
    <label class="search">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6L14 14"/></svg>
      <input id="storeSearch" placeholder="搜索店铺 / 负责人 / 账号" value="${esc(window.__storeQ || '')}" />
    </label>
    ${forceOpen ? '' : `<button class="btn sm" data-expand="${anyOpen ? 'none' : 'all'}">${anyOpen ? '收起全部' : '展开全部'}</button>`}
    <div style="margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink3)">显示 ${list.length} / ${total} 家</div>
  </div>

  ${gKeys.length ? body : emptyBlock('没有匹配的店铺', '换个关键词或筛选条件试试')}

  <div class="block-title" style="margin-top:26px">负责人聚合 · ${agg.owners().length} 位</div>
  <div class="owners">${owners || emptyBlock('还没有负责人', '编辑店铺时填写负责人')}</div>`;
}
