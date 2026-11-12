   启动：打开即用 + 团队云端自动同步
   不再有登录门禁：链接发给谁，谁打开就能用；
   「我是谁」只记在本机，写库时带上名字，方便追溯是谁改的。
   ========================================================= */
const auth = {
  session: null,
  /* 不登录，身份就是一个本机名字 */
  async restore() {
    this.session = { user: { name: myName() } };
    return this.session;
  },
  rename(n) {
    const v = setMyName(n);
    this.session = { user: { name: v } };
    setUserCard();
    return v;
  }
};

function showLoading(text) {
  let el = $('#boot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'boot';
    el.className = 'boot';
    el.innerHTML = `<div class="boot-card"><span class="boot-spin"></span><b id="bootTxt"></b></div>`;
    document.body.appendChild(el);
  }
  $('#bootTxt').textContent = text || '加载中…';
  el.classList.remove('bad');
}
function showFatal(text) {
  showLoading(text);
  const el = $('#boot');
  if (el) { el.classList.add('bad'); const s = el.querySelector('.boot-spin'); if (s) s.style.display = 'none'; }
}
function hideLoading() { const el = $('#boot'); if (el) el.remove(); }

/* 侧栏底部的「我」：名字 + 云端状态 */
function setUserCard() {
  const name = myName();
  const av = $('#uAv'), nm = $('#uName'), rl = $('#uRole');
  if (av) av.textContent = String(name).slice(0, 1);
  if (nm) nm.textContent = name;
  if (rl) {
    rl.textContent = !cloud
      ? '本机模式'
      : (store.cloudErr ? '未连云端 · 存本机' : '云端已同步');
  }
}

/* 填名字：只影响标记，不影响权限 */
function askName() {
  const cur = myName();
  openModal({
    title: '我是谁',
    body: `<div style="font-size:12.5px;line-height:1.8;color:var(--ink2);margin-bottom:10px">填个名字，你改的店铺、账号、指标、任务会记上这个名字，组里一眼看出是谁动的。名字只存在你这台设备上，不会上传。</div>
      <input id="meInp" maxlength="12" placeholder="例如：王涛" value="${esc(cur === '组内成员' ? '' : cur)}"
        style="width:100%;height:34px;padding:0 10px;border:1px solid var(--line2);border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;outline:none" />`,
    buttons: [
      { label: '取消', cls: 'ghost' },
      { label: '保存', cls: 'primary', fn: c => {
        const v = auth.rename(($('#meInp') || {}).value);
        c();
        toast('已记住：' + v, 'ok');
      } }
    ]
  });
  setTimeout(() => { const i = $('#meInp'); if (i) { i.focus(); i.select(); } }, 160);
}

/* 拉取同事的最新改动：无弹窗、无正在编辑的输入、无待写入时才做，避免冲掉手上的内容 */
async function pullLatest(silent) {
  if (!cloud || store._flushing) return false;
  if (Date.now() - (store._lastWrite || 0) < 2000) return false;
  if (document.querySelector('.modal-bd')) return false;
  const ae = document.activeElement;
  if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return false;
  const snap = JSON.stringify(store.db) + '|' + JSON.stringify(store.cfg);
  const oldCode = JSON.stringify(store.code);
  try { await store.hydrate({ noSeed: true }); } catch (e) { return false; }
  await store.loadTeam();
  /* 云端拿到的是「界面改过的」部分，再把 CSV 数据源合回来（CSV 只覆盖更旧的记录） */
  if (typeof mergeCsvData === 'function') mergeCsvData();
  applyTexts();
  if (JSON.stringify(store.code) !== oldCode) applyUserCode();
  if (snap === JSON.stringify(store.db) + '|' + JSON.stringify(store.cfg)) return false;
  if (!store.cloudErr) hideCloudNotice();
  render();
  setUserCard();
  if (!silent) toast('已同步同事的最新改动', 'ok');
  return true;
}

/* 云端未就绪时的常驻提示条（最常见：数据表还没在 Supabase 建） */
function cloudNotice(msg, retry) {
  let el = document.getElementById('cloudNotice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cloudNotice';
    el.style.cssText = [
      'position:fixed', 'left:50%', 'top:54px', 'transform:translateX(-50%)', 'z-index:120',
      'display:flex', 'align-items:center', 'gap:10px', 'max-width:min(760px,92vw)',
      'padding:9px 12px', 'border-radius:10px', 'font-size:12.5px', 'line-height:1.55',
      'background:var(--warn-soft)', 'color:var(--warn)', 'border:1px solid var(--warn)',
      'box-shadow:0 8px 24px -12px rgba(10,26,32,.45)'
    ].join(';');
    document.body.appendChild(el);
  }
  el.innerHTML = `<span style="flex:1">${esc(msg)}</span>`;
  if (retry) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = '已建好，重试';
    b.style.cssText = 'height:26px;padding:0 10px;font-size:12px;white-space:nowrap';
    b.addEventListener('click', retry);
    el.appendChild(b);
  }
  return el;
}
function hideCloudNotice() {
  const el = document.getElementById('cloudNotice');
  if (el) el.remove();
}
/* 按当前错误状态决定提示内容：建表类问题给「重试」，网络问题只告知 */
function syncNotice() {
  if (!store.cloudErr) { hideCloudNotice(); return; }
  const needSql = /PGRST205|42P01|Could not find the table|schema cache/i.test(store.cloudErr);
  cloudNotice(
    needSql
      ? '云端已连上，但数据表还没建：把 supabase/schema.sql 在 Supabase 的 SQL Editor 跑一次，再点右边重试。在那之前，改动只存在你这台电脑上。'
      : '云端暂时连不上（' + store.cloudErr + '），改动先存在本机，恢复后打开页面会自动补传。',
    needSql ? retryCloud : null
  );
}
async function retryCloud() {
  hideCloudNotice();
  store.cloudErr = '';
  try { await store.hydrate(); } catch (e) { store.cloudErr = (e && e.message) || String(e); }
  setUserCard();
  render();
  if (store.cloudErr) syncNotice();
  else toast('云端已接通，团队数据已同步', 'ok');
}

/* 同步数据 → 起界面。云端挂了也照常进，先跑本机缓存 */
async function enterApp() {
  store.session = auth.session;
  showLoading('正在同步团队数据…');
  let r = null;
  try { r = await store.hydrate(); }
  catch (e) { r = null; store.cloudErr = (e && e.message) || String(e); }
  await store.loadTeam();
  /* 数据源：先把 CSV 合进来再画第一帧，避免先闪一下旧数据 */
  try { await loadDataCsv(true); mergeCsvData(); } catch (e) {}
  hideLoading();
  setUserCard();
  startApp();
  applyTexts();
  applyUserCode();
  applyMode();
  syncNotice();
  if (r && r.seeded) toast('已初始化团队数据 · ' + r.rows + ' 条记录', 'ok');
}

function startApp() {
  if (window.__started) return;
  window.__started = true;
  renderNav();
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
  });

  /* 移动端抽屉（≤920px），顶栏汉堡唤起 */
  const railEl = $('#rail');
  if (railEl) {
    railEl.classList.add('no-anim');
    const burger = $('#railBurger'), mask = $('#railMask');
    if (burger) burger.addEventListener('click', () => setDrawer(true));
    if (mask) mask.addEventListener('click', () => setDrawer(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
  }

  const out = $('#uOut');
  if (out) out.addEventListener('click', () => askName());

  go('signal');

  /* 团队协作：每 60 秒与云端对一次，切回标签页时立刻对一次 */
  setInterval(() => { if (!document.hidden) pullLatest(false); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullLatest(true); });

  /* 首帧先无动画落位，下一帧再淡入并恢复过渡，避免滑块从左上方飞入 */
  requestAnimationFrame(() => {
    moveGlide();
    requestAnimationFrame(() => {
      if (railEl) { railEl.classList.remove('no-anim'); railEl.classList.add('is-ready'); }
    });
  });
  window.addEventListener('resize', () => moveGlide());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveGlide());
}
