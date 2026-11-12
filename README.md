# AI运营组工作台

多店铺运营工作台。**单文件前端 + Supabase 云端库 + CSV 数据源**：
外部链接打开是**只读预览**，项目成员输团队编辑码后可编辑，全组共用一份数据。

- 线上入口：https://wt1013.github.io/ai-ops-workbench/
- 源码仓库：https://github.com/WT1013/ai-ops-workbench（私有）
- 当前版本：v6.0（`config/app.config.json → app.version`）
- 云端：Supabase 项目 `kocuowtqklojxkhzlwpe`，表 `ops_records` / `ops_kv`
- **迁移与协作规程：[MIGRATION.md](MIGRATION.md)**（权限、发布、防覆盖都在里面）

---

## 1. 三十秒上手

```bash
npm run check          # 自检：语法 / 禁用词 / 体积
npm run build          # 构建 → dist/ + docs/（含 data/ 与 config/）
npm run serve          # 本地预览 http://127.0.0.1:8790/
```

必须用 `npm run serve` 以 http 打开，**不要双击 html 用 file:// 打开**——浏览器会拦云端请求，编辑码也校验不了。

## 2. 权限模型（v6.0 新增）

| 谁 | 能看到 | 能改 | 怎么进 |
|---|---|---|---|
| 外部访问者 | 全部页面与数据 | 什么都不行 | 直接打开链接 |
| 项目成员 | 同上 | 数据 / 文案 / 页面 / 自定义代码 | 右上角徽标 → 输团队编辑码 |
| 项目管理员 | 同上 | 以上全部 + 发布 | 同上 + 仓库权限 |

- 只读是**默认态**：写入口不渲染，数据层二次拦截（`store.add/update/remove/...` 全部有门禁）。
- 编辑码只存 SHA-256 哈希在 `config/app.config.json`，代码里没有明文；换码 = 改哈希 + 重新发布。
- 前端只读是软闸，硬隔离方案见 [MIGRATION.md 第 3.4 节](MIGRATION.md)。

## 3. 两套数据源

| 通道 | 文件 / 表 | 谁改 | 生效 |
|---|---|---|---|
| CSV | `data/*.csv`（8 张表） | 会 git 的成员 | 提交 + 发布后，所有人 60 秒内自动刷新 |
| 云端 | `ops_records` / `ops_kv` | 有编辑码的成员 | 保存即写库，其他人 60 秒内拉到 |

合并规则「谁更晚谁生效」：界面改动带 `__mt`，晚于 CSV 发布时间就保留界面版本；界面新建的行不会被 CSV 删掉。
细节见 [MIGRATION.md 第 5.2 节](MIGRATION.md) 与 [data/README.md](data/README.md)。

## 4. 目录结构

```
config/app.config.json   项目公共配置：云端连接 / 数据源 / 编辑码哈希 / 公共连接器
data/                    CSV 数据源 + manifest.json（构建生成）
  shops accounts metrics alerts tasks qc assets apis .csv
skills/                  项目用到的技能指令（SKILL.md 抄录）
src/
  build.cjs              构建：模块清单、版本号、注入配置、生成数据清单、安全闸
  js/                    逻辑，按顺序拼进同一个作用域（25 个模块）
    00-head              工具函数
    01-metrics           指标定义（唯一权威）
    02-seed              离线种子数据（CSV 不可用时的兜底）
    03-store             云端读写、差分同步、写入门禁
    04-aggregate         聚合统计
    05-overlay           弹窗 / toast
    06-forms             表单定义与提交
    07-import            指标导入
    08-ui-kit            通用组件（表格 / chip / 内联编辑）
    09-chart             折线图
    10~16-page-*         七个业务页面
    17~20                路由、导航、图表交互、全局事件
    21-theme             主题
    22-auth              启动流程、我的名字、远端拉取
    23-page-settings     设置页（文案 / 自定义代码 / 数据源状态）
    24-data-sync         CSV 拉取、轮询、时间戳合并
    25-mode              只读 / 编辑模式、编辑码
    29-init / 99-close   入口与出口
  styles/                6 个样式模块
supabase/schema.sql      建表 + RLS + 授权
signal-board-v1-static.html  HTML 骨架
scripts/                 check / serve / export-data
tests/                   regression（功能回归）+ collab（权限与数据源）
docs/                    GitHub Pages 发布目录
```

## 5. 我要改 X，该动哪个文件

| 想改什么 | 改哪里 |
|---|---|
| 店铺 / 账号 / 指标等批量数据 | `data/*.csv`（改完 `npm run build`） |
| 加/改一个指标 | `js/01-metrics.js` + `08-ui-kit.js` + 对应 `page-*.js` |
| 首页信号带 | `js/10-page-signal.js` |
| 数据看板、图表 | `js/11-page-board.js` + `js/09-chart.js` |
| 店铺库 | `js/12-page-stores.js` + `styles/03-stores.css` |
| 任务 / 资产 / 风控 / 接口 | `js/14` `13` `15` `16-page-*.js` |
| 字段增删 | `js/06-forms.js` 的 `FORMS` + 表格列 + CSV 表头 + 种子 |
| 只读 / 编辑权限 | `js/25-mode.js` + `styles/06-shell.css` |
| 数据源同步规则 | `js/24-data-sync.js` |
| 云端地址 / 表名 / 轮询间隔 / 编辑码 / 连接器 | `config/app.config.json` |
| 侧栏与导航 | `js/17-router.js` `js/18-nav-icon.js` + `styles/05-rail.css` |
| 配色 | `styles/02-theme.css` |

## 6. 发布

```bash
npm run check && npm run build
git add -A && git commit -m "说明改了什么"
git push origin main
```

Pages 1–2 分钟更新，**链接不变**（分支 `main`、目录 `/docs`；改这个设置链接才会变）。
发布后按 [MIGRATION.md 4.4 节](MIGRATION.md) 做 30 秒自检。

## 7. 自测

```bash
npm run build:stub && cp tmp/stub.html dist/stub.html
npm run serve                       # 另开窗口
node tests/regression.cjs http://127.0.0.1:8790/stub.html
node tests/collab.cjs               # 只读 / 解锁 / CSV 热更新
```

需要 playwright；没装就 `PLAYWRIGHT_DIR=/path/to/node_modules npm test`。

## 8. 红线

1. 源码里不写任何密码 / token（构建会失败）。
2. 不改 `js/03-store.js` 的既有字段名；加字段走兼容读取。
3. 不改 `config/app.config.json` 里的 Supabase 地址与表名——一改等于换了空库。
4. 不删 `docs/index.html` 与 `docs/data/`，那是线上入口与数据源。
5. 不改 CSV 的 `id` 与表头。
6. 提交前必须 `npm run check` 通过；`main` 走 PR，不 `push -f`。

协作分工与冲突处理见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本演变见 [CHANGELOG.md](CHANGELOG.md)。
