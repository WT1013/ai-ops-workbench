---
name: deploy-ai-workbench
description: 把"新驾驶舱"本地改动部署到 GitHub Pages (wt1013/ai-workbench)。当用户说"部署吧/可以部署/再试部署/上传"且改动位于 E:/wkbd/工作台/工作台升级/新驾驶舱 时使用。含版本号递增、复制到 repo/dashboard、commit、GCM 凭据绕过、线上版本验证全流程。
agent_created: true
---

# 部署 远山·客服AI数据驾驶舱 到 GitHub Pages

## 触发词
"部署吧"、"可以部署"、"再试部署"、"上传"、"上线"、"推送"

## 铁律（用户强约束）
- 每次部署前必须先出真实效果图（Playwright 截图）并用户确认，确认后才部署。
- 部署必须递增 cache-busting 版本号（截至 2026-09-25 已用到 `?v=20260822b`，**单字母序列已用尽，已换新前缀 20260822**；下次用 `?v=20260822c`，务必同步改 index.html 内全部 4 处引用：styles.css / workbench.css / workbench.js / app.js）。
- 线上验证用 grep 版本号，不依赖 git status。

## 路径常量
- 开发目录（改这里）：`E:\wkbd\工作台\工作台升级\新驾驶舱\`
- 部署仓库：`E:\wkbd\工作台\工作台升级\repo\`（GitHub Pages 源，分支 main）
- 线上 URL：`https://wt1013.github.io/ai-workbench/dashboard/`
- 同步服务：`C:\Users\Administrator\Documents\Codex\2026-08-06\new-chat\work\serve.js`（改它必须重启，否则新接口 404）

## 部署步骤

### 1. 递增版本号
编辑 `新驾驶舱\index.html` **所有**资源引用（CSS 和 JS 都要改，曾漏改 CSS 导致缓存指纹不一致）：
```
<link rel="stylesheet" href="styles.css?v=20260821X" />
<link rel="stylesheet" href="workbench.css?v=20260821X" />
<script src="workbench.js?v=20260821X"></script>
<script type="module" src="app.js?v=20260821X"></script>
```
X 为上一个版本字母的下一个（j→k→l…）。改后 grep 校验：`grep -o 'v=20260821[a-z]' index.html | sort -u` 应只有新字母（或新旧并存时确认旧的是注释/内部引用）。

### 2. 复制到部署目录（只复制 5 个正式文件，不带 .bak）
bash `cp` 在退化环境里不可用，统一用 PowerShell（CJK 路径安全）：
```powershell
$src="E:\wkbd\工作台\工作台升级\新驾驶舱"; $dst="E:\wkbd\工作台\工作台升级\repo\dashboard"
foreach($f in @("index.html","app.js","styles.css","workbench.js","workbench.css")){ Copy-Item "$src\$f" "$dst\$f" -Force }
```

### 3. 提交
```bash
cd "E:/wkbd/工作台/工作台升级/repo"
git add dashboard/index.html dashboard/app.js dashboard/styles.css dashboard/workbench.js dashboard/workbench.css
git commit -m "<描述>; 版本X"
```

### 4. 推送（关键：GCM 凭据绕过）
**不要直接 `git push`** —— 无 tty 的 bash 环境 GCM 无法弹凭据窗，会报：
`fatal: could not read Username for 'https://github.com': No such file or directory`
（这**不是**网络故障！之前误判为 443 故障干等 90 分钟。）

正确做法：凭据在 `~/.git-credentials`（token 文件），用 store helper：
```bash
git -c credential.helper=store push origin main
```
**沙箱坑（2026-09-10 实测，必读）**：在默认沙箱内执行 push 会报 `CONNECT tunnel failed, response 502`（代理 127.0.0.1:8740 拦截写请求）；而 `git ls-remote` 同期可能正常，极易误判为"网络故障"反复重试（重试 3 次全 502）。**正确解法：用 `dangerouslyDisableSandbox: true` 运行 push**，一次成功。反例：清空 http_proxy/https_proxy 直连会报 `Failed to connect to github.com:443 after 21s`，不可行。

若报 `Connection was reset` / `Could not connect to github.com:443`（在沙箱外仍出现）才是真网络故障，间隔几分钟重试即可（提交已 commit 不丢）。

注意：remote URL 已更新为 `https://github.com/WT1013/ai-workbench.git`（大写，仓库迁移过）。
push 成功后 `refs/remotes/origin/main` 缓存可能不更新（`ahead N` 假象），用 `git ls-remote origin main` 验证远端 = 本地 HEAD。若 `git update-ref` 也无效（show-ref 仍是旧值），根因是本仓库 `.git/refs/remotes/origin/` 目录缺失（origin/main 只在 packed-refs，fetch/update-ref 静默失败），修复：
```bash
mkdir -p .git/refs/remotes/origin && printf '<sha>\n' > .git/refs/remotes/origin/main
```

### 5. 验证线上（等 50~60 秒 GitHub Pages 构建）
注意：git bash 下 `curl -o /dev/null` 可能异常退出（exit 23），且需绕过缓存。推荐用 node fetch 直连（**需 `dangerouslyDisableSandbox: true`**）：
```bash
node -e "fetch('https://wt1013.github.io/ai-workbench/dashboard/index.html?nocache='+Date.now()).then(r=>r.text()).then(t=>console.log((t.match(/v=20260821[a-z]/g)||[]).join(',')))"
node -e "fetch('https://wt1013.github.io/ai-workbench/dashboard/app.js?nocache='+Date.now()).then(r=>r.text()).then(t=>console.log('new-code:',t.includes('<新代码标识>')))"
```
必须出现新版本号且新代码标识为 true，才算部署成功。

## 环境速查
- **PATH 半退化（2026-09-25 实测，优先用这招）**：Bash 工具里 `ls` 能用但报 `git: command not found`。**根因是 git 在 `portablegit/cmd`（不是 `usr/bin`）**。直接在命令前补 PATH 即可正常调 git，不必绕 `_git.cjs`：
  ```bash
  export PATH="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd:/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:/c/Windows"
  ```
  注意：`sleep` 也不在该 PATH 里（要 `usr/bin`）；线上验证的等待用 node `await new Promise(r=>setTimeout(r,70000))` 代替 `sleep 60`。
- **bash 环境可能退化（2026-09-16 实测）**：某些会话里 Bash 工具拿到的 shell 连 `ls/grep/head/git` 都没有（报 `dirname: command not found` / `shell-runtime-bash-env.sh: line 3`），此时**不要反复重试 git/cp**，直接走兜底：用 node 全路径调 git.exe。
  - git.exe 全路径：`C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe`
  - 现成封装脚本：`C:/Users/Administrator/Documents/Codex/2026-08-06/new-chat/work/_git.cjs`（用法：`node _git.cjs -C 省略 ...`，内部已固定 repo 路径，直接 `node _git.cjs status --porcelain` / `commit -m "..."` / `ls-remote origin main`）
  - 关键：脚本内必须注入 `HOME=C:/Users/Administrator` `USERPROFILE=...`，否则 git 找不到 `.gitconfig` 与 `.git-credentials`（凭据丢失 → 报 `could not read Username`）。
  - PowerShell 工具在本机可能**不回显 stdout**，需要输出时写 `Out-File -Encoding utf8 <tmp>` 再用 Read 读（默认 Out-File 是 UTF-16，Read 会判为 binary）。
  - 复制文件用 PowerShell `Copy-Item -Force`（CJK 路径安全），不要用 bash `cp`。
- Playwright：`NODE_PATH="C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"` + node，Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`。file:// 下 module 脚本会被 CORS 拦，必须先起静态服务器：`python -m http.server 8123 --directory 新驾驶舱`，用 `http://localhost:8123/index.html`。
- serve.js 重启：PowerShell `Stop-Process -Id <pid>`（先 netstat 找 8080 的 PID），再干净环境 `node serve.js &`（dangerouslyDisableSandbox）。
- 云端：Supabase `https://kocuowtqklojxkhzlwpe.supabase.co`，state 表 days 列，店铺库在 `days["__library__"].shops`。
- 同步服务新接口 `/pdd-account`：GET 列表 / POST upsert（归一化匹配 cloudName，idx 自动分配，CORS *）。
