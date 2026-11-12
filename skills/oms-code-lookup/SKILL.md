---
name: oms-code-lookup
description: 用探域 spuId 去 OMS(jeoms.com)反查真实商品名与商家编码，输出编码对照 Excel / jsonl。当用户说"在OMS查找商品编码/去OMS反查编码/查一下这些商品的商家编码/反查真实商品名/无码商品取编码/把探域商品拿去OMS查/出OMS编码对照表/OMS查款号货号"时使用。含范围筛选、探域全量拉取、反查(含短信二次验证)、出表三步，断点续跑。账号 王涛/Wt240232。
agent_created: true
---

# 探域 spuId → OMS 反查码/名 → 对照表

## 一句话

拿探域商品的 **spuId** 去 OMS 订单库反查，拿回两样东西：**真实商品名**（OMS 里的规范款名）和 **商家编码**（`productCode`/`skuCode`，如 `XM1.0426.024`）。

## 什么时候用

- "在 OMS 查找商品编码" / "去 OMS 反查编码"
- "这些无码商品取一下商家编码" / "反查真实商品名"
- 探域商品**外层 `outerId` 是空的**（无商家编码），需要补出编码/真名 → 通常是为了后续绑定分组
- "出了一张 OMS 编码对照表"

**不适用**：只想看探域自己的字段（直接用探域接口即可，不必走 OMS）。

## 背景语义（先搞清判据）

探域商品行（`product-paginate-with-product-group` 返回）：

| 字段 | 含义 |
|---|---|
| `spuId` | 探域商品 ID，**这是去 OMS 反查的钥匙** |
| `outerId` | 外层：**空 = 无商家编码**；非空时多为 OMS 反查过的中文款名（不一定是编码） |
| `skuOuter` | SKU 层编码数组（如 `DT042406513`、`XM042602401`），**可作为有码旁证** |
| `groups` | 已绑分组名数组，空 = 未绑 |
| `onSale` | 在售布尔 |
| `heat7d` / `heat30d` | 咨询热度 |
| `title` | 探域标题（无码款常是纯营销长标题，形如「日本医用护腰带腰间盘劳损…神器」） |
| `shop` / `thirdShopId` | 店铺名 / 店铺 ID |

> ⚠️ **"无商家编码"的判据是外层 `outerId` 为空**，不是"SKU 无码"（历史踩过这个坑）。

## 三步流程

### Step 1 · 拿到候选 spuId（`assets/tanyu_scope_filter.py`）

先有探域全量 live JSON（list，每项含上面那些字段）。若无，先拉一次全量；本项目历史全量在 `E:\wkbd\2026-08-24-16-38-17\_tanyu_live_22shops.json`。

```bash
cd /e/wkbd/2026-08-24-16-38-17
PY="C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
"$PY" "C:/Users/Administrator/.workbuddy/skills/oms-code-lookup/assets/tanyu_scope_filter.py" \
  -i _tanyu_live_22shops.json -o _oms_scope \
  --onsale --unbound --hot --nocode
```

条件可任选，交叉取交集：`--onsale`（在售）/ `--unbound`（未绑组）/ `--hot`（有热度）/ `--nocode`（无码）/ `--coded`（有码）/ `--shops "店铺A,店铺B"`（店铺白名单）。

产出：
- `_oms_scope.json` — 筛选后完整商品行
- `_oms_scope_ids3col.tsv` — 每行 `spuId⇥shop⇥title`，**已剔除杂质**
- `_oms_scope_junk.json` — 被剔除的杂质（补差价/运费/赠品/感谢卡/优惠券）

**杂质必须剔除**：`【购买前须联系客服确认】补收差价专用商品` 这类不是真实货品，送去反查只会浪费一次请求。

### Step 2 · OMS 反查（`assets/oms_spu_lookup.py`，核心）

```bash
"$PY" "C:/Users/Administrator/.workbuddy/skills/oms-code-lookup/assets/oms_spu_lookup.py" \
  -i _oms_scope_ids3col.tsv -o _oms_out.jsonl \
  --base "E:/wkbd/2026-08-24-16-38-17"
```

长批量（>30 条）用后台跑：Bash 工具 `run_in_background: true`，约 **4s/条**（36 条约 2 分钟）。

输出 jsonl 每行：

```json
{"spu":"592424040987","found":true,"orderCount":3,"fromOrder":0,
 "names":["医用固定带（护腰网眼轻薄款）（df）"],
 "codes":["XM1.2825.015"],"codeField":"productCode",
 "extra":{"skuId":"...","productId":"...","quantity":1},
 "shop":"精进器械保健专营店","tanyuTitle":"..."}
```

- `found:false` = 该 spu 在 OMS 里**没有任何订单记录** → 取不到码，属正常（占比常 40–50%），如实告知用户即可。
- `codes` 取自 `productCode` → `skuCode`（实测 OMS 里真正承载商家编码的是这两个；`skuId`/`productId` 是**系统内部雪花 ID，绝不能当编码**）。
- 支持**断点续跑**：重跑会自动跳过已有成功结果的 spu；`--no-resume` 关闭。

### Step 3 · 出对照表（`assets/oms_result_report.py`）

```bash
"$PY" "C:/Users/Administrator/.workbuddy/skills/oms-code-lookup/assets/oms_result_report.py" \
  -i _oms_out.jsonl -o OMS编码对照表_YYYYMMDD.xlsx \
  --src _oms_scope.json --title "OMS 反查对照表"
```

列：序号 / 店铺 / 探域商品ID / 探域标题 / 7天热度 / 30天热度 / 真实商品名(OMS) / 商家编码 / 编码字段 / 状态。
`--src` 用于补齐热度并按热度降序（不传则按 jsonl 顺序、热度留空）。
状态：`已查到(n)`（绿）/ `[未查到]`（整行红）/ `查到订单但商品空` / `错误:xxx`。汇总页含总数与店铺分布。

最后用 `present_files` 交付，并说明命中率与未查到的原因。

## 反查链路原理（排障时看）

1. **Playwright + 系统 Chrome + 持久 profile**（`C:/Users/Administrator/.agent-browser/chrome-profile`），复用登录态，`headless` 可跑。
   > 已弃用 agent-browser daemon：本机 Windows 上 open/close 反复 SIGTERM、ref 失效、截图全黑。
2. **登录**：进 `https://www.jeoms.com/xianma/trade/sales`，若跳 `/login` 则填 `input[placeholder="请输入用户名"]=王涛`、`input[placeholder="请输入密码"]=Wt240232`，点 `button:has-text("登录")`。无滑块。
3. **鉴权头捕获**：页面 axios 会自动注入鉴权头。`ensure_auth` = 打开列表页（**先 open 再 hook**，因为 open 会清 window）→ 注入 `HOOK_JS` 劫持 XHR 抓 `advance` 请求的 header 存到 `window.__AUTH` → 用 **Element Plus 原生 value setter + 派发 input/change** 往「明细商城商品Id」输入框填一个已知有单的 spu（`979560367247`，常量 `KNOWN_ORDER_SPU`）→ 点「搜索」触发真实请求 → 校验 `window.__AUTH.Authorization` 已就位。
   > 该输入框用 `placeholder` 定位不到，必须 `.el-form-item` 按 label 文本找 inputs。
4. **业务接口**（注意前缀带 `/xianma`）：
   - `POST /xianma/web/api/trade/sales/advance`，body `fields: JSON.stringify([{field:'mall_product_id', value:<spu>, type:'TEXT', operator:'EQUAL', boolType:'MUST', relation:'detail'}])` → `data.data[]` 是订单列表，取 `salesOrderId`
   - `GET /xianma/web/api/trade/sales/{oid}/detail?page=1&pageSize=5000` → `data.data[]` 是商品明细行
5. **取码取名的过滤规则**：跳过 `gift:true`、`salesOrderDetailType=='GIFT'`、`giftStrategyName` 含 感谢卡/赠品/随包，以及商品名命中杂质正则的行。一个 spu 可能命中多订单，依次试前 `MAX_DETAIL=4` 单，**取第一个有真实商品的订单**即停。
6. **`pg.evaluate` 返回值可能是双重 JSON 字符串**，脚本已做两次 `json.loads` 兜底。

## ⚠️ 短信二次验证（必读）

登录时**可能**不直接进业务页，而是弹「手机验证 / 使用手机短信验证码」（手机号 185*****218）。

- **根因**：弹窗不在主 frame，而在 **iframe** 内 —— frame name=`showHere`，url 前缀 `https://mfa.jd.com/auth/mobile.html`。主 frame 的 `inner_text`/`query_selector` 查不到「获取短信验证码」，**只有 `pg.frames` 能看到**。
- **绝不能用截图判断**：Playwright 截图会把 iframe 内容一并截进去，造成"元素明明在截图里却定位不到"的假象。先枚举 frame：
  ```python
  mfa = next((f for f in pg.frames if "mfa.jd.com" in (f.url or "")), None)
  ```
- **脚本已内置处理**：点击「获取短信验证码」后，**轮询 `--base` 目录下的 `_sms_code.txt`**，你（agent）此时应当**立刻向用户要 6 位验证码**，拿到后写进该文件即触发提交，限时 `--timeout`（默认 600s）。
- 完成标记落在 `_oms_login_done.txt`：`OK` / `FAIL_LOGIN` / `FAIL_NO_MFA` / `FAIL_TIMEOUT` / `FAIL_NO_SENDBTN`。
- **坑**：「获取短信验证码」在 iframe 内虽能用 `text=` 命中，但**不是 `<button>` 标签**（主 frame 里另有一个不相干的"发送验证码"按钮，别点错）。脚本用 `query_selector('text=...')` 逐级兜底 + 坐标兜底。
- 超时后重跑会自动重新发码。

## 常见问题

| 现象 | 处理 |
|---|---|
| `AUTH_FAIL: 未捕获到 Authorization` | **多数是偶发**（9/15、9/17 各遇一次）→ **原命令直接重跑一次通常即通**，不必先排查登录 |
| 大量 `found:false` | 正常。这些 spu 在 OMS 无订单记录（新品/未成交），取不到码。如实说明，不要编造 |
| `codes` 为空但有 `names` | 该订单明细行没带 `productCode`/`skuCode`；可放宽 `CODE_FIELDS` 或人工核对 |
| 取到 `codes` 形如 `15738091799970819` | **接错了字段**（`skuId` 是内部 ID）。确认 `codeField` 应为 `productCode`/`skuCode` |
| 反查中途浏览器崩/断 | 直接重跑同命令，断点续跑会跳过已完成项 |
| 会话约 20min 失效 | 单批控制在数百条内；快速 API 方案 ~4s/条，36 条约 2 分钟，不会撞失效 |
| Bash 报 `dirname: command not found` | 本机 shim 噪声，**可忽略**。但**命令切勿接 `\| tail`**（会 127 直接失败），日志用 Read 工具或 python 读 |
| 中文输出乱码 | 脚本已包 `io.TextIOWrapper(..., encoding='utf-8')`；若自定义脚本需自行加 |

## 环境 / 依赖

- **python（必须用这个，含 playwright + openpyxl）**：`C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe`
  > 裸版 `binaries/python/versions/3.13.12` **没有 playwright**，不要用。系统 python 可能是 Microsoft Store stub。
- **Chrome**：`C:/Program Files/Google/Chrome/Application/chrome.exe`
- **profile**：`C:/Users/Administrator/.agent-browser/chrome-profile`（登录态持久化于此，**与探域抓取共用，禁止并发跑两个脚本**）
- 后台长任务：Bash 工具 `run_in_background: true`（`nohup &` 在本环境不可靠）

## 目录

```
oms-code-lookup/
├── SKILL.md
└── assets/
    ├── tanyu_scope_filter.py    # Step1 探域全量 → 按条件筛 → 3列输入+杂质剔除
    ├── oms_spu_lookup.py        # Step2 核心: spuId → OMS 反查(码+名)，含2FA，断点续跑
    └── oms_result_report.py     # Step3 jsonl → Excel 对照表(含汇总页)
```

## 与其他技能的关系

| 技能 | 管什么 |
|---|---|
| **本技能** | 探域 spuId ↔ OMS 的**码/名反查**（通用入口） |
| `tanyu-group-binding` | 拿到码/名之后**归组并写库绑定** |
| `tanyu-oms-name-lookup` | 本技能的早期专用版（仅反查商品名、绑定流程内嵌）。**新需求优先用本技能** |

三者共用同一个 chrome profile，**必须串行执行**，不可并发。
