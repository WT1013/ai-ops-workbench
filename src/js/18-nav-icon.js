/* ---------- 侧栏图标：统一 15×15 线性 / stroke 1.7 / round ---------- */
const NAV_ICON = {
  signal: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 12.2a6.6 6.6 0 0 1 11.2 0"/><path d="M4.6 9.6a4.2 4.2 0 0 1 6.8 0"/><circle cx="8" cy="12.6" r="1.1"/></svg>',
  board: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 13.4h11.2"/><path d="M5 13.4V8.2M8 13.4V4.4M11 13.4V9.8"/></svg>',
  stores: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 6.4 3.5 3.2h9l1.1 3.2"/><path d="M2.4 6.4h11.2"/><path d="M3.7 6.4v7h8.6v-7"/><path d="M6.4 13.4V9.6h3.2v3.8"/></svg>',
  assets: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 13.8 5.3 8 8.4 2.2 5.3z"/><path d="M2.2 8.7 8 11.8l5.8-3.1"/><path d="M2.2 11.9 8 15l5.8-3.1"/></svg>',
  tasks: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 4.3h7.2M6.6 8h7.2M6.6 11.7h7.2"/><path d="M2.3 4.3l.9.9 1.5-1.7"/><path d="M2.3 8l.9.9 1.5-1.7"/><path d="M2.3 11.7l.9.9 1.5-1.7"/></svg>',
  qc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 13.2 4v4c0 3-2.1 5.2-5.2 6.2C4.9 13.2 2.8 11 2.8 8V4z"/><path d="M5.9 8.1 7.4 9.6l2.7-3"/></svg>',
  api: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.7 9.3 9.3 6.7"/><path d="M7.4 4.9 8.8 3.5a2.6 2.6 0 0 1 3.7 3.7l-1.4 1.4"/><path d="M8.6 11.1l-1.4 1.4a2.6 2.6 0 0 1-3.7-3.7l1.4-1.4"/></svg>'
};

/* 导航右侧挂件：数字 / 琥珀点 / 待接入小字，默认隐藏，hover·focus 才现 */
function navMeta() {
  const put = (id, val) => {
    const n = document.querySelector(`[data-meta="${id}"]`);
    if (!n) return;
    if (val === true) { n.innerHTML = '<i class="dot"></i>'; n.title = '有待办'; }
    else if (val) { n.textContent = val; }
  };
  const live = store.list('shops').filter(s => s.tag !== '历史').length;
  const assets = store.list('assets').length;
  const todo = store.list('tasks').filter(t => t.status !== '已完成').length;
  put('stores', live);
  put('assets', assets);
  put('tasks', todo);
  put('api', '待接入');
}

function renderNav() {
  const el2 = $('#nav');
  if (!el2) return;
  const groups = [];
  PAGES.forEach(p => {
    const g = groups.find(x => x.t === p.grp);
    (g || groups[groups.push({ t: p.grp, items: [] }) - 1]).items.push(p);
  });
  el2.innerHTML = groups.map(g =>
    `<div class="nav-grp-t">${esc(g.t)}</div>` +
    g.items.map(p => `<button type="button" data-go="${p.id}">
        <span class="ic">${NAV_ICON[p.id] || ''}</span>
        <span class="lb">${esc(typeof TX === 'function' ? TX('nav.' + p.id + '.name') : p.name)}</span>
        <span class="meta" data-meta="${p.id}"></span>
      </button>`).join('')
  ).join('');
  navMeta();
}

/* 单个绝对定位块承载选中态：读选中项 rect → 写 transform / width / height */
function moveGlide() {
  const g = $('#navGlide'), inner = $('#railInner');
  if (!g || !inner) return;
  const cur = $('#nav button.on');
  if (!cur) { g.style.opacity = '0'; return; }
  const ib = inner.getBoundingClientRect();
  const cb = cur.getBoundingClientRect();
  g.style.width = cb.width + 'px';
  g.style.height = cb.height + 'px';
  g.style.transform = `translate3d(${cb.left - ib.left}px, ${cb.top - ib.top}px, 0)`;
}

function setDrawer(open) {
  const rail = document.getElementById('rail');
  const mask = document.getElementById('railMask');
  const burger = document.getElementById('railBurger');
  if (!rail) return;
  rail.dataset.open = open ? 'true' : 'false';
  if (mask) mask.dataset.on = open ? 'true' : 'false';
  if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function go(id) {
  if (!RENDER[id]) id = 'signal';
  window.__page = id;
  $$('#nav button').forEach(b => {
    const on = b.dataset.go === id;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const p = PAGES.find(x => x.id === id);
  $('#crumb').innerHTML = `工作台 <i>/</i> <b>${esc(typeof TX === 'function' ? TX('nav.' + id + '.name') : p.name)}</b>`;
  $('#viewport').scrollTop = 0;
  render();
  moveGlide();
  setDrawer(false);
}

function render() {
  if (window.__rendering) return;
  window.__rendering = true;
  try {
    const ae = document.activeElement;
    if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
    const id = window.__page || 'signal';
    const seedBar = (store.db.meta && store.db.meta.seed)
      ? `<div class="seed-bar"><span><b>团队共享数据</b>　${store.list('shops').length} 家店铺 · ${store.list('accounts').length} 条账号 · ${store.list('metrics').length} 条指标记录。${store.cloudErr ? '云端暂未接通，改动先存在本机，恢复后自动补传。' : '业务数据和目标值都存在团队云端，谁改所有人都生效，约 1 分钟内自动同步（切回本页会立刻同步）。'}</span></div>` : '';
    $('#viewport').innerHTML = `<div class="view on">${seedBar}${RENDER[id]()}</div>`;
    if (id === 'board') { renderDrill(); bindChart(); }
    if (id === 'stores') bindStores();
    if (id === 'assets') bindAssets();
    updateFoot();
  } finally {
    window.__rendering = false;
  }
}

function updateFoot() {
  /* 侧栏底部改为用户卡后，这里只负责刷新导航挂件的数字 */
  navMeta();
}
