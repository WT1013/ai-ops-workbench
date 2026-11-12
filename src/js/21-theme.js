/* ---------- 主题 ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sb-theme', t); } catch (e) {}
}
$('#theme').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
try { const s = localStorage.getItem('sb-theme'); setTheme(s || "light"); } catch (e) {}

/* =========================================================
