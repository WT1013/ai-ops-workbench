# AI运营组工作台

多店铺运营工作台。**单文件前端 + Supabase 云端数据库**：链接发给谁，谁打开就能用，全组共用一份数据，谁改所有人都能看到。

- 线上入口：https://wt1013.github.io/ai-ops-workbench/
- 源码仓库：https://github.com/WT1013/ai-ops-workbench
- 当前版本：v5.0（`src/build.cjs` 里的 `VERSION`）
- 云端：Supabase 项目 `kocuowtqklojxkhzlwpe`，表 `ops_records` / `ops_kv`

> 云端方式与「远山驾驶舱」一致：前端拿发布密钥直连数据库，不需要后端服务、不需要登录。
> 第一次部署到新 Supabase 项目时，先把 `supabase/schema.sql` 在 SQL Editor 跑一次。

---

## 1. 三十秒上手

```bash
# 只需要 Node 18+，没有其他依赖
npm run check          # 自检：语法 / 禁用词 / 体积
npm run build          # 构建 → dist/index.html + docs/index.html（发布目录）
npm run serve          # 本地预览 http://127.0.0.1:8790/
```

必须用 `npm run serve` 用 http 打开，**不要双击 html 用 file:// 打开**——浏览器会拦云端请求。

打开就是主界面，没有登录。左下角点铅笔填个名字，之后你改的东西会记上这个名字。

## 2. 目录结构

```
src/
  build.cjs              构建脚本（模块清单 + 版本号 + 云配置 + 安全闸都在这）
  js/                    逻辑，按顺序拼接进同一个作用域
    00-head.js           IIFE 开头、$ / esc / num / avg 等工具函数
    01-metrics.js        指标定义（唯一权威表，改指标名先改这里）
    02-seed.js           种子数据：128 家店 / 291 条账号 / 28 条指标
    03-store.js          Supabase 连接、kv 读写、差分同步、本机兜底
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
    22-auth.js           打开即用、我的名字、云端状态提示、自动同步
    29-init.js           入口调用
    99-close.js          IIFE 收尾
  styles/                样式，按顺序拼接（基础 → 配色 → 各页面 → 侧栏 → 启动页）
   01-base.css 02-theme.css 03-stores.css 04-account-bar.css 05-rail.css 06-shell.css
supabase/schema.sql      Supabase 建表 + 读写策略（新环境先跑这个）
signal-board-v1-static.html   HTML 骨架（head / 侧栏 / 顶栏 / 挂载点）
scripts/
  serve.cjs              本地静态服务
  check.cjs              自检脚本
tests/
  regression.cjs         端到端回归（本机模式，不碰线上数据）
docs/                    GitHub Pages 发布目录（index.html + schema.sql）
dist/index.html          构建产物
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
| 我的名字、云端提示 | `js/22-auth.js` |
| 云端地址 / 密钥 / 表名 / 版本号 | `src/build.cjs` 顶部 `OPS_CFG`、`VERSION` |

## 4. 数据存在哪

Supabase（一个托管 Postgres），两张表：

| 表 | 内容 |
|---|---|
| `ops_records` | 一行一条业务记录：`key`、`coll`(集合名)、`rec_id`、`data`(JSONB)、`updated_by` |
| `ops_kv` | 团队级配置：`cfg`（目标值 + 统计周期） |

- 页面渲染只读内存；写操作走差分 upsert，只推改过的行，300ms 合并一次，200 行一批。
- 目标值等配置谁改都写同一行，看板右侧会显示「团队云端 · 某某 刚刚更新」。
- 每 60 秒自动对一次云端，切回标签页立刻对一次；弹窗打开或正在输入时不打断。
- 云端连不上时自动落 localStorage（`wb.signal.v3.db`），顶部挂常驻提示，恢复后自动补传。
- 账号只记「绑定人 + 手机后四位」，**任何形式的密码都不进工作台**，构建脚本会拦截。

## 5. 发布

```bash
npm run check && npm run build      # 产物会同时写到 docs/index.html
```

然后提交推送到 GitHub，Pages 会自动更新（`main` 分支 `/docs` 目录）：

```bash
git add -A && git commit -m "说明改了什么"
git push origin main
```

- 站点：https://wt1013.github.io/ai-ops-workbench/
- 推送后 1~2 分钟生效；浏览器强刷（Ctrl+F5）避免旧缓存。
- Pages 的仓库设置：Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`，目录 `/docs`。**改这个设置链接就变了。**

## 6. 改完自测

```bash
npm run build:stub                      # 生成 tmp/stub.html（清空密钥 → 本机模式）
cp tmp/stub.html dist/stub.html
npm run serve                           # 另开窗口
npm test                                # 跑 tests/regression.cjs
```

回归覆盖：打开即用无门禁、种子数据落本机、七页渲染、目标值生效、我的名字、账号表结构、控制台报错。

需要 playwright，若没装在项目里：
```bash
PLAYWRIGHT_DIR=/path/to/node_modules npm test
```

## 7. 红线

1. 不要在源码里写死任何密码、token（构建会失败）。
2. 不要改 `js/03-store.js` 里的既有字段名，否则云端已有数据读不出来；要加字段走兼容读取。
3. 不要改 `OPS_CFG` 里的 Supabase 地址和表名——一改就等于换了一个空库。
4. 不要删 `docs/` 下的 `index.html`，那是线上唯一入口。
5. 提交前必须 `npm run check` 通过。

更多协作规范见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本演变见 [CHANGELOG.md](CHANGELOG.md)。
