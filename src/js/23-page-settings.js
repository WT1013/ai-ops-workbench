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
    <div class="set-tip">CSV 放在仓库 <code>data/</code> 目录。成员改完提交，1–2 分钟发布后，所有人的页面会在 60 秒内自动刷新。<br>
      合并规则：同一行「谁更晚谁生效」——界面改动时间晚于 CSV 发布时间就保留界面版本，否则用 CSV 覆盖；界面上新建的行不会被 CSV 删除。</div>
    <div class="set-acts">
      <button class="btn" data-datarefresh>立即检查数据源</button>
    </div>
  </div>

  <div class="block-title" style="margin-top:26px">访问与权限</div>
  <div class="set-panel">
    <table class="set-tbl"><tbody>
      <tr><td class="set-lb">当前模式</td><td><b id="modeNow">—</b></td><td class="set-def">右上角徽标可切换</td></tr>
      <tr><td class="set-lb">外部访问</td><td>只读预览</td><td class="set-def">链接发给谁，谁都能看，但改不了</td></tr>
      <tr><td class="set-lb">项目成员</td><td>输入团队编辑码后可编辑</td><td class="set-def">数据 / 页面 / 文案 / 代码</td></tr>
    </tbody></table>
  </div>

  <div class="set-tip" style="margin-top:22px">
    自定义代码存在云端，全组共用一份；谁改的会记在 <b>${esc((c.by || '—'))}</b>${c.at ? ' · ' + esc(agoText(c.at)) : ''}。
  </div>`;
  setTimeout(() => {
    renderDataStatus();
    const m = document.getElementById('modeNow');
    if (m) m.textContent = canEdit() ? '成员编辑' : '只读预览';
  }, 0);
  return html;
}
