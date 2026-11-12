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

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const VERSION = 'v5.0';
const APP_NAME = 'AI运营组工作台';

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

/* 云端存储：Supabase 直连（与「远山驾驶舱」同一套方式）
   publishable key 只用于标识项目，数据权限由 Supabase 的 RLS 策略控制；
   表结构见 supabase/schema.sql。 */
const OPS_CFG = {
  url: 'https://kocuowtqklojxkhzlwpe.supabase.co',
  key: 'sb_publishable_EinGWbe2S8hHl0kqngnmIg_uyZ5xRnp',
  recTable: 'ops_records',
  kvTable: 'ops_kv'
};

/* --stub：清空密钥 → 走本机模式，供离线回归测试用 */
const STUB = !!process.env.WB_STUB || process.argv.indexOf('--stub') >= 0;
const RUNTIME_CFG = STUB ? Object.assign({}, OPS_CFG, { key: '' }) : OPS_CFG;

let h = base;

// 1) 样式
if (h.indexOf('</style>') < 0) throw new Error('骨架里找不到 </style>');
h = h.replace('</style>', '\n' + css + '\n</style>');

// 2) 标题与版本
h = h.replace('<title>工作台 · 信号带</title>', `<title>${APP_NAME} ${VERSION}</title>\n<link rel="icon" href="data:,">`);
if (h.indexOf(`${APP_NAME} ${VERSION}`) < 0) throw new Error('title 替换失败（骨架里的 <title> 可能被改过）');

// 3) 侧栏底部加 id
h = h.replace('<div class="rail-foot">', '<div class="rail-foot" id="railFoot">');

// 4) 脚本：云配置 → 应用（不再内联任何第三方 SDK，体积从 282KB 降到 ~90KB）
const anchor = h.indexOf('id="viewport"');
const s = h.indexOf('<script>', anchor);
const e = h.indexOf('</script>', s);
if (s < 0 || e < 0) throw new Error('骨架里找不到脚本占位');
const block =
  '<script>window.__OPS_CFG__=' + JSON.stringify(RUNTIME_CFG) + ';</script>\n' +
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
['WorkBuddyCloud', 'handleWorkBuddyCallback', 'sendOtp', 'showGate'].forEach(k => {
  if (h.indexOf(k) >= 0) throw new Error('产物里仍有旧登录门禁代码：' + k);
});

// 7) 输出
if (STUB) {
  const out = path.join(ROOT, 'tmp/stub.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);
  console.log('STUB build -> tmp/stub.html', Buffer.byteLength(h));
} else {
  fs.writeFileSync(path.join(ROOT, 'signal-board.html'), h);
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist/index.html'), h);
  /* GitHub Pages 发布目录（仓库 Settings → Pages 指向 main /docs） */
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs/index.html'), h);
  fs.copyFileSync(path.join(ROOT, 'supabase/schema.sql'), path.join(ROOT, 'docs/schema.sql'));
  console.log('written bytes:', Buffer.byteLength(h), 'lines:', h.split('\n').length);
}

console.log('version:', VERSION, '| app bytes:', Buffer.byteLength(js), '| cloud:', STUB ? 'local' : OPS_CFG.url);
