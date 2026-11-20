# AI运营组工作台

多店铺运营工作台。**单文件前端 + WorkBuddy 云库 + CSV 数据源**：
登录后使用，全组共用一份云端数据；数据一直存在 WorkBuddy 云库（应用 `wbapp_6H4ne4Pivj47cmkaQcnAzt`）里，没有换过存储位置。

- 线上入口（正式）：https://ai-ops-workbench-43332.app.workbuddy.host/?sharecode=L6I6SZYJ54
- 源码镜像：https://wt1013.github.io/ai-ops-workbench/（只作源码展示，云端接口跨域不可用）
- 源码仓库：https://github.com/WT1013/ai-ops-workbench
- 当前版本：v6.8（`config/app.config.json → app.version`）
- 云端：WorkBuddy 云服务，表 `wb_records` / `wb_kv`；配置见 `config/app.config.json → wb`
- **迁移与协作规程：[MIGRATION.md](MIGRATION.md)**（权限、发布、防覆盖都在里面）

---

## 1. 三十秒上手

```bash
npm run check          # 自检：语法 / 禁用词 / 体积
npm run build          # 构建 → dist/ + docs/（含 data/ 与 config/）
npm run serve          # 本地预览 http://127.0.0.1:8790/
```

必须用 `npm run serve` 以 http 打开，**不要双击 html 用 file:// 打开**——浏览器会拦云端请求。

## 2. 权限模型（v6.8 起只有一种身份）

| 谁 | 能看到 | 能改 | 怎么进 |
|---|---|---|---|
| 没有账号的人 | 看不到任何数据（登录门禁） | — | 打不开 |
| 登录的组内成员 | 全部页面与数据 | 数据 / 文案 / 页面 / 自定义代码 | 打开链接 → 登录 |

- **没有「只读预览」也没有「成员编辑」两套模式，也没有编辑码**：登录就能增删改。
- 数据只有一份：团队云端库。谁改完，其他人 **15 秒内**自动看到（切回页面 / 网络恢复时立即对一次）。
- 删除是真删：本机不会用旧快照把同事刚加的行冲掉，也不会把删掉的行补回来。
- 谁能登录由 WorkBuddy 账号体系决定；把链接给外部的人，他们看到的是登录页，看不到数据。

## 3. 数据源

| 通道 | 文件 / 表 | 作用 | 生效 |
|---|---|---|---|
| 云端库（唯一真相） | `wb_records` / `wb_kv` | 所有增删改都写这里 | 保存即写库，其他人 15 秒内拉到 |
| CSV | `data/*.csv`（8 张表） | 只在云端这一类**还没有数据**时用来播种 | 首屏播种；平时不覆盖 |

- 平时改数据请直接在界面上改（或店铺库的「导入店铺/账号」）。
- CSV 会自动覆盖云端吗？不会。只有设置页手动点「从数据源重建」才按 id 覆盖。
- 为什么这么定：以前每次对账都把 CSV 合回来，会把界面上删掉的账号又补回来，两个人就各看到各的版本。

## 4. 目录结构

```
config/app.config.json   项目公共配置：云端连接 / 数据源 / 公共连接器
data/                    CSV 数据源 + manifest.json（构建生成）
  shops accounts metrics alerts tasks qc assets apis .csv
skills/                  项目用到的技能指令（SKILL.md 抄录）
src/
  build.cjs              构建：模块清单、版本号、注入配置、生成数据清单、安全闸
  js/                    逻辑，按顺序拼进同一个作用域（25 个模块）
    00-head              工具函数
    01-metrics           指标定义（唯一权威）
    02-seed              离线种子数据（CSV 不可用时的兜底）
    03-store             云端读写、差分同步、删除墓碑、对账指纹
    04-aggregate         聚合统计
    05-overlay           弹窗 / toast
    06-forms             表单定义与提交
    07-import            指标导入
    08-ui-kit            通用组件（表格 / chip / 内联编辑）
    09-chart             折线图
    10~16-page-*         七个业务页面
    17~20                路由、导航、图表交互、全局事件
    21-theme             主题
    22-auth              登录门禁、启动流程、每 15 秒云端对账
    23-page-settings     设置页（文案 / 自定义代码 / 数据源状态）
    24-data-sync         CSV 拉取、轮询、时间戳合并
    25-mode              权限 shim（登录即可写，兼容旧调用）
    29-init / 99-close   入口与出口
  styles/                6 个样式模块
signal-board-v1-static.html  HTML 骨架
scripts/                 check / serve / export-data
tests/                   regression（功能回归）+ collab（增删改 / 同步 / 数据源）
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
| 权限 / 谁能改 | `js/25-mode.js`（现在恒为可写）+ 云端登录门禁 `js/22-auth.js` |
| 云端同步节奏 | `js/22-auth.js` 的 `SYNC_POLL_MS`（默认 15 秒） |
| 数据源同步规则 | `js/24-data-sync.js` |
| 云端地址 / 表名 / 轮询间隔 / 连接器 | `config/app.config.json` |
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
node tests/collab.cjs               # 增删改 / 删除不被 CSV 补回 / 数据源
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
