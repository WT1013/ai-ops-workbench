# 多人协作迁移手册（v6.0）

> 本文是「AI运营组工作台」从单人维护转为项目多人协作的完整迁移记录与操作规程。
> 适用对象：项目管理员（发布人）、项目成员（改代码 / 改数据的人）、外部查看者。

- 线上地址：<https://wt1013.github.io/ai-ops-workbench/>
- 代码仓库：<https://github.com/WT1013/ai-ops-workbench>（私有）
- 项目团队空间：WorkBuddy 项目网盘（`Assets` 目录）
- 版本：v6.0 · 2026-11-12

---

## 0. 一句话说清架构

```
        ┌─────────────────────── 项目团队空间（网盘）───────────────────────┐
        │  源码包 / CSV 数据源 / 技能指令 / 手册 / 历史产物（只读存档）        │
        └───────────────┬───────────────────────────────┬─────────────────┘
                        │ 成员下载、改、提交             │ 新人自助获取
                        ▼                               ▼
        ┌──────────── GitHub 私有仓库 main ────────────┐
        │  src/js/*.js  25 个模块    ← 页面与逻辑        │
        │  src/styles/*.css  6 个模块 ← 外观             │
        │  data/*.csv   8 张表       ← 业务数据源        │
        │  config/app.config.json    ← 云端与连接器      │
        └───────────────┬───────────────────────────────┘
                        │ 发布人执行 npm run build && push
                        ▼
        ┌──────── GitHub Pages（docs/）────────────────┐
        │  外部访问：只读预览，看得到、改不了            │
        │  成员访问：右上角输团队编辑码 → 可编辑         │
        └───────────────┬───────────────────────────────┘
                        │ 编辑模式下的写入
                        ▼
        ┌──────── WorkBuddy 云库（wb_records / wb_kv）─────┐
        │  界面改动落库，全组 60 秒内可见                │
        └───────────────────────────────────────────────┘
```

两条数据通道并行，职责不同：

| 通道 | 承载 | 谁改 | 生效方式 |
|---|---|---|---|
| **CSV（仓库）** | 店铺、账号、指标等批量业务数据 | 会 git 的成员 | 提交后重新发布，页面 60 秒内自动刷新 |
| **云端表（WorkBuddy 云库）** | 界面上随手改的内容、目标值、文案、自定义代码 | 拿到编辑码的成员 | 保存即写库，其他人 60 秒内拉到 |

---

## 1. 迁移清单（资产盘点）

### 1.1 源码

| 资产 | 原位置 | 现位置 | 说明 |
|---|---|---|---|
| 页面骨架 | `signal-board-v1-static.html` | 同左 | 只提供 DOM 骨架与占位，不含业务逻辑 |
| 业务逻辑 | 原 `src/app.js`（2671 行） | `src/js/` 25 个模块 | 按功能拆分，见 1.2 |
| 样式 | 原 `src/app.css`（755 行） | `src/styles/` 6 个模块 | 基础 / 主题 / 店铺 / 账号条 / 侧栏 / 外壳 |
| 构建脚本 | `src/build.cjs` | 同左 | 清单式拼接，漏登记直接报错 |
| 自检 / 预览 / 测试 | — | `scripts/`、`tests/` | `check` / `serve` / `regression` / `collab` |
| 发布产物 | 手工拷 | `docs/`（Pages 根） | `index.html` + `data/` + `config/` |
| 数据库 | — | WorkBuddy 云服务控制台 | 表与 RLS 已就绪 |
| 项目配置 | 硬编码在构建脚本里 | `config/app.config.json` | 云端地址、数据源、编辑码哈希、连接器 |

### 1.2 模块分工（按文件认领，避免互相覆盖）

| 模块 | 职责 | 建议认领人 |
|---|---|---|
| `00-head` `01-metrics` `04-aggregate` | 工具函数、指标口径、聚合算法 | 数据负责人 |
| `02-seed` | 首次离线种子数据（CSV 缺失时兜底） | 数据负责人 |
| `03-store` | 云端读写、差分同步、KV | 技术负责人 |
| `24-data-sync` | CSV 拉取、轮询、时间戳合并 | 技术负责人 |
| `25-mode` | 只读 / 编辑模式、编辑码 | 技术负责人 |
| `05-overlay` `06-forms` `08-ui-kit` `09-chart` | 弹窗、表单、通用组件、图表 | 前端 A |
| `10`~`16-page-*` | 七个业务页面 | 前端 B / 业务对接人 |
| `17-router` `18-nav-icon` `19-chart-events` `20-events` | 路由、导航、事件 | 前端 A |
| `21-theme` `22-auth` `23-page-settings` `29-init` `99-close` | 主题、启动、设置页、出口 | 技术负责人 |
| `data/*.csv` | 业务数据 | 数据负责人（**单人独占**） |
| `config/app.config.json` | 连接配置、编辑码 | 项目管理员（**单人独占**） |

### 1.3 CSV 数据源（8 张表）

| 文件 | 行数 | 主键 | 关键字段 |
|---|---|---|---|
| `data/shops.csv` | 128 | `id` | name / platform / tag / owner / binder / opstat |
| `data/accounts.csv` | 291 | `id` | shop / role / login / binder / tail / owner / status |
| `data/metrics.csv` | 28 | `id` | shop / date / adopt / gen / conv / risk / agent / resp |
| `data/alerts.csv` | 5 | `id` | type / level / shop / due / status |
| `data/tasks.csv` | 8 | `id` | title / owner / prio / status / due |
| `data/qc.csv` | 3 | `id` | name / threshold / level / hits |
| `data/assets.csv` | 6 | `id` | name / type / cat / owner / status |
| `data/apis.csv` | 3 | `id` | name / type / endpoint / calls / errors |

字段级说明见 `data/README.md`。

### 1.4 技能指令

项目实际用到的技能指令已抄录到 `skills/`（只存 `SKILL.md` 说明，脚本仍在原技能目录）：

| 技能 | 用途 | 与工作台的对应关系 |
|---|---|---|
| `tanyu-group-binding` | 探域 22 家店铺商品分组绑定 | 资产库「商品分组绑定」、任务「膝部固定器归入既有组」 |
| `tanyu-workshop-card-fix` | 调优工坊「待审核·话术未生成」闭环修复 | 预警「12 个在售 SKU 待审核」 |
| `tanyu-data-fetch` | 探域后台数据拉取（有头浏览器） | 指标数据来源 |
| `oms-code-lookup` | 商品 ID → OMS 编码 | 发货 / 前置校验异常处理 |
| `dingtalk-sheet-search` | 钉钉表格检索 | 跨组织 OMS 编码查询 |
| `deploy-ai-workbench` | 驾驶舱类应用的发布流程 | 本项目的发布动作 |

### 1.5 连接器

| 连接器 | 标识 | 归属 | 用途 |
|---|---|---|---|
| 钉钉 | `dingtalk@workbuddy-connector-plugins-official` | **项目公共** | 分组绑定通知、审批、群消息 |
| 腾讯会议 | `tmeet@workbuddy-connector-plugins-official` | **项目公共** | 周会、复盘 |
| WorkBuddy 云库 | `config/app.config.json → wb` | **项目公共** | 唯一数据后端 |

> v6.0 起，所有连接信息集中在一个文件里，任何人不再使用「自己账号下的密钥」。
> 换后端 / 换组织只改 `config/app.config.json`，无需改代码。

---

## 2. 迁移到项目团队空间

### 2.1 目录约定（网盘 Assets）

```
Assets/
├─ 01_源码/        ai-ops-workbench-v6.0-源码包.zip         ← 与仓库 main 一致的快照
├─ 02_数据源/      shops.csv / accounts.csv / ...（8 张）    ← 供不会 git 的人核对
├─ 03_技能指令/    tanyu-group-binding/SKILL.md 等 6 份
├─ 04_文档/        多人协作迁移手册.docx / MIGRATION.md
└─ 05_历史/        index.html（v4.4 存档）、交接文档 v4.2
```

### 2.2 迁移步骤

1. 本地打源码包：`git archive --format=zip -o output/ai-ops-workbench-v6.0-源码包.zip HEAD`
2. 上传到 `01_源码/`，命名带版本号，旧包不删、只归档。
3. `data/*.csv` 上传到 `02_数据源/`，**只作核对副本**；真正生效的是仓库里的那一份。
4. `skills/*/SKILL.md` 上传到 `03_技能指令/`。
5. 手册上传到 `04_文档/`。
6. 旧产物移入 `05_历史/`，不要留在根目录，避免有人点开旧链接。

### 2.3 入库前检查（三步）

```bash
git pull --rebase            # 先同步，避免 push 被拒后强行覆盖
npm run check                # 语法 + 禁用词 + 体积
npm run build                # 产物 + 数据清单
```

`npm run build` 会打印数据源版本号与各表行数，行数与预期不符就说明 CSV 被改坏了。

---

## 3. 权限设置

权限分三层，缺一层都会漏。

### 3.1 第一层：代码仓库（谁能改代码）

1. 仓库保持 **Private**。
2. `Settings → Manage access → Add people`：给成员 **Write**（不要给 Admin）。
3. `Settings → Branches → Add branch protection rule`：
   - 分支名 `main`
   - 勾选 **Require a pull request before merging**（至少 1 人 review）
   - 勾选 **Require approvals: 1**
   - 勾选 **Dismiss stale approvals when new commits are pushed**
   - 勾选 **Do not allow bypassing the above settings**（管理员也走 PR）
4. 发布权只给一个人（项目管理员）：Actions / Pages 由他操作。

### 3.2 第二层：项目团队空间（谁能改资产）

| 角色 | 网盘权限 | 说明 |
|---|---|---|
| 项目管理员 | 可编辑 | 上传发布包、维护文档 |
| 项目成员 | 可编辑 | 上传自己的产物、更新数据副本 |
| 外部协作者 | 仅查看 / 不加入 | 只给网页链接，不给网盘 |

网盘里 **不放密钥、不放数据库密码、不放团队编辑码**。

### 3.3 第三层：应用内（谁能改数据）

- **默认状态：只读预览。** 任何人打开链接，右上角徽标显示「只读预览」，所有新增 / 编辑 / 删除 / 导入 / 保存按钮都不渲染，表格点了也不会进入编辑态，写方法在数据层被拦截并提示。
- **成员状态：输码解锁。** 点右上角徽标 → 输入团队编辑码 → 徽标变「成员编辑」，写入口出现。
- 编辑码只存 SHA-256 哈希（`config/app.config.json → edit.codeSha256`），代码里没有明文。
- 解锁状态只记在本机浏览器，换设备、清缓存都要重输；点徽标可随时退回只读。
- **编辑码由项目管理员单独告知成员，不写进仓库、不写进公开文档。**

> ⚠️ 边界说明（必须让成员知道）：
> 前端只读是**软闸**，挡的是「链接被转发后别人随手乱改」，不是防内行攻击——因为云库权限由登录态保证，登录成员才拿得到数据。
> 要「后端强制只允许登录成员写入」，见 3.4，代价是成员需要登录一次。

### 3.4 硬隔离（可选，需要登录时再做）

1. 账号由 WorkBuddy 云服务管理，如需限制邮箱域名在其后台配置。
2. 把 `ops_records` / `ops_kv` 的策略从 `to anon, authenticated using (true)` 改为只允许 `authenticated`：
   ```sql
   drop policy if exists ops_records_all on public.ops_records;
   create policy ops_records_rw on public.ops_records
     for all to authenticated using (true) with check (true);
   revoke all on public.ops_records from anon;
   -- ops_kv 同理
   ```
3. 前端把 `22-auth.js` 换回登录门禁（v4.x 版本有现成实现），只读预览仍可对匿名开放（读策略保留给 anon，写策略只给 authenticated）。
4. 这样：匿名 = 只能读，登录成员 = 可写，权限在数据库侧强制。

---

## 4. 重新发布流程

发布只有一条路径：**改源码或 CSV → 本地构建 → push main → Pages 自动更新（1–2 分钟）→ 链接不变。**

### 4.1 只改数据（最常见）

```bash
git pull --rebase
# 直接编辑 data/shops.csv（Excel / VSCode / 任意文本编辑器，存成 UTF-8 逗号分隔）
npm run build          # 生成新的 manifest（版本号 = 内容哈希）
git add data docs dist
git commit -m "data: 更新店铺表 · 新增 3 家抖音店"
git push
```

发布后所有人页面 **60 秒内**自动刷新，不用手动清缓存。

### 4.2 只改页面 / 逻辑

```bash
git pull --rebase
# 改 src/js/ 或 src/styles/ 里对应模块
npm run check && npm run build
npm run test           # 起本地服务后跑回归
git add -A && git commit -m "feat: 数据看板增加响应时长列"
git push
```

### 4.3 改连接配置

只改 `config/app.config.json`（云端地址、表名、轮询间隔、连接器、编辑码哈希），重新构建发布即可，不用碰代码。

### 4.4 发布后自检（30 秒）

1. 打开线上链接 → 右上角是「只读预览」→ 页面无黄色提示条 → 设置页数据源版本与刚发布的版本一致。
2. 点徽标输码 → 徽标变「成员编辑」→ 随便改一个目标值 → 换一个浏览器（或隐身窗）打开，60 秒内能看到改动。
3. 看板 / 店铺库 / 任务 / 资产 / 风控 / 接口 / 设置，七个页面都能进。

### 4.5 回滚

```bash
git revert <坏提交的sha> && npm run build && git push
```
Pages 1–2 分钟回到上一版。**不要**用 `git push -f`，会把别人的提交一起冲掉。

---

## 5. 多人修改防覆盖

三层同时做，才叫真防覆盖。

### 5.1 代码层

| 规则 | 做法 |
|---|---|
| 一文件一人 | 按 1.2 的分工表认领，改别人的模块先在群里说一声 |
| 先拉后推 | 每次动手前 `git pull --rebase`，提交前再拉一次 |
| 小步提交 | 一次提交只做一件事，标题写清「改了什么、为什么」 |
| 走 PR | `main` 开分支保护，所有改动经 PR + 1 人 review |
| 冲突处理 | CSV 冲突按整行取舍；JS 冲突保留双方逻辑再跑 `npm run check`，禁止 `-X ours/theirs` 一把梭 |
| 单一出口 | 只有管理员能 push `main` 并发布，避免两个人同时发布互相盖产物 |

### 5.2 数据层（CSV ↔ 界面）

同一行数据可能被两处修改，规则是**「谁更晚谁生效」**：

| 情况 | 结果 |
|---|---|
| CSV 行未在界面改过 | 用 CSV（来源标记 `__src=csv`） |
| 界面改过，且改动时间 `__mt` 晚于 CSV 发布时间 | **保留界面版本**，不会被下次发布盖掉 |
| 界面改过，但 CSV 之后又更新了 | CSV 赢（相当于「以最新发布的表为准」） |
| CSV 里删掉了某行 | 该行若来自 CSV，页面同步删除 |
| 界面新建的行（`__src=ui`） | CSV 永远不会删它 |
| 历史遗留、没有来源标记的行 | 一律保留，绝不因一次同步丢数据 |

实践建议：
- **批量数据（店铺、账号、指标）走 CSV**，一次改一批，有 git 历史可回滚。
- **日常小改（状态、备注、负责人、目标值）走界面**，快，且不会被下一次 CSV 覆盖（因为 `__mt` 更新）。
- 不要在同一批里既改 CSV 又在界面改同一行，否则谁赢取决于时间，容易互相疑惑。

### 5.3 云端层

- 客户端只做**行级差分**写入（只推变化的记录），不整库覆盖。
- 每行写入带 `updated_by`（改动人）与 `updated_at`，出问题能查出是谁、什么时候。
- 拉取有保护：正在打字、弹窗打开、刚提交 2 秒内，都不会被远端刷新打断。
- 冲突策略是「最后写入者胜」，没有字段级合并——所以**同一行不要两个人同时改**。

### 5.4 版本与留痕

- 每次发布在 `CHANGELOG.md` 记一行：版本号 / 改了什么 / 谁改的。
- 源码包里带版本号，网盘旧包不删，出问题能拿到任意历史版本。
- 数据源版本号是内容哈希，发布日志里能看到「这次发布的是哪一版数据」。

---

## 6. 常见问题

**Q：我只想看数据，会不会不小心改坏？**
A：不会。默认只读，写入口根本不渲染，数据层还会二次拦截。

**Q：成员说徽标点不开 / 输了码没反应？**
A：编辑码校验依赖浏览器的安全上下文，必须用 `https://` 或 `localhost` 打开；用 `file://` 直接双击 HTML 会失败。

**Q：改了 CSV，页面没变？**
A：依次查：① 有没有 `npm run build`（不构建就不会有新 manifest）② `docs/data/manifest.json` 的 version 有没有变 ③ 有没有 push 成功 ④ 等 60 秒或切回标签页触发检查。

**Q：页面顶部出现黄色提示条？**
A：云端没连上（多数是未登录或网络异常）。此时改动只存本机，恢复后会自动补传；按提示条右侧按钮重试。

**Q：能不能两个人同时发布？**
A：不能。发布是单人职责，避免产物和数据清单互相覆盖。

**Q：旧的 WorkBuddy 应用链接还能用吗？**
A：能打开，但那是**另一套空数据库**，数据不互通。已标记为待下线，迁移完成后请停止分享。
