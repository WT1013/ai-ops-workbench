/* ---------- init ---------- */
store.initCfg();
initMode();
(async function boot() {
  showLoading('正在检查登录状态…');
  const s = await auth.restore();
  if (!s) { hideLoading(); showGate(); return; }
  enterApp(s);
})();
