# 协作规范

多人同时改一个工作台，靠三件事兜住：按文件分工、走 PR、数据单人独占。
完整迁移与权限说明见 [MIGRATION.md](MIGRATION.md)。

## 1. 分支

| 分支 | 用途 | 谁能合并 |
|---|---|---|
| `main` | 对应线上版本，随时可发布 | 发布人（开分支保护，走 PR） |
| `feat/xxx` | 新功能 | 自己开发，提 PR |
| `fix/xxx` | 修 bug | 同上 |
| `data/xxx` | 只改 CSV 数据 | 同上，评审更快 |

流程：`git pull --rebase` → 从 `main` 开分支 → 改 → `npm run check` → 提交 → 提 PR → 评审 → 合并。

## 2. 首次接入（GitHub）

```bash
git clone https://github.com/WT1013/ai-ops-workbench.git
cd ai-ops-workbench
node --version          # 需要 18+
npm run check           # 先确认能跑
npm run build
npm run serve           # 浏览器打开 http://127.0.0.1:8790/
```

权限：仓库 `Settings → Manage access` 给 **Write**（不要 Admin）；`main` 开分支保护，至少 1 人 review。
发布权只给项目管理员。

## 3. 分工（按文件认领，避免同文件并发）

| 角色 | 负责文件 |
|---|---|
| 前端 / 页面 | `js/10~16-page-*.js`、`js/08-ui-kit.js`、`styles/03~06-*.css` |
| 公共组件 / 交互 | `js/05-overlay.js`、`06-forms.js`、`09-chart.js`、`17~20-*.js` |
| 数据 / 指标 | `js/01-metrics.js`、`02-seed.js`、`04-aggregate.js`、`07-import.js` |
| 底层 / 平台 | `js/03-store.js`、`24-data-sync.js`、`25-mode.js`、`22-auth.js`、`src/build.cjs` |
| 数据源 | `data/*.csv`（**单人独占**） |
| 配置 | `config/app.config.json`（**只有管理员能改**） |
| 发布人 | 看 diff、跑回归、执行发布 |

一个功能涉及多块时，先改公共部分（`08-ui-kit.js`）再改页面。

## 4. 提交信息

```
<类型>: <一句话>
```

类型：`feat` / `fix` / `style` / `refactor` / `docs` / `data` / `chore`。

例：
- `feat: 店铺库增加平台缺口筛选`
- `fix: 窄屏账号表尾号列被截断`
- `data: 更新店铺表，新增 3 家抖音店`

一次提交只做一件事。改样式和改逻辑不要混在同一个提交里。

## 5. 代码约定

- **普通脚本，不是 ESM**：`src/js/*.js` 顺序拼进同一个 IIFE，共享作用域，不需要 `import/export`。
- 新增文件必须登记进 `src/build.cjs` 的 `JS_PARTS` / `CSS_PARTS`，否则构建直接报错（故意的）。
- 顶层只放声明；不要在文件顶部执行语句（`const` 临时性死区）。
- 现有变量名（`store`、`agg`、`$`、`esc`、`TX`、`canEdit`…）不要重命名。
- 样式用 `styles/02-theme.css` 的变量，不写死色值。
- 插入 DOM 的文本一律走 `esc()`。
- **新增写操作**必须走 `store.add/update/remove`（它们内置只读门禁），不要直接改 `store.db` 后 `save()`，否则会绕过权限。

## 6. 数据约定

### 6.1 字段

- 已有字段名（`shop` `login` `binder` `tail` `date` `adopt`…）不能改，只能加。
- 要改结构就在读取处做兼容（缺字段给默认值），不要写脚本直接改线上库。
- 删记录、清数据在页面上手动做，不要在 SQL 里批量执行。

### 6.2 CSV

- `id` 与表头不能改；列可以加，但页面不认新列。
- UTF-8 无 BOM、英文逗号；含逗号的字段用双引号包起来。
- 改完必须 `npm run build`（生成新 manifest），否则页面不会刷新。
- 一次只改一类数据，提交信息写清「哪张表、改了什么、影响多少行」。
- 尾号 / 编号列在 Excel 里先设「文本」，避免前导零被吃掉。

### 6.3 两条通道不要打同一行

- 批量数据走 CSV；单条状态 / 备注 / 负责人 / 目标值走界面。
- 同一行不要两个人同时改（冲突策略是最后写入者胜，没有字段级合并）。
- 平台规则：「谁更晚谁生效」，详见 MIGRATION.md 5.2。

## 7. 评审清单（发布人过一遍）

- [ ] `npm run check` 通过
- [ ] `node tests/regression.cjs` 全绿
- [ ] `node tests/collab.cjs` 全绿（改过权限 / 数据源时必须）
- [ ] 产物里没有密码、token、本地绝对路径、团队编辑码明文
- [ ] 七个页面都能打开，控制台无报错
- [ ] 只读预览下写入口确实不可见、写不进去
- [ ] 窄屏（≤860px）没有横向滚动
- [ ] 版本号已递增（`config/app.config.json → app.version`）
- [ ] 构建输出的数据行数与预期一致
- [ ] 发布后打开线上链接复核一次

## 8. 绝对不能做

1. 用 `git push -f` 推 `main`——会冲掉别人的提交。
2. 改 `config/app.config.json` 里的 Supabase 地址或表名——等于换空库。
3. 把团队编辑码、密码、密钥写进代码、注释、文档或提交信息。
4. 改 `data/*.csv` 的 `id` / 表头，或手工编辑 `data/manifest.json`。
5. 提交 `tmp/`、`_shot*/`、`node_modules/`、`output/`（已在 `.gitignore`）。
6. 绕过 `store.*` 直接写库，或在前端用 publishable key 做批量删除。
7. 直接 push 到 `main` 并自己发布（除非你就是发布人）。
