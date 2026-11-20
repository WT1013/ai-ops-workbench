   启动：登录门禁 + 团队云端同步
   应用跑在 WorkBuddy 域名上（与云端接口同源）；登录后才能读写团队数据。
   登录 = 成员身份，直接进入编辑模式；未登录看不到任何数据。
   ========================================================= */
const auth = {
  session: null,
  /* 先处理 OAuth 回调，再走普通会话恢复 */
  async restore() {
    if (!cloud) {
      /* 无云配置（本地测试桩）：本机模式，身份用本机记名 */
      this.session = { user: { name: myName() } };
      return this.session;
    }
    try {
      const url = new URL(location.href);
      const hasCb = url.searchParams.has('code') || url.searchParams.has('error');
      if (hasCb) {
        const prov = url.searchParams.get('provider');
        const all = [
          ['workbuddy', cloud.auth.handleWorkBuddyCallback],
          ['wechat', cloud.auth.handleWechatWebCallback]
        ].filter(x => typeof x[1] === 'function');
        const order = prov === 'wechat' ? all.slice().reverse() : all;
        let cbErr = null;
        for (const [, fn] of order) {
          try {
            const r = await fn.call(cloud.auth);
            if (r && r.data) {
              ['code', 'state', 'provider', 'error', 'provider_id'].forEach(k => url.searchParams.delete(k));
              history.replaceState(null, '', url.pathname + url.search + url.hash);
              this.session = r.data;
              return r.data;
            }
            if (r && r.error && r.error.message) cbErr = r.error;
          } catch (e) { cbErr = cbErr || { message: e && e.message }; }
        }
        if (cbErr) toast('登录失败：' + cbErr.message, 'bad');
      }
      const s = await cloud.auth.getSession();
      this.session = (s && s.data) || null;
    } catch (e) { this.session = null; }
    return this.session;
  },
  async logout() {
    try { await cloud.auth.signOut(); } catch (e) {}
    this.session = null;
    location.reload();
  }
};

function gateMsg(t, bad) {
  const el = $('#gateMsg');
  if (!el) return;
  el.className = 'gate-msg' + (bad ? ' bad' : '');
  el.textContent = t;
}

let pendingOtp = null;
function showGate() {
  if ($('#gate')) return;
  /* GitHub Pages 镜像上云端接口跨域不可用，直接指回正式链接 */
  if (/github\.io$/i.test(location.hostname)) {
    const el = document.createElement('div');
    el.id = 'gate';
    el.className = 'gate';
    el.innerHTML = `<div class="gate-card">
      <div class="gate-brand"><span class="gate-logo" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 10.6l2.5-3.8 2.4 2.3 2.4-5.2 2.2 3.5 2.9-2.2"/></svg></span>
        <span><b>AI运营组工作台</b><i>AI OPS WORKBENCH</i></span></div>
      <p class="gate-sub">这里是源码镜像站，团队数据只在正式站上。请从正式链接进入：</p>
      <p style="font-size:13px;line-height:1.8;word-break:break-all"><a href="https://ai-ops-workbench-43332.app.workbuddy.host/" style="color:var(--amber)">https://ai-ops-workbench-43332.app.workbuddy.host/</a></p>
      <div class="gate-foot">源码与协作规范见本仓库 README。</div>
    </div>`;
    document.body.appendChild(el);
    return;
  }
  const el = document.createElement('div');
  el.id = 'gate';
  el.className = 'gate';
  el.innerHTML = `
    <div class="gate-card">
      <div class="gate-brand">
        <span class="gate-logo" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 10.6l2.5-3.8 2.4 2.3 2.4-5.2 2.2 3.5 2.9-2.2"/></svg>
        </span>
        <span><b>AI运营组工作台</b><i>AI OPS WORKBENCH</i></span>
      </div>
      <p class="gate-sub">组内共用同一份数据。登录后，店铺、账号、指标、任务改一处，所有人下次打开都能看到。</p>

      <button class="btn primary gate-wb" id="gateWb" type="button">使用 WorkBuddy 登录</button>

      <div class="gate-or"><i></i><span>或使用邮箱验证码</span><i></i></div>

      <div class="gate-row">
        <input id="gateEmail" type="email" placeholder="邮箱地址" autocomplete="email" spellcheck="false" />
        <button class="btn" id="gateSend" type="button">获取验证码</button>
      </div>
      <div class="gate-row">
        <input id="gateCode" inputmode="numeric" placeholder="邮箱收到的验证码" autocomplete="one-time-code" />
        <button class="btn primary" id="gateLogin" type="button">登录</button>
      </div>

      <div class="gate-msg" id="gateMsg"></div>
      <div class="gate-foot">数据保存在团队云端，仅登录成员可读写。</div>
    </div>`;
  document.body.appendChild(el);

  $('#gateWb').addEventListener('click', async () => {
    gateMsg('正在跳转授权…');
    const back = new URL(location.href);
    back.pathname = back.pathname.replace(/\/[^/]*$/, '/');
    ['code', 'state', 'provider', 'error'].forEach(k => back.searchParams.delete(k));
    const r = await cloud.auth.signInWithOAuth({ provider: 'workbuddy', redirectTo: back.toString() });
    if (r.error) { gateMsg(r.error.message, true); return; }
    location.assign(r.data.url);
  });

  $('#gateSend').addEventListener('click', async () => {
    const email = $('#gateEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { gateMsg('请输入正确的邮箱地址', true); return; }
    const btn = $('#gateSend');
    btn.disabled = true; btn.textContent = '发送中…';
    const r = await cloud.auth.sendOtp({ email: email });
    btn.disabled = false; btn.textContent = '重新获取';
    if (r.error) { gateMsg(r.error.message, true); return; }
    pendingOtp = { email: email, verificationId: r.data.verificationId, isExistingUser: r.data.isExistingUser };
    gateMsg('验证码已发送，请查收邮箱');
    const c = $('#gateCode'); if (c) c.focus();
  });

  $('#gateLogin').addEventListener('click', async () => {
    const code = $('#gateCode').value.trim();
    if (!pendingOtp) { gateMsg('请先获取验证码', true); return; }
    if (!code) { gateMsg('请输入邮箱收到的验证码', true); return; }
    const btn = $('#gateLogin');
    btn.disabled = true; btn.textContent = '登录中…';
    const r = await cloud.auth.verifyOtp({
      email: pendingOtp.email, verificationId: pendingOtp.verificationId,
      isExistingUser: pendingOtp.isExistingUser, token: code
    });
    btn.disabled = false; btn.textContent = '登录';
    if (r.error) { gateMsg(r.error.message, true); return; }
    pendingOtp = null;
    enterApp(r.data);
  });
}

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

/* 侧栏底部的「我」：名字（账号名优先）+ 云端状态 */
function setUserCard() {
  const name = myName();
  const av = $('#uAv'), nm = $('#uName');
  if (av) av.textContent = String(name).slice(0, 1);
  if (nm) nm.textContent = name;
  updateSyncHint();
}

/* 与云端对账：只有一种数据源（团队云端库），谁改所有人都看到。
   每 15 秒查一次「指纹」，有变化才拉全量；本机有没推上去的改动时先推再拉，
   不抢用户正在输入的内容，不弹窗。 */
const SYNC_POLL_MS = 15000;
async function pullLatest(silent) {
  if (!cloud) return false;
  if (store._flushing) return false;
  if (document.querySelector('.modal-bd')) return false;
  const ae = document.activeElement;
  if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return false;

  /* 本机还有没推上去的改动：先推，推不上去就别拉，避免把自己刚改的冲掉 */
  if (store._dirty) {
    try { await store.flush(); } catch (e) {}
    if (store._dirty) return false;
  }

  let sig = '';
  try { sig = await store.probe(); }
  catch (e) { store.cloudErr = (e && e.message) || String(e); return false; }
  if (sig && sig === store._probeSig) { store._syncedAt = Date.now(); updateSyncHint(); return false; }

  const snap = JSON.stringify(store.db) + '|' + JSON.stringify(store.cfg);
  const oldCode = JSON.stringify(store.code);
  try { await store.hydrate({ noSeed: true }); }
  catch (e) { store.cloudErr = (e && e.message) || String(e); return false; }
  store._probeSig = sig;
  store._syncedAt = Date.now();
  await store.loadTeam();
  applyTexts();
  if (JSON.stringify(store.code) !== oldCode) applyUserCode();
  store.cacheLocal();
  setUserCard();

  const changed = snap !== JSON.stringify(store.db) + '|' + JSON.stringify(store.cfg);
  if (!store.cloudErr) hideCloudNotice();
  if (changed) render();
  updateSyncHint();
  if (changed && !silent) toast('已同步同事的最新改动', 'ok');
  return changed;
}

/* 侧栏「我」下面那行：云端同步状态 + 上次对齐时间 */
function updateSyncHint() {
  const rl = $('#uRole');
  if (!rl) return;
  if (!cloud) { rl.textContent = '本机模式'; return; }
  if (store.cloudErr) { rl.textContent = '未连云端 · 存本机'; return; }
  const t = store._syncedAt;
  rl.textContent = '云端已同步' + (t ? ' · ' + agoText(t) : '');
  rl.title = '所有人共用同一份云端数据，每 ' + Math.round(SYNC_POLL_MS / 1000) + ' 秒自动对账一次';
}

/* 云端未就绪时的常驻提示条 */
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
    b.textContent = '重试';
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
/* 按当前错误状态决定提示内容：表结构问题给「重试」，网络问题只告知 */
function syncNotice() {
  if (!store.cloudErr) { hideCloudNotice(); return; }
  const needSql = /PGRST205|42P01|Could not find the table|schema cache/i.test(store.cloudErr);
  cloudNotice(
    needSql
      ? '云端已连上，但数据表不可用：请联系项目管理员检查云端库（表 wb_records / wb_kv），再点右边重试。在那之前，改动只存在你这台电脑上。'
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

/* 登录成功后：同步数据 → 起界面。登录即成员，读写一律放行 */
async function enterApp(session) {
  if (!session) return;
  store.session = session;
  const g = $('#gate'); if (g) g.remove();
  showLoading('正在同步团队数据…');
  let r = null;
  try { r = await store.hydrate(); }
  catch (e) { r = null; store.cloudErr = (e && e.message) || String(e); }
  await store.loadTeam();
  /* 数据源只在云端还没有数据时用来播种，避免把界面上删掉的行又从 CSV 补回来 */
  try { await loadDataCsv(true); mergeCsvData('auto'); } catch (e) {}
  try { store._probeSig = await store.probe(); } catch (e) {}
  store._syncedAt = Date.now();
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
  if (out) out.addEventListener('click', () => {
    openModal({
      title: '退出登录',
      body: `<div style="font-size:12.5px;line-height:1.8;color:var(--ink2)">退出后需要重新登录才能读写团队数据。</div>`,
      buttons: [{ label: '取消', cls: 'ghost' }, { label: '退出', cls: 'danger', fn: c => { c(); auth.logout(); } }]
    });
  });

  go('signal');

  /* 团队协作：每 15 秒对一次指纹，切回标签页 / 网络恢复时立刻对一次 */
  setInterval(() => { if (!document.hidden) pullLatest(true); }, SYNC_POLL_MS);
  setInterval(() => { if (!document.hidden) updateSyncHint(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullLatest(true); });
  window.addEventListener('online', () => pullLatest(false));
  window.addEventListener('focus', () => pullLatest(true));

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
