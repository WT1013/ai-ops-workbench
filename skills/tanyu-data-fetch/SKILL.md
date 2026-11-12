---
name: tanyu-data-fetch
description: 抓取探域(tanyuai.com)店铺日维度数据(Agentic咨询消息数/话术生成数/话术采纳数/风控数 + 采纳率/生成率/询单转化率/风控率/纯智能体接待占比/3分钟响应率)并写入工作台云端数据库。当用户要求"抓探域数据"、"同步/更新店铺数据"、"抓今天/昨天/指定日期的数据"、"更新工作台数据"、"跑一下探域"或提到 tanyu/探域/数据罗盘 时使用。含登录、预览、正式写入全流程，自动适配 24 家远山店铺。
agent_created: true
---

# 探域店铺数据抓取

## Overview

从探域（https://agent.tanyuai.com）自动抓取名下拼多多店铺的日维度运营数据，写入远山工作台云端（Supabase `state` 表）。店铺清单从云端店铺库动态读取，新增/删除店铺自动跟随，无需改脚本。

## 执行流程（Workflow）

收到抓数指令后按以下顺序执行：

### 1. 检查环境
- 确认 `node` 可用（`node --version`），Node >= 16
- 确认本脚本目录存在 `node_modules/playwright`（没有则执行 `npm install playwright`）
- 确认 Chrome 已安装（默认 `C:\Program Files\Google\Chrome\Application\chrome.exe`，路径不符则改 `scripts/tanyu-fetch.js` 第 3 行 CHROME）

### 2. 确认登录态
- 登录态目录：`<skill目录>/tanyu-profile`（与脚本同目录，首次运行时由登录脚本创建）
- 若该目录不存在，或用户反馈数据全空/提示未登录，运行：
  ```bash
  node scripts/tanyu-login.js
  ```
  弹出浏览器窗口后提示用户扫码/输验证码登录，看到「✓ 登录成功」后再继续。

### 3. 确定抓取日期
- 用户指定日期（如"抓 8 月 17 号"）→ `TANYU_DATES=2026-08-17`
- 用户指定多日（如"补 8/16、8/17"）→ `TANYU_DATES=2026-08-16,2026-08-17`
- 未指定 → 默认**昨天**（探域当天数据次日才完整）

### 4. 预览（先看后写）
```bash
node scripts/tanyu-fetch.js
```
输出各店铺 `adopt / gen / conv / ratio` 数值。**确认无误后再正式写入。**

### 5. 正式写入
```bash
set TANYU_DRY_RUN=0
node scripts/tanyu-fetch.js
```
或单行（bash）：`TANYU_DRY_RUN=0 node scripts/tanyu-fetch.js`

### 6. 验证结果
- 运行结束看：`written shops x days: N`（N 为写入条数）、`save ok: true`
- 如需复核，可查询云端确认（Supabase state 表 id=1，publishable key 见脚本内 CLOUD_KEY）

## 参数说明

| 环境变量 | 取值 | 默认 | 作用 |
|---|---|---|---|
| `TANYU_DATES` | `YYYY-MM-DD` 或逗号分隔多日 | 昨天 | 抓取哪些日期 |
| `TANYU_DRY_RUN` | `0` = 写入云端；其他/缺省 = 仅预览 | 预览 | 是否写入数据库 |

## 抓取逻辑（供诊断参考）

- **Part 1 数据罗盘**（4 计数 + 采纳率/生成率/询单转化率/风控率/3分钟响应率）：打开 `agent.tanyuai.com/v2/dashboard` → 数据罗盘 → 按店铺 → 通过 `page.route` 拦截 `compass/section/table` POST 接口，强制 `startDate/endDate` 为目标日期区间（不依赖 UI 控件，100% 生效）。**同时用 `page.on('response')` 捕获该接口 JSON**，`data.rows` 按日期分行，一次区间查询即拿到全部日期的计数（比读页面表格更准、更快；页面表格只作百分比兜底）。
- **Part 2 接待占比**（纯智能体占比）：打开 `agent.tanyuai.com/v2/home` → 按店铺 → 拦截 `get-summary-by-shop` POST 接口强制单日日期，读取 `receptionMode` 计算 `auto / (auto+assisted+manual)`
- 店铺名匹配：探域下拉名与云端库名可能不同（如大小写/后缀），脚本内 `ALIAS` 映射处理
- 写入：只覆盖非空值，`pureAgentRatio` 为 null 时不覆盖

## 数据字段映射（2026-10-02 固化，工作台「数据总览」口径）

`compass/section/table` → `data.rows[]` 字段 → 云端 `days[date].shopData[shopId]`：

| 业务指标 | 接口字段 | 云端字段 | 说明 |
|---|---|---|---|
| Agentic咨询消息数 | `ai_agent_card_event_cnt` | `agenticMsgCount` | 计数（分母） |
| 话术生成数 | `ai_consult_response_cnt` | `genCount` | 计数 |
| 话术采纳数 | `ai_consult_response_accept_cnt` | `adoptCount` | 计数 |
| 风控数 | `ai_consult_response_risk_cnt` | `riskCount` | 计数 |
| 风控率 | `ai_consult_response_risk_rate` | `riskRate` | 页面表格读 % 为准 |
| 生成率 | `ai_consult_response_rate` | `generationRate` | 同上 |
| 采纳率 | `ai_consult_response_accept_rate` | `adoptionRate` | 同上 |
| 咨询消息数（非Agentic） | `ai_consult_msg_cnt` | — | 未用 |
| 纯智能体占比 | `receptionMode`（home 接口） | `pureAgentRatio` | auto/(auto+assisted+manual)×100 |
| 3分钟人工回复率 | 服务效率表「三分钟响应率」列 | `threeMinReplyRate` | 探域口径=系统响应 |
| 消费者服务体验分 | — | `experienceScore` | 来自拼多多后台（pdd-batch-fetch.js） |

**历史计数回填**（2026-10-02 一次性补 9/1–10/1，742 格）：
`work/backfill-counts.cjs`（按月区间抓计数 → `backfill-counts.json`；支持 `TANYU_ONLY=店名子串` 定点补跑、失败自动重试 3 次并先切别家店强制重新触发请求）
`work/import-backfill.cjs`（把 json 导入云端，`TANYU_DRY_RUN=0` 才写）。

## 常见问题

| 现象 | 处理 |
|---|---|
| `Cannot find module 'playwright'` | 在脚本目录执行 `npm install playwright` |
| 弹出登录页一直未成功 | 运行 `node scripts/tanyu-login.js` 重新扫码 |
| 抓到的全是空值 | 多为登录态失效，重新登录后重跑 |
| 日期不对 | 检查 TANYU_DATES 是否残留；默认只抓昨天 |
| Chrome 报错打不开 | 改 `scripts/tanyu-fetch.js` 第 3 行 CHROME 为实际路径 |
| 单店失败 | 脚本已容错（catch 后继续下一家），看日志标记，可单独重跑 |
| **`ERR: fetch failed`（或 https ECONNRESET）** | **不是探域问题**，见下方专项 |

## 专项：`ERR: fetch failed`（云端 Supabase 坏 IP，2026-09-22 固化）

**特征**：同步直接失败、日志只有一行 `ERR: fetch failed`，但工作台页面能正常打开、探域能正常抓。
（`ERR:` 前缀来自 `tanyu-fetch.js` 末尾的顶层 catch，说明失败发生在写云端那一步，不是抓取。）

**根因**：`kocuowtqklojxkhzlwpe.supabase.co` 走 Cloudflare，DNS 返回多个 A 记录，其中部分 IP
在国内网络下 TLS 握手被 RST。node 原生 `fetch`(undici) 只取第一个 IP 且**不换 IP 重试** → 每次必败；
浏览器会自行换 IP 重试，所以页面看着正常。

**30 秒确诊**（分别直连每个 IP，能立刻区分"坏 IP"和"真断网"）：
```js
const dns=require('dns'),tls=require('tls');
dns.lookup('kocuowtqklojxkhzlwpe.supabase.co',{all:true},(e,a)=>a.forEach(x=>{
  const s=tls.connect({host:x.address,servername:'kocuowtqklojxkhzlwpe.supabase.co',port:443,timeout:3000},
    ()=>console.log('OK  ',x.address),);
  s.on('error',err=>console.log('BAD ',x.address,err.code));
}));
```

**修复**：脚本顶部加一行（必须在任何 fetch 之前）：
```js
require('./cloud-net.js');   // 跨目录用绝对路径
```
`cloud-net.js` 双层兜底：① 覆写 `dns.lookup`，对 `*.supabase.co` 先并行 TLS 探测各 IP，把可用 IP 排最前
（5 分钟缓存，首次多约 1.2s）；② 覆写 `globalThis.fetch` 逐 IP 重试。
**好处**：无需改任何调用点，原生 `fetch` 与 `https.get/request` 同时受益。

**已挂载该补丁的脚本**（新增访问云端的脚本务必照做）：
`tanyu-fetch.js`、`pdd-batch-fetch.js`、`sync-gaps.js`、`fix-shop-data.js`、`dingtalk-sync-api.js`、
`tanyu-workshop-fetch.js`（「同步打标数据」，2026-09-22 补挂）、
`E:/wkbd/工作台/工作台升级/tanyu-monthly-all.js`、`work/tanyu-monthly-fetch.js`、`work/dingtalk-sync-ai-team.cjs`、`work/dingtalk-sync-summary.cjs`。
`serve.js` 也已补上（2026-09-22），**需重启 serve 才生效**。

### 月度累计抓取 `work/tanyu-monthly-fetch.js`（2026-10-02 补强）
真实月度口径（`Σ计数÷Σ总事件数`），写入云端 `days.__library__.monthly[YYYY-MM][sid]`，字段
`adoptRate / genRate / riskRate / pureRatio`（+ `cnt` 明细、`__meta.calib`）。
```bash
TANYU_DRY_RUN=0 TANYU_MONTH=2026-10 node tanyu-monthly-fetch.js          # 整月全店
TANYU_DRY_RUN=0 TANYU_MONTH=2026-10 TANYU_ONLY=松迅 node tanyu-monthly-fetch.js  # 单店补跑
```
- **写回前必须确认 `__library__.monthly` 没被抹掉**：前端 `workbench.js` 曾整体覆盖 `__library__`（只留 shops），
  现已修为 `Object.assign` 合并（2026-10-02）。排查"月度数据自己消失"先查前端全量写回。
- 探域偶发返回空行（松迅实测 `no rows`）→ 脚本已内置「选店 + 等响应」最多重试 3 次。
- 纯智走 home 的 `reception-summary`；个别店会返 `pureRatio=null`（正常，消费方应回退日均）。

**排查口诀（症状：同步失败，但工作台页面完全正常）**：列出所有含 `supabase.co` 的脚本，看谁没含 `cloud-net` 字样——
```js
const dir = 'C:/Users/Administrator/Documents/Codex/2026-08-06/new-chat/work/';
require('fs').readdirSync(dir).filter(f => /\.(js|cjs)$/.test(f)).forEach(f => {
  const t = require('fs').readFileSync(dir + f, 'utf8');
  if (t.includes('supabase.co')) console.log(t.includes('cloud-net') ? '[已挂]' : '[缺失]', f);
});
```
`tanyu-marked-*` / `tanyu-backfill*` / `dingtalk-fill-*` / `dingtalk-scan-*` 等是一次性历史脚本，
未挂补丁属正常，仅当它们重新被用于生产时才需补。

**排查口诀**：日志出现 `ERR: fetch failed` / `ECONNRESET` 且**页面正常**，先查云端坏 IP，别去查探域登录态。


## 部署到其他机器/加入其他人工作台

见 `references/setup.md`（含一键脚本 tanyu-fetch.bat 用法）。

## Resources

### scripts/
- `tanyu-fetch.js` — 主抓取脚本（登录态目录与脚本同目录，整体复制即可迁移）
- `cloud-net.js` — **云端 Supabase IP 故障转移补丁（必需，别漏拷）**，被 tanyu-fetch.js 顶部 require
- `tanyu-login.js` — 登录脚本（首次使用扫码登录一次）
- `tanyu-fetch.bat` — Windows 一键运行（双击或带参数，见 references/setup.md）

### references/
- `setup.md` — 部署与使用手册（给安装者/AI 参考）
