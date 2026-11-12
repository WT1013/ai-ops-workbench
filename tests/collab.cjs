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

  /* 1. 默认只读 */
  const ro = await page.evaluate(() => document.body.classList.contains('ro'));
  ok('默认进入只读预览', ro === true);
  ok('徽标文字=只读预览', (await page.textContent('#modePill')).trim() === '只读预览');

  /* 2. 写入口被隐藏 + store 写入被拦 */
  const addVisible = await page.evaluate(() => {
    const b = document.querySelector('[data-new]');
    return !!b && b.offsetParent !== null;
  });
  ok('新增按钮不可见', addVisible === false);
  const blocked = await page.evaluate(() => {
    const O = window.__OPS__;
    const before = JSON.parse(JSON.stringify(O.store.get('shops', 's1') || {}));
    const r = O.store.update('shops', 's1', { tag: '只读测试' });
    const after = O.store.get('shops', 's1') || {};
    return { ret: r, changed: after.tag !== before.tag };
  });
  ok('只读时 store.update 被拦截', blocked.ret === null && blocked.changed === false);

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

  /* 5. 解锁编辑 */
  await page.click('#modePill');
  await page.waitForSelector('#ecInp', { timeout: 5000 });
  await page.fill('#ecInp', 'OPS-2647-KM9X');
  await page.getByRole('button', { name: '解锁' }).click();
  await page.waitForTimeout(600);
  const nowEdit = await page.evaluate(() => ({
    ro: document.body.classList.contains('ro'),
    can: window.__OPS__.canEdit(),
    pill: document.getElementById('modePill').textContent.trim()
  }));
  ok('输码后进入编辑模式', nowEdit.can === true && nowEdit.ro === false, nowEdit.pill);

  await page.evaluate(() => window.__OPS__.go('stores'));
  await page.waitForTimeout(400);
  const addVisible2 = await page.evaluate(() => {
    const b = document.querySelector('[data-new]');
    return !!b && b.offsetParent !== null;
  });
  ok('编辑模式下新增按钮可见', addVisible2 === true);

  /* 6. 编辑可用 */
  const wrote = await page.evaluate(() => {
    const O = window.__OPS__;
    const r = O.store.update('shops', 's1', { tag: '常规' });
    const rec = O.store.get('shops', 's1') || {};
    return { ok: !!r, tag: rec.tag, mt: +rec.__mt > 0 };
  });
  ok('编辑模式下写入成功', wrote.ok && wrote.tag === '常规');
  ok('写入带 __mt 时间戳', wrote.mt === true);

  /* 7. 错误码被拒 */
  await page.evaluate(() => window.__OPS__.setEditMode(false, true));
  await page.click('#modePill');
  await page.waitForSelector('#ecInp', { timeout: 5000 });
  await page.fill('#ecInp', 'wrong-code');
  await page.getByRole('button', { name: '解锁' }).click();
  await page.waitForTimeout(500);
  const stillRo = await page.evaluate(() => document.body.classList.contains('ro'));
  ok('错误编辑码不解锁', stillRo === true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

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

  await page.evaluate(() => window.__OPS__.go('signal'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT, 'v6-readonly.png') });

  ok('无 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n'));
  console.log('\n' + out.filter(x => x.startsWith('PASS')).length + '/' + out.length + ' passed');
  await browser.close();
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
