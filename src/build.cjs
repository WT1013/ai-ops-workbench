/**
 * 构建：src/ 下的模块 → 单文件 dist/index.html
 *
 * - 所有源码都是普通脚本（非 ESM），按下面清单顺序拼接进同一个 IIFE 作用域，
 *   因此模块之间可以直接共享变量，不需要 import/export；代价是「顺序必须对」。
 * - 新增模块：在 src/js/ 下建文件，并把文件名加进 JS_PARTS 对应位置；
 *   漏加会直接报错（末尾有校验），不会静默丢掉代码。
 * - 路径全部相对仓库根目录，任何人 clone 到任何盘符都能构建。
 */
const fs = require('fs');
const path = require('path');

const fsx = fs;
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 项目公共配置：云端连接、数据源、编辑码、公共连接器全在这一个文件里。
   换后端 / 换连接器 / 换编辑码都不用改代码，只改 config/app.config.json。 */
const PROJECT_CFG = JSON.parse(read('config/app.config.json'));
const VERSION = PROJECT_CFG.app.version;
const APP_NAME = PROJECT_CFG.app.name;

/* 拼接顺序 = 依赖顺序，不要随意调换 */
const JS_PARTS = [
  '00-head.js',          // IIFE、通用工具函数
  '01-metrics.js',       // 指标定义（唯一权威）
  '02-seed.js',          // 种子数据：店铺 / 账号 / 指标
  '03-store.js',         // 云端连接、kv、store 读写与差分同步
  '04-aggregate.js',     // 聚合统计、同步状态文案
  '05-overlay.js',       // toast / 弹窗
  '06-forms.js',         // 表单定义、字段渲染、提交
  '07-import.js',        // 指标导入（CSV/TSV/JSON 解析）
  '08-ui-kit.js',        // 渲染小工具：图标、chip、目标值配置条
  '09-chart.js',         // 折线图
  '10-page-signal.js',   // 页面：首页 · 信号带
  '11-page-board.js',    // 页面：数据看板
  '12-page-stores.js',   // 页面：店铺库
  '13-page-assets.js',   // 页面：资产库
  '14-page-tasks.js',    // 页面：协同任务
  '15-page-qc.js',       // 页面：质检风控
  '16-page-api.js',      // 页面：AI 接口
  '17-router.js',        // 路由与导航渲染
  '18-nav-icon.js',      // 侧栏图标
  '19-chart-events.js',  // 图表交互
  '20-events.js',        // 全局事件绑定
  '21-theme.js',         // 主题
  '22-auth.js',          // 登录门禁、启动流程、自动同步
  '23-page-settings.js', // 页面：工作台设置（改文案 / 在线改代码）
  '24-data-sync.js',     // 数据源：CSV 拉取、轮询、时间戳合并
  '25-mode.js',          // 访问模式：只读预览 / 成员编辑码解锁
  '29-init.js',          // 入口调用
  '99-close.js'          // IIFE 收尾
];

const CSS_PARTS = [
  '01-base.css',        // 布局、表单、弹窗、表格等基础件
  '02-theme.css',       // 配色变量
  '03-stores.css',      // 店铺库
  '04-account-bar.css', // 账号信息条
  '05-rail.css',        // 左侧栏
  '06-shell.css'        // 登录门禁、启动页
];

/* 清单漏项校验：目录里有但清单里没有 = 直接失败 */
['js', 'styles'].forEach(kind => {
  const dir = path.join(ROOT, 'src', kind);
  const list = kind === 'js' ? JS_PARTS : CSS_PARTS;
  fs.readdirSync(dir).filter(f => /\.(js|css)$/.test(f)).forEach(f => {
    if (list.indexOf(f) < 0) throw new Error(`src/${kind}/${f} 未登记进 build.cjs 的清单，构建中止`);
  });
  list.forEach(f => { if (!fs.existsSync(path.join(dir, f))) throw new Error(`清单里的文件不存在：src/${kind}/${f}`); });
});

const base = read('signal-board-v1-static.html');
const css = CSS_PARTS.map(f => read('src/styles/' + f)).join('\n');
const js = JS_PARTS.map(f => read('src/js/' + f)).join('\n');

/* 云端存储：WorkBuddy 云服务（应用 wbapp_6H4ne4Pivj47cmkaQcnAzt 的数据库）
   数据一直存在这里；打开即用（未登录走 anon 角色，权限已对 anon 开放）。 */
const WB_CFG = {
  endpoint: PROJECT_CFG.wb.endpoint,
  oauthRelayBaseUrl: PROJECT_CFG.wb.oauthRelayBaseUrl,
  publishableKey: PROJECT_CFG.wb.publishableKey
};

/* 其余运行时配置：数据源轮询、编辑码、公共连接器 */
const OPS_CFG = {
  dataBase: PROJECT_CFG.data.base,
  pollSeconds: PROJECT_CFG.data.pollSeconds,
  editSha: PROJECT_CFG.edit.codeSha256,
  editHint: PROJECT_CFG.edit.hint,
  connectors: PROJECT_CFG.connectors,
  version: VERSION
};

/* --stub：不带 SDK 与密钥 → 走本机模式，供离线回归测试用 */
const STUB = !!process.env.WB_STUB || process.argv.indexOf('--stub') >= 0;
const sdk = STUB ? '' : read('src/vendor/wb-cloud.global.js');
const WB_RUNTIME = STUB ? null : WB_CFG;

let h = base;

// 1) 样式
if (h.indexOf('</style>') < 0) throw new Error('骨架里找不到 </style>');
h = h.replace('</style>', '\n' + css + '\n</style>');

// 2) 标题与版本
h = h.replace('<title>工作台 · 信号带</title>', `<title>${APP_NAME} ${VERSION}</title>\n<link rel="icon" href="data:,">`);
if (h.indexOf(`${APP_NAME} ${VERSION}`) < 0) throw new Error('title 替换失败（骨架里的 <title> 可能被改过）');

// 3) 侧栏底部加 id
h = h.replace('<div class="rail-foot">', '<div class="rail-foot" id="railFoot">');

// 4) 脚本：云 SDK → 云配置 → 应用
const anchor = h.indexOf('id="viewport"');
const s = h.indexOf('<script>', anchor);
const e = h.indexOf('</script>', s);
if (s < 0 || e < 0) throw new Error('骨架里找不到脚本占位');
const block =
  (STUB ? '' : '<script>\n' + sdk + '\n</script>\n') +
  '<script>window.__OPS_CFG__=' + JSON.stringify(OPS_CFG) + ';' +
  (WB_RUNTIME ? 'window.__WB_CFG__=' + JSON.stringify(WB_RUNTIME) : '') + ';</script>\n' +
  '<script>\n' + js + '\n</script>';
h = h.slice(0, s) + block + h.slice(e + 9);

// 5) 挂载点
h = h.replace('</body>', '<div id="modal-root"></div>\n<div id="toast-root"></div>\n</body>');

// 6) 安全闸：不得残留明文密码 / 已下线的保险箱代码 / 旧登录门禁
['yongheng123', 'xianma123', '123yongheng'].forEach(b => {
  if (h.indexOf(b) >= 0) throw new Error('产物里仍有明文密码字面量：' + b);
});
['data-pwd', 'openVault', 'vaultPersist', '__parseXlsxRows'].forEach(k => {
  if (h.indexOf(k) >= 0) throw new Error('产物里仍有已下线的密码/保险箱代码：' + k);
});
/* 旧登录门禁代码不得回归（SDK 自带的 OAuth 工具函数不算门禁） */
['showGate'].forEach(k => {
  if (h.indexOf(k) >= 0) throw new Error('产物里仍有旧登录门禁代码：' + k);
});

/* 7) 数据源：data/*.csv → 发布目录，并生成清单（含内容哈希与发布时间）
      页面靠这份清单判断「CSV 有没有被谁改过」，改了就在 60 秒内自动刷新。 */
function buildDataManifest() {
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) throw new Error('缺少 data/ 目录：先跑 node scripts/export-data.cjs');
  const files = fs.readdirSync(dir).filter(f => /\.csv$/i.test(f)).sort();
  if (!files.length) throw new Error('data/ 里没有 CSV');
  const hash = crypto.createHash('sha256');
  const counts = {};
  files.forEach(f => {
    const buf = fs.readFileSync(path.join(dir, f));
    hash.update(f + ':').update(buf);
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    counts[f.replace(/\.csv$/i, '')] = Math.max(0, text.split('\n').filter(l => l.trim()).length - 1);
  });
  const version = hash.digest('hex').slice(0, 12);
  const mfPath = path.join(dir, 'manifest.json');
  let old = null;
  try { old = JSON.parse(fs.readFileSync(mfPath, 'utf8')); } catch (e) {}
  /* 内容没变就沿用上次的发布时间，否则每次构建都会让所有端误判「数据变了」 */
  const publishedAt = (old && old.version === version && old.publishedAt)
    ? old.publishedAt : new Date().toISOString();
  const mf = { version, publishedAt, app: VERSION, counts, files, note: 'CSV 是团队数据源；构建时自动生成，不要手改' };
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2) + '\n');
  return mf;
}

function publishData(destDir) {
  const mf = buildDataManifest();
  const dst = path.join(ROOT, destDir, 'data');
  fs.mkdirSync(dst, { recursive: true });
  mf.files.forEach(f => fs.copyFileSync(path.join(ROOT, 'data', f), path.join(dst, f)));
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(mf, null, 2) + '\n');
  return mf;
}

// 8) 输出
if (STUB) {
  const out = path.join(ROOT, 'tmp/stub.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);
  const mf = publishData('dist');
  console.log('STUB build -> tmp/stub.html', Buffer.byteLength(h), '| data', mf.version, JSON.stringify(mf.counts));
} else {
  fs.writeFileSync(path.join(ROOT, 'signal-board.html'), h);
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist/index.html'), h);
  /* GitHub Pages 发布目录（仓库 Settings → Pages 指向 main /docs） */
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs/index.html'), h);
  /* 项目公共配置也发一份，方便不开代码就能核对连接器 */
  fs.mkdirSync(path.join(ROOT, 'docs/config'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'config/app.config.json'), path.join(ROOT, 'docs/config/app.config.json'));
  const mf = publishData('dist');
  publishData('docs');
  console.log('written bytes:', Buffer.byteLength(h), 'lines:', h.split('\n').length);
  console.log('data version:', mf.version, '| publishedAt:', mf.publishedAt, '|', JSON.stringify(mf.counts));
}

console.log('version:', VERSION, '| app bytes:', Buffer.byteLength(js), '| sdk bytes:', STUB ? 0 : Buffer.byteLength(sdk), '| cloud:', STUB ? 'local' : WB_CFG.endpoint);
