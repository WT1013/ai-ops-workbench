# AI运营组工作台

多店铺运营工作台。**单文件前端 + 团队云端数据库**：浏览器打开即用，全组共用一份数据，谁改所有人都能看到。

- 线上入口：https://ai-ops-workbench-43332.app.workbuddy.host/?sharecode=L6I6SZYJ54
- 当前版本：v4.4（`src/build.cjs` 里的 `VERSION`）
- 云端应用 ID：`wbapp_6H4ne4Pivj47cmkaQcnAzt`

---

## 1. 三十秒上手

```bash
# 只需要 Node 18+，没有其他依赖
npm run check          # 自检：语法 / 禁用词 / 体积
npm run build          # 构建 → dist/index.html + signal-board.html
npm run serve          # 本地预览 http://127.0.0.1:8790/
```

必须用 `npm run serve` 用 http 打开，**不要双击 html 用 file:// 打开**——浏览器会拦 SDK 请求，页面只会停在「云端未连接」。

需要登录：点「使用 WorkBuddy 登录」。登录后才会读写团队数据。

## 2. 目录结构

```
src/
  build.cjs              构建脚本（模块清单 + 版本号 + 安全闸都在这）
  js/                    逻辑，按顺序拼接进同一个作用域
    00-head.js           IIFE 开头、$ / esc / num / avg 等工具函数
    01-metrics.js        指标定义（唯一权威表，改指标名先改这里）
    02-seed.js           种子数据：128 家店 / 291 条账号 / 28 条指标
    03-store.js          云端连接、kv 读写、差分同步
    04-aggregate.js      聚合统计、同步状态文案
    05-overlay.js        toast / 弹窗
    06-forms.js          表单定义、字段渲染、提交
    07-import.js         指标导入（CSV / TSV / JSON）
    08-ui-kit.js         图标、chip、目标值配置条等小件
    09-chart.js          折线图
    10~16-page-*.js      七个页面各一个文件
    17-router.js         路由与导航渲染
    18-nav-icon.js       侧栏图标
    19-chart-events.js   图表交互
    20-events.js         全局事件绑定
    21-theme.js          浅色 / 深色主题
    22-auth.js           登录门禁、启动流程、自动同步
    29-init.js           入口调用
    99-close.js          IIFE 收尾
  styles/                样式，按顺序拼接（基础 → 配色 → 各页面 → 侧栏 → 登录页）
   01-base.css 02-theme.css 03-stores.css 04-account-bar.css 05-rail.css 06-shell.css
  vendor/wb-cloud.global.js   WorkBuddy 云端 SDK（内联进产物，勿改）
  _cloud-stub.js         离线假云端，仅供本地回归
signal-board-v1-static.html   HTML 骨架（head / 侧栏 / 顶栏 / 挂载点）
scripts/
  serve.cjs              本地静态服务
  check.cjs              自检脚本
tests/
  regression.cjs         端到端回归（基于内存假云端）
dist/index.html          构建产物，发布的就是这个文件
```

## 3. 我要改 X，该动哪个文件

| 想改什么 | 改哪里 |
|---|---|
| 加/改一个指标 | `js/01-metrics.js`，再检查 `08-ui-kit.js` 和对应 `page-*.js` 的展示 |
| 首页信号带 | `js/10-page-signal.js` |
| 数据看板、图表 | `js/11-page-board.js` + `js/09-chart.js` |
| 店铺库（分组、筛选、账号面板） | `js/12-page-stores.js` + `styles/03-stores.css` |
| 任务 / 资产 / 风控 / 接口页 | `js/14-page-tasks.js`、`13-page-assets.js`、`15-page-qc.js`、`16-page-api.js` |
| 新增/删除字段 | `js/06-forms.js` 里的 `FORMS`，然后同步表格列、导入列、种子数据 |
| 侧栏、导航 | `js/17-router.js`、`js/18-nav-icon.js` + `styles/05-rail.css` |
| 配色 | `styles/02-theme.css`（全局变量）与 `styles/05-rail.css`（侧栏自带皮肤） |
| 登录页、启动页 | `js/22-auth.js` + `styles/06-shell.css` |
| 云端地址 / 密钥 / 版本号 | `src/build.cjs` 顶部 `WB_CFG`、`VERSION` |

## 4. 数据存在哪

两块，都在 WorkBuddy 云端 Postgres，同一个应用下：

| 表 | 内容 |
|---|---|
| `wb_records` | 一行一条业务记录：`key`、`coll`(集合名)、`rec_id`、`data`(JSONB) |
| `wb_kv` | 团队级配置：`meta`、`cfg`（目标值 + 统计周期） |

- 页面渲染只读内存；写操作走差分 upsert，只推改过的行，300ms 合并一次。
- 目标值等配置谁改都写同一行，看板右侧会显示「团队云端 · 某某 刚刚更新」。
- 每 60 秒自动对一次云端，切回标签页立刻对一次；弹窗打开或正在输入时不打断。
- 账号只记「绑定人 + 手机后四位」，**任何形式的密码都不进工作台**，构建脚本会拦截。

## 5. 发布（指定一人执行）

```bash
npm run check && npm run build
```

然后用 WorkBuddy 发布 `dist/`，参数必须完全一致：

| 参数 | 值 |
|---|---|
| appId | `wbapp_6H4ne4Pivj47cmkaQcnAzt` |
| domainPrefix | `ai-ops-workbench` |
| entryHtml | `index.html` |

漏掉 appId 会被当成新应用——链接会变、数据库也会换成空库。**这条是本项目最容易翻车的地方。**

## 6. 改完自测

```bash
npm run build:stub                      # 生成 tmp/stub.html（假云端，不需要登录）
cp tmp/stub.html dist/stub.html
npm run serve                           # 另开窗口
npm test                                # 跑 tests/regression.cjs
```

回归覆盖：种子数据落库、七页渲染、目标值写云并记名、拉取同事改动、账号表结构、控制台报错。

需要 playwright，若没装在项目里：
```bash
PLAYWRIGHT_DIR=/path/to/node_modules npm test
```

## 7. 红线

1. 不要在源码里写死任何密码、token、密钥（构建会失败）。
2. 不要改 `js/03-store.js` 里的既有字段名，否则线上 472 条历史数据读不出来；要加字段走兼容读取。
3. 不要改 appId / domainPrefix，不要新建应用。
4. `_cloud-stub.js`、`tests/` 只用于本地，不要进产物。
5. 提交前必须 `npm run check` 通过。

更多协作规范见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本演变见 [CHANGELOG.md](CHANGELOG.md)。
