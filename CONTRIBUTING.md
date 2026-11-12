# 协作规范

多人同时改一个单文件产物，必须靠规矩兜住冲突。

## 1. 分支

| 分支 | 用途 | 谁能合并 |
|---|---|---|
| `main` | 对应线上版本，随时可发布 | 发布人 |
| `feat/xxx` | 新功能 | 自己开发，提 PR |
| `fix/xxx` | 修 bug | 同上 |
| `style/xxx` | 纯样式、配色、版式 | 同上 |

流程：`git pull` → 从 `main` 开分支 → 改 → `npm run check` → 提交 → 提 PR → 发布人评审 → 合并。

## 2. 首次接入 Gitee

仓库还没建的话，由管理员做一次：

```bash
# 1) 在 https://gitee.com 新建【私有】仓库，名字建议 ai-ops-workbench，不要勾选初始化 README
# 2) 本地仓库已经有首个提交，直接关联并推送
git remote add origin https://gitee.com/<你的账号>/ai-ops-workbench.git
git push -u origin main
```

同事加入：

```bash
git clone https://gitee.com/<你的账号>/ai-ops-workbench.git
cd ai-ops-workbench
node --version          # 需要 18+
npm run check           # 先确认能跑
npm run build
npm run serve           # 浏览器打开 http://127.0.0.1:8790/
```

在 Gitee 仓库「管理 → 仓库成员管理」里把人加为**开发者**（能推分支、提 PR，但不能直接改 main 的保护规则建议打开）。

## 3. 分工建议（按文件，避免同文件并发）

| 角色 | 负责文件 |
|---|---|
| 前端 / 页面 | `js/1x-page-*.js`、`js/08-ui-kit.js`、`styles/0x-*.css` |
| 数据 / 指标 | `js/01-metrics.js`、`js/02-seed.js`、`js/04-aggregate.js`、`js/07-import.js` |
| 底层 / 平台 | `js/03-store.js`、`js/22-auth.js`、`src/build.cjs`、`scripts/` |
| 发布人 | 只看 diff、跑回归、执行发布 |

一个功能涉及多块时，先改公共部分（`08-ui-kit.js`）再改页面，减少互相等待。

## 4. 提交信息

```
<类型>: <一句话>
```

类型：`feat` 新功能 / `fix` 修 bug / `style` 样式 / `refactor` 重构 / `docs` 文档 / `chore` 杂项。

例：
- `feat: 店铺库增加平台缺口筛选`
- `fix: 窄屏账号表尾号列被截断`

一次提交只做一件事。改样式和改逻辑不要混在同一个提交里。

## 5. 代码约定

- **普通脚本，不是 ESM**：所有 `src/js/*.js` 会被顺序拼进同一个 IIFE，共享作用域，不需要 `import/export`。
- 新增文件要登记进 `src/build.cjs` 的 `JS_PARTS` / `CSS_PARTS`，否则构建直接报错（这是故意的）。
- 顶层只放声明；除 `20-events.js` 之后，不要在新文件顶部执行语句，避免 `const` 暂时性死区。
- 现有变量名（`store`、`agg`、`$`、`esc`、`chip`…）沿用，不要重命名，否则会大范围冲突。
- 样式一律用 `styles/02-theme.css` 里的变量（`--ink` `--line` `--panel` `--accent` 等），不要写死色值。
- 所有插入 DOM 的文本走 `esc()`，避免把用户输入当 HTML。

## 6. 数据兼容

- 已有字段名（`shop` `login` `binder` `tail` `date` `adopt` …）不能改，只能加。
- 要改结构就在读取处做兼容（缺字段给默认值），不要写迁移脚本直接改线上库。
- 删记录、清数据这类操作只能在页面上手动做，不要在 SQL 里批量执行。
- 上线前先确认线上表里有几条真实数据：`select count(*) from wb_records;`

## 7. 评审清单（发布人过一遍）

- [ ] `npm run check` 通过
- [ ] `npm test` 全绿
- [ ] 产物里没有密码、token、本地绝对路径
- [ ] 七个页面都能打开，控制台无报错
- [ ] 窄屏（≤860px）没有横向滚动、没有截断
- [ ] 版本号已递增（`src/build.cjs` 的 `VERSION`）
- [ ] 发布参数带全：appId + domainPrefix
- [ ] 发布后打开线上链接复核一次

## 8. 绝对不能做

1. 新建应用、改 appId / domainPrefix —— 链接和数据会分叉。
2. 提交 `tmp/`、`_shot*/`、`node_modules/`（已在 `.gitignore`）。
3. 改 `src/vendor/wb-cloud.global.js`（第三方 SDK）。
4. 把密码、验证码、密钥写进代码或注释。
5. 直接 push 到 `main` 并自己发布（除非你就是发布人）。
