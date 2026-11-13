/* 只读/编辑模式 + CSV 数据源同步 的端到端验证 */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_DIR;
  try { return require(dir ? path.join(dir, 'playwright') : 'playwright'); }
  catch (e) {
    console.error('找不到 playwright，请先 npm i -D playwright 或设置 PLAYWRIGHT_DIR');
    process.exit(2);
  }
}
const { chromium } = loadPlaywright();

const BASE = process.env.BASE || 'http://127.0.0.1:8792/stub.html';
const SHOT = 'tmp';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  const out = [];
  const ok = (name, cond, extra) => out.push((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#modePill', { timeout: 15000 });
  await page.waitForTimeout(600);

  /* 1. 默认 = 成员编辑（登录态） */
  const ro = await page.evaluate(() => document.body.classList.contains('ro'));
  ok('默认进入成员编辑（登录态）', ro === false);
  ok('徽标文字=成员编辑', (await page.textContent('#modePill')).trim() === '成员编辑');

  /* 2. 写入口可见 + store 写入可用 */
  const addVisible = await page.evaluate(() => {
    const b = document.querySelector('[data-new]');
    return !!b && b.offsetParent !== null;
  });
  ok('新增按钮可见', addVisible === true);
  const blocked = await page.evaluate(() => {
    const O = window.__OPS__;
    const r = O.store.update('shops', 's1', { tag: '编辑测试' });
    const after = O.store.get('shops', 's1') || {};
    return { ret: r, tag: after.tag };
  });
  ok('编辑模式写入成功', blocked.ret !== null && blocked.tag === '编辑测试');

  /* 3. CSV 数据源已加载 */
  const data = await page.evaluate(() => {
    const O = window.__OPS__;
    return {
      shops: O.store.list('shops').length,
      accts: O.store.list('accounts').length,
      metrics: O.store.list('metrics').length,
      ver: (O.dataCache() || {}).version
    };
  });
  ok('CSV 店铺=128', data.shops === 128, 'got ' + data.shops);
  ok('CSV 账号=291', data.accts === 291, 'got ' + data.accts);
  ok('CSV 指标=28', data.metrics === 28, 'got ' + data.metrics);
  ok('数据源版本已记录', !!data.ver, data.ver);

  /* 4. 设置页数据源面板 */
  await page.evaluate(() => window.__OPS__.go('settings'));
  await page.waitForTimeout(400);
  const st = await page.textContent('#dataStatus');
  ok('设置页显示数据源版本', st.indexOf(data.ver) >= 0);
  ok('设置页显示行数', st.indexOf('128') >= 0);

  /* 5. 切到只读预览再切回来 */
  await page.evaluate(() => window.__OPS__.setEditMode(false, true));
  await page.waitForTimeout(300);
  const nowRo = await page.evaluate(() => ({
    ro: document.body.classList.contains('ro'),
    can: window.__OPS__.canEdit(),
    pill: document.getElementById('modePill').textContent.trim()
  }));
  ok('切到只读预览', nowRo.can === false && nowRo.ro === true, nowRo.pill);

  await page.evaluate(() => window.__OPS__.go('stores'));
  await page.waitForTimeout(400);
  const addVisible2 = await page.evaluate(() => {
    const b = document.querySelector('[data-new]');
    return !!b && b.offsetParent !== null;
  });
  ok('只读模式下新增按钮隐藏', addVisible2 === false);

  /* 6. 只读拦截 */
  const wrote = await page.evaluate(() => {
    const O = window.__OPS__;
    const r = O.store.update('shops', 's1', { tag: '只读拦截' });
    const rec = O.store.get('shops', 's1') || {};
    return { ok: r === null, tag: rec.tag === '编辑测试' };
  });
  ok('只读时 store.update 被拦截', wrote.ok && wrote.tag);
  await page.evaluate(() => window.__OPS__.setEditMode(true, true));

  /* 7. 错误编辑码不被接受 */
  const badCode = await page.evaluate(async () => {
    const O = window.__OPS__;
    try { return await O.tryUnlock('wrong-code'); } catch (e) { return 'ERR'; }
  });
  ok('错误编辑码不解锁', badCode === false, String(badCode));

  /* 8. CSV 热更新 → 自动刷新 */
  const mfPath = path.join(__dirname, '..', 'dist', 'data', 'manifest.json');
  const csvPath = path.join(__dirname, '..', 'dist', 'data', 'shops.csv');
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  const csv0 = fs.readFileSync(csvPath, 'utf8');
  fs.writeFileSync(csvPath, csv0.trimEnd() + '\nzz999,协作测试新店,天猫,常规,,,,运营中,,\n');
  fs.writeFileSync(mfPath, JSON.stringify(Object.assign({}, mf, { version: 'test-' + Date.now(), publishedAt: new Date().toISOString() }), null, 2));
  const hot = await page.evaluate(async () => {
    const O = window.__OPS__;
    const changed = await O.refreshDataCsv(false);
    return { changed, shops: O.store.list('shops').length, hit: !!O.store.get('shops', 'zz999') };
  });
  ok('CSV 变更被检测到', hot.changed === true);
  ok('新行自动进入页面', hot.shops === 129 && hot.hit === true, 'shops=' + hot.shops);

  /* 9. 还原测试数据 */
  fs.writeFileSync(csvPath, csv0);
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));

  /* 10. 正式域名口径：/data/* 静态资源必须带 sharecode，否则 403 静默失效 */
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const dataReqs = [];
  p2.on('request', r => { const u = r.url(); if (u.indexOf('/data/') >= 0) dataReqs.push(u); });
  await p2.goto(BASE + '?sharecode=TEST-SHARE-1', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(900);
  const withSc = dataReqs.filter(u => u.indexOf('sharecode=TEST-SHARE-1') >= 0).length;
  ok('数据源请求自带 sharecode', dataReqs.length > 0 && withSc === dataReqs.length,
    dataReqs.length + ' 个请求 / ' + withSc + ' 带参');
  await p2.close();

  await page.evaluate(() => window.__OPS__.go('signal'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT, 'v6-readonly.png') });

  ok('无 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n'));
  console.log('\n' + out.filter(x => x.startsWith('PASS')).length + '/' + out.length + ' passed');
  await browser.close();
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
