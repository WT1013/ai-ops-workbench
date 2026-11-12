/* ---------- init ---------- */
store.initCfg();
initMode();
(async function boot() {
  await auth.restore();
  await enterApp();
  initMode();
  startDataSync();
})();
