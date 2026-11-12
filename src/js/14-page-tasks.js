/* ---------- 页面：协同任务 ---------- */
function renderTasks() {
  const tasks = store.list('tasks');
  const cols = [
    { k: '待办', cls: '' },
    { k: '进行中', cls: 'doing' },
    { k: '已完成', cls: 'done' }
  ];
  const card = t => `<div class="tcard ${t.status === '已完成' ? 'done' : ''}">
    <div class="tt">${esc(t.title || '(无标题)')}</div>
    <div class="tf">
      ${t.prio ? lvlChip(t.prio) : chipOk('已完成')}
      <span class="who">${esc(t.owner || '—')}</span>
      <span class="when ${t.due && t.due < todayStr() && t.status !== '已完成' ? 'late' : ''}">${esc(t.due ? t.due.slice(5) : '—')}</span>
      ${acts('tasks', t.id, t.status !== '已完成' ? { done: 1, doneLabel: '标记已完成' } : {})}
    </div>
  </div>`;

  const board = cols.map(c => {
    const arr = tasks.filter(t => (t.status || '待办') === c.k);
    return `<div class="col ${c.cls}">
      <div class="col-hd"><span class="dot"></span><span class="nm">${c.k}</span><span class="ct">${arr.length}</span></div>
      ${arr.length ? arr.map(card).join('') : `<div style="padding:14px 4px;font-size:11px;color:var(--ink3);text-align:center">暂无</div>`}
    </div>`;
  }).join('');

  return `
  <div class="sec-head">
    <h2>协同与任务</h2>
    <span class="sub">待办 ${tasks.filter(t => t.status === '待办' || !t.status).length} ·
      进行中 ${tasks.filter(t => t.status === '进行中').length} ·
      已完成 ${tasks.filter(t => t.status === '已完成').length}</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn primary" data-new="tasks">${ICON.plus} 新增任务</button>
    </div>
  </div>
  <div class="kanban">${board}</div>

  <div class="block-title" style="margin-top:26px">任务清单</div>
  ${table([{ t: '标题' }, { t: '负责人' }, { t: '优先级' }, { t: '状态' }, { t: '截止' }, { t: '类型' }, { t: '' }],
    tasks.map(t => [
      { html: `<span style="font-weight:500">${esc(t.title || '')}</span>` },
      t.owner || '—',
      { html: lvlChip(t.prio || 'P2') },
      { html: stChip(t.status || '待办') },
      { html: `<span style="font-family:var(--mono);font-size:11.5px">${esc(t.due || '—')}</span>` },
      { html: `<span style="color:var(--ink2)">${esc(t.type || '—')}</span>` },
      { html: acts('tasks', t.id, t.status !== '已完成' ? { done: 1 } : {}) }
    ]), '还没有任务')}`;
}
