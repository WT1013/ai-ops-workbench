/* 单人可编辑 + 全组同一份云端数据（无只读/编辑码）+ CSV 只作播种 的端到端验证 */
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
  await page.waitForSelector('#nav button', { timeout: 15000 });
  await page.waitForTimeout(600);

  /* 1. 没有只读/编辑两套模式：没有 ro 类、没有模式徽标、canEdit 恒真 */
  const mode = await page.evaluate(() => ({
    ro: document.body.classList.contains('ro'),
    pill: !!document.getElementById('modePill'),
    can: window.__OPS__.canEdit()
  }));
  ok('已无只读模式（body 无 ro 类）', mode.ro === false);
  ok('已无模式徽标', mode.pill === false);
  ok('canEdit 恒为真', mode.can === true);

  /* 2. 写入口可见 + 增删改都放行 */
  const addVisible = await page.evaluate(() => {
    const b = document.querySelector('[data-new]');
    return !!b && b.offsetParent !== null;
  });
  ok('新增按钮可见', addVisible === true);

  const write = await page.evaluate(() => {
    const O = window.__OPS__;
    const up = O.store.update('shops', 's1', { tag: '编辑测试' });
    const tag = (O.store.get('shops', 's1') || {}).tag;
    const rec = O.store.add('accounts', { shop: 'PAKEQI医疗器械旗舰店', login: '__add__:x', role: 'x', status: '启用' });
    const added = !!O.store.get('accounts', rec.id);
    O.store.remove('accounts', rec.id);
    const removed = !O.store.get('accounts', rec.id);
    return { up: up !== null, tag, added, removed };
  });
  ok('改：store.update 生效', write.up && write.tag === '编辑测试', write.tag);
  ok('增：store.add 生效', write.added === true);
  ok('删：store.remove 生效', write.removed === true);

  /* 3. CSV 数据源已加载（用来播种） */
  const data = await page.evaluate(() => {
    const O = window.__OPS__;
    return {
      shops: O.store.list('shops').length,
      accts: O.store.list('accounts').length,
      metrics: O.store.list('metrics').length,
      ver: (O.dataCache() || {}).version
    };
  });
  ok('种子 店铺=128', data.shops === 128, 'got ' + data.shops);
  ok('种子 账号=291', data.accts === 291, 'got ' + data.accts);
  ok('种子 指标=28', data.metrics === 28, 'got ' + data.metrics);
  ok('数据源版本已记录', !!data.ver, data.ver);

  /* 4. 设置页：数据源面板 + 协作说明里不再出现编辑码/只读 */
  await page.evaluate(() => window.__OPS__.go('settings'));
  await page.waitForTimeout(400);
  const st = await page.textContent('#dataStatus');
  const pageTxt = await page.textContent('#viewport');
  ok('设置页显示数据源版本', st.indexOf(data.ver) >= 0);
  ok('设置页显示行数', st.indexOf('128') >= 0);
  ok('设置页无旧模式说法', pageTxt.indexOf('只读预览') < 0 && pageTxt.indexOf('团队编辑码') < 0);
  ok('设置页写明每 15 秒对账', pageTxt.indexOf('15 秒') >= 0);

  /* 5. 删除不会被 CSV 补回来（auto 模式只在空集合时播种） */
  const del = await page.evaluate(() => {
    const O = window.__OPS__;
    const acct = O.store.list('accounts')[0];
    if (!acct) return { skip: true };
    O.store.remove('accounts', acct.id);
    const gone = !O.store.get('accounts', acct.id);
    const n0 = O.store.list('accounts').length;
    const touched = O.mergeCsvData('auto');
    const n1 = O.store.list('accounts').length;
    const stillGone = !O.store.get('accounts', acct.id);
    return { gone, touched, n0, n1, stillGone, id: acct.id };
  });
  ok('删除后记录消失', del.gone === true, del.id);
  ok('CSV 自动合并不把删掉的行补回来', del.stillGone === true && del.n1 === del.n0,
    'n0=' + del.n0 + ' n1=' + del.n1 + ' touched=' + del.touched);

  /* 6. 侧栏同步状态文案（本机桩下为「本机模式」） */
  const hint = (await page.textContent('#uRole') || '').trim();
  ok('侧栏有同步状态文案', /云端已同步|本机模式|未连云端/.test(hint), hint);

  /* 7. CSV 新版本：能检测到，但不会改已有数据（云端为准） */
  const mfPath = path.join(__dirname, '..', 'dist', 'data', 'manifest.json');
  const csvPath = path.join(__dirname, '..', 'dist', 'data', 'shops.csv');
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  const csv0 = fs.readFileSync(csvPath, 'utf8');
  fs.writeFileSync(csvPath, csv0.trimEnd() + '\nzz999,协作测试新店,天猫,常规,,,,运营中,,\n');
  fs.writeFileSync(mfPath, JSON.stringify(Object.assign({}, mf, { version: 'test-' + Date.now(), publishedAt: new Date().toISOString() }), null, 2));
  const hot = await page.evaluate(async () => {
    const O = window.__OPS__;
    const before = O.store.list('shops').length;
    const changed = await O.refreshDataCsv(false);
    return { changed, before, after: O.store.list('shops').length, hit: !!O.store.get('shops', 'zz999') };
  });
  ok('CSV 新版本被检测到', hot.changed === true);
  ok('已有数据不被 CSV 覆盖', hot.after === hot.before && hot.hit === false,
    'before=' + hot.before + ' after=' + hot.after);

  /* 8. 还原测试数据 */
  fs.writeFileSync(csvPath, csv0);
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));

  /* 9. 正式域名口径：/data/* 静态资源必须带 sharecode，否则 403 静默失效 */
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
  await page.screenshot({ path: path.join(SHOT, 'v6-single-mode.png') });

  ok('无 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n'));
  console.log('\n' + out.filter(x => x.startsWith('PASS')).length + '/' + out.length + ' passed');
  await browser.close();
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
