/* ---------- init ---------- */
store.initCfg();
(async function boot() {
  await auth.restore();
  enterApp();
})();
