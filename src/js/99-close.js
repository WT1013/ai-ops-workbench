/* 对外的运行时接口：设置页里的「自定义脚本」通过 window.__OPS__ 访问这些 */
window.__OPS__ = {
  store: store, render: render, go: go, toast: toast, cloud: cloud,
  KINDS: KINDS, PAGES: PAGES,
  TX: TX, applyTexts: applyTexts, applyUserCode: applyUserCode,
  canEdit: canEdit, setEditMode: setEditMode, tryUnlock: tryUnlock, dataCache: () => dataCache,
  refreshDataCsv: refreshDataCsv, dataStatusText: dataStatusText,
  $: $, $$: $$, esc: esc, uid: uid, num: num, openForm: openForm, openModal: openModal
};
})();
