   表单定义
   ========================================================= */
const FORMS = {
  shops: {
    title: '店铺', key: 'shops',
    fields: [
      { k: 'name', l: '店铺名称', t: 'text', req: 1, full: 1 },
      { k: 'platform', l: '平台', t: 'select', req: 1, opts: ['天猫', '京东', '拼多多', '抖音', '其他'] },
      { k: 'tag', l: '标签', t: 'select', opts: ['重点', '常规'] },
      { k: 'owner', l: '负责人', t: 'select', opts: () => agg.owners().length ? agg.owners() : ['王涛', '远山', '张欣', '思思'] },
      { k: 'binder', l: '绑定人', t: 'text', tip: '这个店绑在谁名下' },
      { k: 'order', l: '排序', t: 'num', tip: '数字越小越靠前' },
      { k: 'auth', l: '授权状态', t: 'select', opts: ['', '已授权', '未授权', '已失效'] },
      { k: 'opstat', l: '运营状态', t: 'select', opts: ['运营中', '暂停', '已下架'] },
      { k: 'third', l: 'thirdShopId', t: 'text', tip: 'OMS 侧店铺 ID' },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  accounts: {
    title: '店铺账号', key: 'accounts',
    fields: [
      { k: 'shop', l: '所属店铺', t: 'select', req: 1, full: 1, opts: () => agg.shopNames() },
      { k: 'role', l: '账号角色', t: 'select', opts: () => agg.roles() },
      { k: 'login', l: '登录账号', t: 'text', req: 1, tip: '拼多多子账号名 / 手机号 / 邮箱' },
      { k: 'binder', l: '绑定人', t: 'text', tip: '这个账号绑在谁名下' },
      { k: 'tail', l: '尾号 4 位', t: 'text', tip: '绑定人手机号后四位，只存尾号', max: 4 },
      { k: 'owner', l: '使用人', t: 'text', tip: '公用 / 云子 / 具体人名' },
      { k: 'post', l: '岗位', t: 'select', opts: ['客服', '拼多多客服', '组长', '管理员', '探域', '申诉', '公用', '外包客服', '外包售前', '前置'] },
      { k: 'status', l: '状态', t: 'select', opts: ['启用', '停用'] },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  metrics: {
    title: '指标', key: 'metrics',
    fields: [
      { k: 'shop', l: '店铺', t: 'select', req: 1, opts: () => agg.shopNames() },
      { k: 'date', l: '日期', t: 'date', req: 1 },
      { k: 'adopt', l: '采纳率 %', t: 'num' },
      { k: 'gen', l: '生成率 %', t: 'num' },
      { k: 'conv', l: '转化率 %', t: 'num' },
      { k: 'risk', l: '风控率 %', t: 'num' },
      { k: 'agent', l: '纯智占比 %', t: 'num' },
      { k: 'resp', l: '回复率 %', t: 'num' },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  alerts: {
    title: '预警', key: 'alerts',
    fields: [
      { k: 'type', l: '类型', t: 'select', req: 1, opts: ['指标异常', '待审积压', '前置校验异常', '配置报错', '分组绑定', '其他'] },
      { k: 'level', l: '级别', t: 'select', req: 1, opts: ['P0', 'P1', 'P2'] },
      { k: 'shop', l: '店铺', t: 'select', req: 1, opts: () => agg.shopNames() },
      { k: 'due', l: '到期日', t: 'date' },
      { k: 'desc', l: '描述', t: 'text', req: 1, full: 1 },
      { k: 'status', l: '状态', t: 'select', opts: ['待处理', '处理中', '已处理'] },
      { k: 'note', l: '处理备注', t: 'textarea', full: 1 }
    ]
  },
  tasks: {
    title: '任务', key: 'tasks',
    fields: [
      { k: 'title', l: '标题', t: 'text', req: 1, full: 1 },
      { k: 'owner', l: '负责人', t: 'select', req: 1, opts: () => agg.owners().length ? agg.owners() : ['王涛', '远山', '张欣', '思思'] },
      { k: 'prio', l: '优先级', t: 'select', opts: ['P0', 'P1', 'P2'] },
      { k: 'status', l: '状态', t: 'select', opts: ['待办', '进行中', '已完成'] },
      { k: 'due', l: '截止日', t: 'date' },
      { k: 'type', l: '类型', t: 'select', opts: ['话术', '审核', '配置', '分组', '知识', '风控', '其他'] },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  qc: {
    title: '质检规则', key: 'qc',
    fields: [
      { k: 'name', l: '规则名称', t: 'text', req: 1, full: 1 },
      { k: 'type', l: '类型', t: 'select', opts: ['违规词', '重复', '价格', '口径冲突', '其他'] },
      { k: 'shop', l: '适用店铺', t: 'text' },
      { k: 'threshold', l: '阈值', t: 'text' },
      { k: 'level', l: '级别', t: 'select', opts: ['高', '中', '低'] },
      { k: 'hits', l: '命中次数', t: 'num' },
      { k: 'status', l: '状态', t: 'select', opts: ['生效中', '待复核', '已停用'] },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  assets: {
    title: '资产 / 配置', key: 'assets',
    fields: [
      { k: 'name', l: '资产名称', t: 'text', req: 1, full: 1 },
      { k: 'type', l: '类型', t: 'select', opts: ['话术模板', '知识切片', '词表', '配置', '业务流程', 'AI 技能', '其他'] },
      { k: 'cat', l: '分类', t: 'text' },
      { k: 'shop', l: '关联店铺', t: 'text' },
      { k: 'owner', l: '负责人', t: 'select', opts: () => agg.owners().length ? agg.owners() : ['王涛', '远山', '张欣', '思思'] },
      { k: 'status', l: '状态', t: 'select', opts: ['草稿', '已生效', '已归档'] },
      { k: 'date', l: '更新日期', t: 'date' },
      { k: 'url', l: '链接', t: 'text', full: 1 },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  },
  apis: {
    title: '接口 / 模型', key: 'apis',
    fields: [
      { k: 'name', l: '接口名称', t: 'text', req: 1, full: 1 },
      { k: 'type', l: '用途', t: 'text' },
      { k: 'shop', l: '关联店铺', t: 'text' },
      { k: 'endpoint', l: '地址 / 通道', t: 'text' },
      { k: 'status', l: '状态', t: 'select', opts: ['正常', '降级', '中断'] },
      { k: 'calls', l: '今日调用', t: 'num' },
      { k: 'errors', l: '异常次数', t: 'num' },
      { k: 'owner', l: '负责人', t: 'select', opts: () => agg.owners().length ? agg.owners() : ['王涛', '远山', '张欣', '思思'] },
      { k: 'note', l: '备注', t: 'textarea', full: 1 }
    ]
  }
};

function fieldHtml(f, val) {
  const v = val == null ? '' : val;
  const req = f.req ? '<span class="req">*</span>' : '';
  let ctl = '';
  if (f.t === 'select') {
    let opts = typeof f.opts === 'function' ? f.opts() : (f.opts || []);
    if (v && opts.indexOf(v) < 0) opts = [v].concat(opts);
    ctl = `<select name="${f.k}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.t === 'textarea') {
    ctl = `<textarea name="${f.k}" rows="2">${esc(v)}</textarea>`;
  } else if (f.t === 'password') {
    ctl = `<div class="pw-field"><input name="${f.k}" type="password" value="${esc(v)}"
      autocomplete="new-password" spellcheck="false" /><button type="button" class="pw-eye" data-eye="${f.k}" title="显示 / 隐藏密码">${ICON.eye}</button></div>`;
  } else {
    ctl = `<input name="${f.k}" type="${f.t === 'num' ? 'number' : f.t === 'date' ? 'date' : 'text'}"
      ${f.t === 'num' ? 'step="0.1"' : ''} ${f.max ? `maxlength="${f.max}"` : ''} value="${esc(v)}" ${f.t === 'num' ? 'inputmode="decimal"' : ''} />`;
  }
  return `<div class="fld ${f.full ? 'full' : ''}" data-fld="${f.k}">
    <label>${esc(f.l)}${req}</label>
    ${ctl}
    ${f.tip ? `<span class="tip">${esc(f.tip)}</span>` : ''}
    <span class="msg">必填</span>
  </div>`;
}

const DRAFT_KEY = (kind, id) => 'wb.draft.' + kind + '.' + (id || 'new');

function openForm(kind, id, preset) {
  const def = FORMS[kind];
  if (!def) return;
  const rec = id ? Object.assign({}, store.get(def.key, id) || {}) : Object.assign({}, preset || {});
  if (!id) {
    const d = { date: todayStr(), status: kind === 'tasks' ? '待办' : kind === 'alerts' ? '待处理' : '', due: todayStr() };
    Object.keys(d).forEach(k => { if (def.fields.some(f => f.k === k) && !rec[k]) rec[k] = d[k]; });
  }
  const body = `<div class="fgrid" id="frm">
      ${def.fields.map(f => fieldHtml(f, rec[f.k])).join('')}
    </div>
    <div class="draft-note" id="draftNote">已恢复上次未提交的草稿</div>`;

  openModal({
    title: (id ? '编辑' : '新增') + def.title,
    body,
    hint: id ? '修改后立即保存到本地' : '直接填写，中途关闭会自动存草稿',
    buttons: [
      { label: '取消', cls: 'ghost' },
      { label: '保存', cls: 'primary', fn: (close, root) => submitForm(kind, id, root, close) }
    ],
    onMount: (root) => {
      const frm = $('#frm', root);
      const dk = DRAFT_KEY(kind, id);
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(dk) || 'null'); } catch (e) {}
      if (draft) {
        Object.keys(draft).forEach(k => {
          const el = frm.querySelector('[name="' + k + '"]');
          if (el) el.value = draft[k];
        });
        $('#draftNote', root).classList.add('on');
      }
      let timer = null;
      frm.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const o = {};
          $$('[name]', frm).forEach(el => { if (el.value) o[el.name] = el.value; });
          try { localStorage.setItem(dk, JSON.stringify(o)); } catch (e) {}
        }, 400);
      });
      const first = frm.querySelector('[name]');
      if (first && !draft) first.focus();
    }
  });
}

function submitForm(kind, id, root, close) {
  const def = FORMS[kind];
  const frm = $('#frm', root);
  const out = {};
  let bad = null;
  def.fields.forEach(f => {
    const el = frm.querySelector('[name="' + f.k + '"]');
    const wrap = frm.querySelector('[data-fld="' + f.k + '"]');
    let v = el ? String(el.value).trim() : '';
    wrap.classList.remove('err');
    if (f.req && !v) { wrap.classList.add('err'); bad = bad || f.l; }
    if (f.t === 'num') out[f.k] = v === '' ? null : num(v);
    else out[f.k] = v;
  });
  if (bad) { toast('请填写必填项：' + bad, 'bad'); return; }

  /* 尾号只留 4 位数字 */
  if (kind === 'accounts') out.tail = tail4(out.tail);

  if (kind === 'metrics') {
    store.upsertMetric(out);
  } else if (id) {
    store.update(def.key, id, out);
  } else {
    store.add(def.key, out);
  }
  try { localStorage.removeItem(DRAFT_KEY(kind, id)); } catch (e) {}
  close();
  toast((id ? '已保存' : '已新增') + def.title, 'ok');
  render();
}

function deleteRec(kind, id) {
  const def = FORMS[kind];
  const rec = store.get(def.key, id);
  const label = rec ? (rec.name || rec.title || rec.shop || id) : id;
  confirmDialog('删除' + def.title, `确定删除「${esc(label)}」？此操作不可撤销。`, () => {
    store.remove(def.key, id);
    toast('已删除', 'ok');
    render();
  });
}

/* =========================================================
