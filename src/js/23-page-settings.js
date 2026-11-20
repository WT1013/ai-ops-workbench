/* ---------- 页面：工作台设置（改文案 / 在线改代码） ---------- */

/* 可改的文案项：默认值写在代码里，store.texts 只存被改过的那些 */
const TEXTS_DEF = {
  'brand.name': 'AI运营组工作台',
  'brand.sub': 'AI OPS WORKBENCH'
};
const TEXT_LABELS = { 'brand.name': '工作台名称', 'brand.sub': '英文副标题' };
PAGES.forEach(p => {
  TEXTS_DEF['nav.' + p.id + '.name'] = p.name;
  TEXT_LABELS['nav.' + p.id + '.name'] = '菜单 · ' + p.short;
});

function TX(k) {
  const v = store.texts && store.texts[k];
  if (v != null && v !== '') return v;
  return TEXTS_DEF[k] != null ? TEXTS_DEF[k] : '';
}

/* 只改受影响的那几个 DOM，不整页重渲染，避免输入框失焦 */
function applyTexts() {
  const bn = $('#brandName'), bs = $('#brandSub');
  if (bn) bn.textContent = TX('brand.name');
  if (bs) bs.textContent = TX('brand.sub');
  document.title = TX('brand.name');
  PAGES.forEach(p => {
    const lb = document.querySelector('#nav [data-go="' + p.id + '"] .lb');
    if (lb) lb.textContent = TX('nav.' + p.id + '.name');
  });
  const cur = $('#crumb b');
  if (cur && window.__page) cur.textContent = TX('nav.' + window.__page + '.name');
  if (typeof moveGlide === 'function') moveGlide();
}

/* ---- 自定义样式 / 脚本 ---- */
function checkJs(code) {
  try { new Function(code); return null; }
  catch (e) { return e.message; }
}

function applyUserCode() {
  const old = document.getElementById('userCss');
  if (old) old.remove();
  const c = store.code || {};
  if (c.css) {
    const s = document.createElement('style');
    s.id = 'userCss';
    s.textContent = c.css;
    document.head.appendChild(s);
  }
  if (c.js) {
    const bad = checkJs(c.js);
    if (bad) { toast('自定义脚本有语法错误，已跳过：' + bad, 'bad'); return; }
    try { new Function(c.js)(); }
    catch (e) { toast('自定义脚本运行出错：' + ((e && e.message) || e), 'bad'); }
  }
}

function renderSettings() {
  const c = store.code || {};
  const keys = Object.keys(TEXTS_DEF);
  const current = keys.filter(k => store.texts && store.texts[k]).length;

  const rows = keys.map(k => {
    const v = (store.texts && store.texts[k]) || '';
    return `<tr>
      <td class="set-lb">${esc(TEXT_LABELS[k] || k)}</td>
      <td><input class="set-inp" data-text="${esc(k)}" value="${esc(v)}" placeholder="${esc(TEXTS_DEF[k])}" /></td>
      <td class="set-def">默认：${esc(TEXTS_DEF[k])}</td>
    </tr>`;
  }).join('');

  const html = `
  <div class="sec-head">
    <h2>工作台设置</h2>
    <span class="sub">改了之后所有人刷新都能看到 · 改坏了随时恢复默认</span>
    <div class="head-actions" style="margin-left:auto">
      <button class="btn" data-textreset>恢复默认文案</button>
    </div>
  </div>

  <div class="block-title" style="margin-top:20px">名称与菜单</div>
  <div class="set-panel">
    <table class="set-tbl"><tbody>${rows}</tbody></table>
    <div class="set-tip">留空 = 用默认值。当前有 ${current} 项被改过，改完点输入框外面就自动保存。</div>
  </div>

  <div class="block-title" style="margin-top:26px">自定义样式（CSS）</div>
  <div class="set-panel">
    <textarea id="setCss" class="set-code" spellcheck="false" placeholder="/* 直接写 CSS，保存后立刻生效，例如： */&#10;.r-brand b{letter-spacing:.6px}&#10;.mini-kpis .v{font-size:26px}">${esc(c.css || '')}</textarea>
    <div class="set-tip">作用于整个工作台，优先级最高。清空后点保存 = 取消自定义样式。</div>
    <div class="set-acts">
      <button class="btn primary" data-codesave="css">保存样式并生效</button>
    </div>
  </div>

  <div class="block-title" style="margin-top:26px">自定义脚本（JS）</div>
  <div class="set-panel">
    <textarea id="setJs" class="set-code" spellcheck="false" placeholder="// 页面加载完执行一次，可用 window.__OPS__ 访问数据，例如：&#10;// __OPS__.toast('今天共 ' + __OPS__.store.list('shops').length + ' 家店')">${esc(c.js || '')}</textarea>
    <div class="set-tip">保存前会做语法检查；运行出错不会白屏，只会提示并跳过。能访问 <code>__OPS__.store / render / go / toast</code>。</div>
    <div class="set-acts">
      <button class="btn primary" data-codesave="js">保存脚本并生效</button>
      <button class="btn" data-codeclear>清空全部自定义代码</button>
    </div>
  </div>

  <div class="block-title" style="margin-top:26px">数据源（团队 CSV）</div>
  <div class="set-panel">
    <div id="dataStatus"></div>
    <div class="set-tip">云端库是唯一数据源：谁改都写进同一份，所有人 15 秒内看到。<br>
      CSV 只在云端这一类还没有数据时用来播种，平时不会覆盖或补回任何行（删掉的不会被补回来）。<br>
      确实要用 CSV 重建时，点下面的「从数据源重建」，同 id 的行会被 CSV 版本覆盖。</div>
    <div class="set-acts">
      <button class="btn" data-datarefresh>立即检查数据源</button>
      <button class="btn" data-datarebuild>从数据源重建（覆盖同 id 行）</button>
    </div>
  </div>

  <div class="block-title" style="margin-top:26px">协作方式</div>
  <div class="set-panel">
    <table class="set-tbl"><tbody>
      <tr><td class="set-lb">谁能改</td><td><b>登录的组内成员都能增删改</b></td><td class="set-def">没有只读模式，也不需要编辑码</td></tr>
      <tr><td class="set-lb">数据在哪</td><td>团队云端库（同一份）</td><td class="set-def">店铺 / 账号 / 指标 / 任务 都在这里</td></tr>
      <tr><td class="set-lb">怎么同步</td><td>每 15 秒自动对账</td><td class="set-def">切回页面、网络恢复时立刻对一次</td></tr>
      <tr><td class="set-lb">删除</td><td>删了就是删了</td><td class="set-def">别人下一次对账就会看到它消失，不会被本机旧数据带回</td></tr>
    </tbody></table>
  </div>

  <div class="set-tip" style="margin-top:22px">
    自定义代码存在云端，全组共用一份；谁改的会记在 <b>${esc((c.by || '—'))}</b>${c.at ? ' · ' + esc(agoText(c.at)) : ''}。
  </div>`;
  setTimeout(() => { renderDataStatus(); }, 0);
  return html;
}
