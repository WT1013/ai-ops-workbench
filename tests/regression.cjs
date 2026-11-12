/**
 * 端到端回归（本机模式，不需要登录、不碰线上数据）
 *
 * 用法：
 *   node src/build.cjs --stub            # 生成 tmp/stub.html（云配置清空 → 本机模式）
 *   cp tmp/stub.html dist/stub.html
 *   node scripts/serve.cjs 8790          # 另开一个窗口
 *   node tests/regression.cjs            # 默认访问 http://127.0.0.1:8790/stub.html
 *
 * 需要 playwright。若没装在项目里，用 PLAYWRIGHT_DIR 指过去：
 *   PLAYWRIGHT_DIR=D:/tools/node_modules node tests/regression.cjs
 * 本机 Chrome 路径可用 CHROME_PATH 覆盖。
 */
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

const URL = process.argv[2] || process.env.TARGET_URL || 'http://127.0.0.1:8790/stub.html';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = ['signal', 'board', 'stores', 'tasks', 'assets', 'qc', 'api'];
const LS_DB = 'wb.signal.v3.db';
const LS_CFG = 'wb.signal.v3.cfg';
const LS_ME = 'wb.signal.v3.me';

let failed = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failed++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 100)); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav button', { timeout: 30000 });
  await page.waitForTimeout(1600);

  /* 1) 打开即用：没有登录门禁，直接进主界面 */
  const gate = await page.evaluate(() => ({
    gate: !!document.getElementById('gate'),
    started: !!window.__started,
    boot: !!document.getElementById('boot')
  }));
  check('打开即用（无登录门禁）', !gate.gate && gate.started && !gate.boot, gate);

  /* 2) 种子数据落本机 */
  const seed = await page.evaluate(k => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const db = (JSON.parse(raw) || {}).db || {};
    const out = {};
    ['shops', 'accounts', 'metrics'].forEach(c => { out[c] = (db[c] || []).length; });
    return out;
  }, LS_DB);
  check('种子数据（128 店 / 291 账号）', seed && seed.shops === 128 && seed.accounts === 291, seed);

  /* 3) 七个页面都能渲染 */
  const seen = [];
  for (const id of PAGES) {
    await page.evaluate(x => { const b = document.querySelector(`#nav [data-go="${x}"]`); if (b) b.click(); }, id);
    await page.waitForTimeout(240);
    seen.push(await page.evaluate(() => document.querySelector('#viewport').innerText.trim().length > 40));
  }
  check('七个页面渲染', seen.every(Boolean), seen);

  /* 4) 目标值：改一次 → 写进本机配置 */
  await page.evaluate(() => { const b = document.querySelector('#nav [data-go="board"]'); if (b) b.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const i = document.querySelector('[data-tgt="adopt"]');
    i.value = '66';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const cfg = await page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, LS_CFG);
  check('目标值立即生效并落本机', cfg && Number(cfg.targets.adopt) === 66, cfg && cfg.targets);

  /* 5) 我是谁：填名字 → 侧栏显示 + 本机记住 */
  await page.evaluate(() => document.getElementById('uOut').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const i = document.getElementById('meInp');
    i.value = '王涛';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-mb]')];
    const ok = btns.find(b => b.textContent.trim() === '保存');
    if (ok) ok.click();
  });
  await page.waitForTimeout(400);
  const me = await page.evaluate(k => ({
    ls: localStorage.getItem(k),
    name: (document.getElementById('uName') || {}).textContent,
    av: (document.getElementById('uAv') || {}).textContent
  }), LS_ME);
  check('「我是谁」记名并回显', me.ls === '王涛' && me.name === '王涛' && me.av === '王', me);

  /* 6) 店铺库：账号表列头与尾号 */
  await page.evaluate(() => { const b = document.querySelector('#nav [data-go="stores"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.querySelector('[data-expand="all"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-acct]')].filter(x => x.offsetParent)[0]; if (b) b.click(); });
  await page.waitForTimeout(500);
  const acct = await page.evaluate(() => {
    const t = document.querySelector('.acct-tbl');
    if (!t) return null;
    const heads = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const rows = [...t.querySelectorAll('tr')]
      .filter(tr => tr.querySelector('td'))
      .slice(0, 3).map(tr => [...tr.children].map(td => td.textContent.trim()));
    return { heads, rows };
  });
  check('账号表：绑定人 / 尾号（无密码列）', acct && acct.heads.indexOf('绑定人') >= 0 && acct.heads.indexOf('尾号') >= 0
    && acct.heads.indexOf('密码') < 0 && /^\d{4}$/.test(acct.rows[0][3]), acct && acct.heads);

  /* 7) 控制台 */
  check('控制台无报错', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  console.log(failed ? `\n回归失败：${failed} 项` : '\n回归全部通过');
  process.exit(failed ? 1 : 0);
})();
