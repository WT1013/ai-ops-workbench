   渲染工具
   ========================================================= */
const ICON = {
  edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3z"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 4.5h11M6 4.5V2.5h4v2M4 4.5l.7 9h6.6l.7-9"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8.5l3.2 3.2L13 5"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3v10M3 8h10"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10"/></svg>',
  chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5A1.5 1.5 0 009 2H3.5A1.5 1.5 0 002 3.5V9a1.5 1.5 0 001.5 1.5h2"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.6 8S3.9 3.8 8 3.8 14.4 8 14.4 8 12.1 12.2 8 12.2 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="1.9"/></svg>'
};

function table(cols, rows, emptyText) {
  const head = cols.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t)}</th>`).join('');
  const body = rows.length ? rows.map(r => `<tr>${r.map((c, i) => {
    const col = cols[i] || {};
    if (c && typeof c === 'object' && c.html != null) return `<td class="${col.n ? 'n' : ''} ${col.cls || ''}">${c.html}</td>`;
    return `<td class="${col.n ? 'n' : ''} ${col.cls || ''}">${esc(c == null ? '—' : c)}</td>`;
  }).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--ink3);padding:24px">${esc(emptyText || '暂无数据')}</td></tr>`;
  return `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function acts(kind, id, opts) {
  opts = opts || {};
  const key = FORMS[kind] ? FORMS[kind].key : kind;
  return `<div class="acts">
    ${opts.done ? `<button class="iact" data-done="${key}:${id}" title="${esc(opts.doneLabel || '标记完成')}">${ICON.check}</button>` : ''}
    <button class="iact" data-edit="${kind}:${id}" title="编辑">${ICON.edit}</button>
    <button class="iact del" data-del="${kind}:${id}" title="删除">${ICON.trash}</button>
  </div>`;
}

const chipOk = (t) => `<span class="chip ok">${esc(t)}</span>`;
const chipP = (t, c) => `<span class="chip ${c}">${esc(t)}</span>`;
const lvlChip = l => chipP(l, l === 'P0' ? 'p0' : l === 'P1' ? 'p1' : 'p2');
const stChip = s => {
  const m = { '待处理': 'p0', '处理中': 'p1', '已处理': 'ok', '待办': 'p0', '进行中': 'p1', '已完成': 'ok', '生效中': 'ok', '待复核': 'p1', '已停用': 'mute', '正常': 'ok', '降级': 'p1', '中断': 'p0', '已生效': 'ok', '草稿': 'p1', '已归档': 'mute' };
  return chipP(s, m[s] || 'mute');
};
const emptyBlock = (title, sub, newKind, newLabel) => `<div class="empty-block">
  <b>${esc(title)}</b>${esc(sub || '')}
  ${newKind ? `<div><button class="btn primary" data-new="${newKind}">${newLabel || '新增'}</button></div>` : ''}
</div>`;

function cfgBar() {
  const T = store.cfg.targets;
  return `<div class="cfg-bar">
    <span class="lbl">目标值</span>
    <label>采纳率 <input type="number" step="0.1" data-tgt="adopt" value="${T.adopt}">%</label>
    <label>生成率 <input type="number" step="0.1" data-tgt="gen" value="${T.gen}">%</label>
    <label>转化率 <input type="number" step="0.1" data-tgt="conv" value="${T.conv}">%</label>
    <label>回复率 <input type="number" step="0.1" data-tgt="resp" value="${T.resp}">%</label>
    <span class="sep">|</span>
    <label>范围
      <select data-range style="height:24px;background:var(--panel2)">
        ${[7, 14, 30].map(n => `<option value="${n}" ${store.cfg.range === n ? 'selected' : ''}>近 ${n} 天</option>`).join('')}
      </select>
    </label>
    <span style="margin-left:auto;font-size:10.5px;color:var(--ink3);font-family:var(--mono)" id="cfgSync">${cfgSyncText()}</span>
  </div>`;
}

/* ---------- 表格单元格内联编辑（点一下就能改，像 Excel） ----------
   用法：<td class="cell" data-cell="集合:记录id:字段" data-type="num" data-maxlen="4"> */
function openCellEdit(cell) {
  if (!canEdit()) { denyWrite(); return; }
  const parts = String(cell.dataset.cell || '').split(':');
  if (parts.length < 3) return;
  const coll = parts[0], id = parts[1], field = parts[2];
  const rec = store.get(coll, id);
  if (!rec) { toast('这条记录已被删除，刷新一下', 'bad'); return; }

  const isNum = cell.dataset.type === 'num';
  const maxlen = +(cell.dataset.maxlen || 0);
  const oldVal = rec[field] == null ? '' : String(rec[field]);

  const inp = document.createElement('input');
  inp.className = 'cell-inp';
  inp.value = oldVal;
  if (isNum && field !== 'tail') inp.type = 'number';
  if (maxlen) inp.maxLength = maxlen;
  cell.classList.add('editing');
  cell.textContent = '';
  cell.appendChild(inp);
  inp.focus();
  inp.select();

  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    let changed = false;
    if (save) {
      let v = inp.value.trim();
      if (maxlen) v = v.replace(/\D/g, '').slice(0, maxlen);
      let val = v;
      if (isNum) {
        if (v === '') val = null;
        else {
          val = num(v);
          if (val == null) { toast('这里只能填数字', 'bad'); }
        }
      }
      if (String(oldVal) !== String(val == null ? '' : val)) {
        store.update(coll, id, { [field]: val });
        changed = true;
      }
    }
    cell.classList.remove('editing');
    render();
    if (changed) toast('已保存 · 全组可见', 'ok');
  };

  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}
