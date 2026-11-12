/* ---------- 全局事件 ---------- */
document.addEventListener('click', e => {
  const goBtn = e.target.closest('[data-go]');
  if (goBtn) { go(goBtn.dataset.go); return; }

  /* 店铺库：平台分组折叠 */
  const grp = e.target.closest('[data-group]');
  if (grp) {
    const st = uiState(), p = grp.dataset.group;
    st.open[p] = !st.open[p];
    render(); return;
  }
  /* 店铺库：展开某店账号明细 */
  const acc = e.target.closest('[data-acct]');
  if (acc) {
    const st = uiState(), n = acc.dataset.acct;
    st.acctOpen[n] = !st.acctOpen[n];
    render(); return;
  }
  /* 店铺库：展开/收起全部平台 */
  const ex = e.target.closest('[data-expand]');
  if (ex) {
    const st = uiState();
    if (ex.dataset.expand === 'all') { PLAT_ORDER.forEach(p => { st.open[p] = true; }); }
    else { st.open = {}; }
    render(); return;
  }

  const nw = e.target.closest('[data-new]');
  if (nw) {
    const pre = {};
    if (nw.dataset.preShop) pre.shop = nw.dataset.preShop;
    openForm(nw.dataset.new, null, pre);
    return;
  }
  /* 表单：密码框显隐 */
  const eye = e.target.closest('[data-eye]');
  if (eye) {
    const inp = eye.parentNode.querySelector('input');
    if (inp) {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      eye.classList.toggle('on', show);
    }
    return;
  }

  const ed = e.target.closest('[data-edit]');
  if (ed) { const a = ed.dataset.edit.split(':'); openForm(a[0], a[1]); return; }

  const dl = e.target.closest('[data-del]');
  if (dl) { const a = dl.dataset.del.split(':'); deleteRec(a[0], a[1]); return; }

  const dn = e.target.closest('[data-done]');
  if (dn) {
    const a = dn.dataset.done.split(':');
    const key = a[0], id = a[1];
    const rec = store.get(key, id);
    if (rec) {
      const next = key === 'alerts' ? '已处理' : key === 'tasks' ? '已完成' : rec.status;
      store.update(key, id, { status: next });
      toast('已更新为「' + next + '」', 'ok');
      render();
    }
    return;
  }

  const imp = e.target.closest('[data-import]');
  if (imp) { openImport(); return; }

  const cs = e.target.closest('[data-clear-seed]');
  if (cs) {
    confirmDialog('清空示例数据',
      '将删除全部店铺、指标、预警、任务、质检、资产与接口记录，且不可恢复。<br>若只想覆盖指标，直接点「导入指标」即可，不必清空。',
      () => { store.clearAll(); toast('已清空，可从零开始', 'ok'); window.__page = 'signal'; render(); },
      '确认清空');
    return;
  }

  const drill = e.target.closest('[data-drill]');
  if (drill) {
    window.__drillShop = drill.dataset.drill;
    $$('#drillTabs button').forEach(b => b.classList.toggle('on', b === drill));
    renderDrill();
    return;
  }

  /* 设置页：恢复默认文案 */
  const treset = e.target.closest('[data-textreset]');
  if (treset) {
    store.texts = {};
    store.saveTexts().then(() => { applyTexts(); render(); toast('已恢复默认文案', 'ok'); })
      .catch(err => toast('恢复失败：' + ((err && err.message) || err), 'bad'));
    return;
  }

  /* 设置页：保存自定义 CSS / JS */
  const csave = e.target.closest('[data-codesave]');
  if (csave) {
    const css = (($('#setCss') || {}).value) || '';
    const js = (($('#setJs') || {}).value) || '';
    if (csave.dataset.codesave === 'js') {
      const bad = checkJs(js);
      if (bad) { toast('脚本有语法错误，未保存：' + bad, 'bad'); return; }
    }
    store.saveCode(css, js)
      .then(() => { applyUserCode(); toast('已保存并生效 · 所有人刷新后同样生效', 'ok'); })
      .catch(err => toast('保存失败：' + ((err && err.message) || err), 'bad'));
    return;
  }

  const cclear = e.target.closest('[data-codeclear]');
  if (cclear) {
    confirmDialog('清空自定义代码', '将删除自定义的 CSS 与 JS，外观回到默认。这个操作全组都受影响。', () => {
      store.clearCode().then(() => {
        const s = document.getElementById('userCss');
        if (s) s.remove();
        render();
        toast('已清空自定义代码', 'ok');
      });
    }, '确认清空');
    return;
  }

  /* 设置页：立即检查数据源（只读模式下也允许，纯读取） */
  const dr = e.target.closest('[data-datarefresh]');
  if (dr) {
    refreshDataCsv(false).then(changed => {
      renderDataStatus();
      if (!changed) toast(dataCache ? '已是最新（' + dataCache.version + '）' : '数据源未连上：' + dataErr, changed ? 'ok' : 'bad');
    });
    return;
  }

  /* 表格单元格内联编辑：点一下变输入框 */
  const cell = e.target.closest('[data-cell]');
  if (cell && !cell.querySelector('input')) { openCellEdit(cell); return; }
});

document.addEventListener('change', e => {
  if (e.target.id === 'drillSel') { window.__drillShop = e.target.value; renderDrill(); return; }

  /* 只读模式下即使改了控件也不落库，直接把界面恢复成库里的值 */
  if (!canEdit() && e.target.closest('[data-tgt],[data-range],[data-text]')) {
    denyWrite(); render(); return;
  }

  /* 设置页：文案改动 → 存云端 → 立即刷新界面上对应文字 */
  const tx = e.target.closest('[data-text]');
  if (tx) {
    store.setText(tx.dataset.text, tx.value)
      .then(() => { applyTexts(); toast('已保存 · 全组刷新后同样生效', 'ok'); })
      .catch(err => toast('保存失败：' + ((err && err.message) || err), 'bad'));
    return;
  }

  const t = e.target.closest('[data-tgt]');
  if (t) {
    const v = num(t.value);
    if (v == null) { toast('目标值需为数字', 'bad'); return; }
    store.cfg.targets[t.dataset.tgt] = v;
    store.saveCfg(); toast('目标值已更新 · 已同步全组', 'ok'); render(); return;
  }
  const r = e.target.closest('[data-range]');
  if (r) { store.cfg.range = +r.value; store.saveCfg(); toast('统计周期已同步全组', 'ok'); render(); }
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PAGES.length) go(PAGES[n - 1].id);
});
