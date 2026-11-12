---
name: tanyu-group-binding
description: 探域(tanyuai.com) 多店铺"商品分组绑定"完整工作流。当用户要求把在售 SKU 归入既有商品分组(如"按商品名绑定分组/跟我之前一样/把这批绑到XX组/每日在售未绑巡检/列举在售未绑/帮找有咨询热度、在售、没有绑定分组的商品/可以绑的直接绑/近一周上架新链接有没有漏绑/这周新上的有没有未绑组/XX店的未绑定分组统计一下")时使用。覆盖 拉全量 → 口径筛选(在售/未绑组/有无码/热度/时间窗) → 有码取 outerId、无码走 OMS 反查(tanyu-oms-name-lookup) → 归类引擎(可绑/待拍板/渠道版/杂质) → 核心词扫全量库判归口 → 生成 plan → 预检 → 写库绑定 → 独立回读复核(0 mismatch) → 出 Excel。含归口映射表、近名款陷阱、安全边界(只绑在售、下架单独拍板、绝不擅自写库)。底层 Playwright + 系统 Chrome。
agent_created: true
---

# 探域 商品分组绑定

一句话：把白名单店铺的**在售未绑 SKU**，用真实商品名去匹配**既有分组**，走 `筛选 → 归类 → 人工/OMS 补强 → plan → 预检 → 写库 → 回读核对 → 出表`。

**写库前一律停在"建议清单"，等用户一句话确认。** 这是本技能最重要的纪律。

---

## 0. 本机路径（直接复制用）

```bash
SK="C:/Users/Administrator/.workbuddy/skills/tanyu-group-binding"
PY="C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe"   # 必须带 playwright
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-5/node.exe"       # ⚠️ 版本目录会变, 用前 ls versions/
WD="E:/wkbd/2026-08-24-16-38-17"                                                         # 工作目录(历史数据都在)
```

⚠️ 跑 node 前先 `ls C:/Users/Administrator/.workbuddy/binaries/node/versions/` 确认目录存在。

---

## 1. 首次准备

```bash
cd "$WD"
cp "$SK/scripts/tanyu_config.example.json" ./tanyu_config.json
# 改 work_dir / shop_match_file / chrome_profile
```

配置查找优先级：`--config <path>` → 环境变量 `TANYU_CONFIG` → `./tanyu_config.json` → 脚本目录 → 内置默认。
`tanyu_config.json` 缺省时脚本也能跑（用当前工作目录 + 内置默认路径），但**强烈建议显式配置**。

工作目录必备：`user22_shop_match.json`（店铺白名单，读 `matched` 字段）。

---

## 2. 硬性安全边界（始终遵守）

1. **默认只绑在售 SKU**（`onSale===true`）。下架款一律单独拍板，绝不擅自处理 —— 除非用户明确授权（如"把下架的有咨询热度的也绑定分组"），此时用 `precheck_plan.py --allow-offsale`。
   - ⚠️ 技术事实：**绑定接口对下架款完全有效**。"下架款不处理"是**业务约束**，不是接口限制。
2. **写库绝不自动**：归类只到"生成建议清单"为止。是否绑定、绑哪个组，等用户一句话确认。
3. **脏组不自动绑**：组名残括号（如 `PANAPOPO双路撞色护膝圆圈款(df`）→ **先查组内是否已有同款稳定归口**；有（同编码在售款 100% 绑在此组）→ 可直接绑；确无 → 单列待拍板。
4. **用户点名的"编码款→目标分组"以其指令为准**，即使与规则推荐不同。
5. **产能约束**：批量绑定仅覆盖在售 SKU；下架款、歧义款、渠道版、无既有组一律待拍板。

---

## 3. 全流程 9 步

| 步 | 做什么 | 脚本 | 关键产物 |
|---|---|---|---|
| ① 店铺口径 | 读白名单 `matched` | `_common.shop_scope()` | — |
| ② 拉全量 | 逐店翻页拉实时状态 | `pull_shops.js` / `pull_oneshop.js` | `_tanyu_live_22shops.json` |
| ③ 筛选 | 在售 + 未绑 + 热度/时间窗 | `filter_hot.py` / `filter_window.py` | `_hot<MMDD>.json`、`_coded/_nocode` |
| ④ 取真名 | 有码取 `outerId`；无码走 OMS | `prep_items.py` + tanyu-oms-name-lookup | `_ids3col.tsv`、`_oms_out.jsonl` |
| ⑤ 归类 | 可绑 / 待拍板 / 渠道版 / 杂质 | `group_classify.py` | `_coded_classified.json` |
| ⑥ 判归口 | 核心词扫全量库 + 主组已绑明细 | `probe_corewords.py`、`probe_group_detail.py` | 判定结论 |
| ⑦ 生成 plan | 引擎 + 人工提升合并 | `make_green_plan.py` | `_plan_<tag>_green_<date8>.json` |
| ⑧ 预检→写库→复核 | 预检干净桶 → 绑定 → 独立回读 | `precheck_plan.py`→`bind_batch.py`→`verify_bind.py` | `绑定结果_*.json`、`_verify_bad.json` |
| ⑨ 出表 | 建议清单 / 绑定核对表 | `make_suggest_list.py`、`make_bind_report.py` | `*.xlsx` |

### ③ 两个独立巡检维度，都要跑

| 维度 | 口径 | 抓什么 | 脚本 | 频率 |
|---|---|---|---|---|
| 热度维度 | 在售+未绑+(heat7d>0 或 heat30d>0) | 有客服咨询的高优先款 | `filter_hot.py` | 每日 |
| 上架时间维度 | 在售+未绑+`createdTime >= 近N天` | **零热度但真实在售的新链接** | `filter_window.py` | 每周 |

历史实测：近 7 天上架的在售未绑 66 条里只有 11 条有热度，**另 47 条零热度款从未被任何一轮热度巡检捞到**——白捡的可绑存量，必跑。

### 完整命令（热度巡检 → 出清单）

```bash
cd "$WD"
D=$(date +%Y-%m-%d); MMDD=$(date +%m%d)

node "$SK/scripts/pull_shops.js"
node "$SK/scripts/fetch_groups.js" "tanyu_all_groups_$(date +%Y%m%d).json"

"$PY" "$SK/scripts/filter_hot.py" --date "$D" --prev <上期日期>
"$PY" "$SK/scripts/prep_items.py" --tag "hot$MMDD" \
      --groups-file "tanyu_all_groups_$(date +%Y%m%d).json" \
      --prev-groups-file "tanyu_all_groups_<上期>.json"

# 有码批归类
"$PY" "$SK/scripts/group_classify.py" "tanyu_all_groups_$(date +%Y%m%d).json" \
      "_hot${MMDD}_coded_in.json" "_hot${MMDD}_coded_classified.json"

# 无码批: OMS 反查(tanyu-oms-name-lookup skill) → 转归类输入 + 自动 classify
"$PY" <oms_skill>/oms_pw_fast.py "_hot${MMDD}_ids3col.tsv" "_hot${MMDD}_oms_out.jsonl"
"$PY" "$SK/scripts/prepare_oms_items.py" --tag "hot$MMDD" --classify

# 待拍板款先扫核心词(判"到底有没有既有归口")
"$PY" "$SK/scripts/probe_corewords.py" --tag "hot$MMDD" --cores "护膝绑带艾草款,氨基酸护膝,..."
"$PY" "$SK/scripts/probe_group_detail.py" --group "PANAPOPO护膝V2支撑款"

"$PY" "$SK/scripts/make_green_plan.py" --tag "hot$MMDD" --date "$D"
"$PY" "$SK/scripts/make_suggest_list.py" --tag "hot$MMDD" --date "$D"
```

### 完整命令（用户说"可以绑的直接绑"）

```bash
cd "$WD"
DATE8=$(date +%Y%m%d); MMDD=$(date +%m%d)
PLAN="_plan_hot${MMDD}_green_${DATE8}.json"

"$PY" "$SK/scripts/precheck_plan.py" "$PLAN"        # → _precheck_clean.json / _precheck_warn.json
# ⚠️ 只用 _precheck_clean.json 重新落一份 plan 再绑, 否则会把"已绑过/已下架"的款重复提交
"$PY" "$SK/scripts/bind_batch.py" "$PLAN" "hot${MMDD}_green"
"$PY" "$SK/scripts/verify_bind.py" "$PLAN"          # 独立回读, 必须 0 mismatch
"$PY" "$SK/scripts/make_bind_report.py" --result "绑定结果_hot${MMDD}_green_${DATE8}.json"
```

---

## 4. 脚本速查

| 脚本 | 作用 | 主要参数 |
|---|---|---|
| `pull_shops.js` | 全量拉白名单店铺 → `_tanyu_live_22shops.json` | `[outfile]` |
| `pull_oneshop.js` | 单店全量（新店验证 / 单店盘点） | `<thirdShopId> "<shopName>" [outfile]` |
| `fetch_groups.js` | 拉全部分组清单（一次返回全量，不分页） | `[outfile]` |
| `probe_auth.py` | 登录态诊断（URL 含 /login + API 500） | — |
| `login_tanyu.py` | 有头 Chrome 扫码恢复登录态 | — |
| `filter_hot.py` | 热度维度筛选 + 与上期对比 | `--date --prev --tag --min-heat` |
| `filter_window.py` | 上架时间维度筛选（抓零热度盲区） | `--since --tag` |
| `prep_items.py` | 有码归类输入 / 无码 OMS tsv / 分组 diff | `--tag --groups-file --prev-groups-file` |
| `group_classify.py` | 归类引擎（纯函数，不联网不写库） | `<groups.json> <items.json> [out.json]` |
| `prepare_oms_items.py` | OMS jsonl → 归类输入（可选自动 classify） | `--tag --oms-out --classify` |
| `probe_corewords.py` | 核心词扫全量库，判"有无既有归口" | `--tag --cores / --from-yellow` |
| `probe_group_detail.py` | 主组已绑款名明细（判待建组前必查） | `--group / --all-groups` |
| `make_green_plan.py` | 引擎+人工提升 → 🟢 plan | `--tag --date --manual` |
| `make_suggest_list.py` | 五区建议清单 xlsx | `--tag --date` |
| `precheck_plan.py` | **绑定前实时预检**（回读 onSale + 已绑组） | `<plan> [--allow-offsale]` |
| `bind_batch.py` | 写库绑定 + 逐条反查 | `<plan> <out_tag> [--date]` |
| `revert_one.py` | 回退/解除绑定（传空数组清空分组） | `<thirdShopId> <spuId>...` |
| `verify_bind.py` | 独立回读复核 | `<plan>` |
| `make_bind_report.py` | 绑定核对表 xlsx | `--result` |
| `_common.py` / `_cfg.js` | 配置加载（脚本内部用） | — |

---

## 5. 判定规则摘要

### 引擎分类规则（`group_classify.py` 写死）
1. 杂质（人名/补差/赠品/运费）→ `杂质`
2. **MERGE 合并组映射**（AY护膝艾草绑带→`AY-护膝艾草绑带（长款+短款）`；静脉曲张/压缩袜→`静脉曲张压缩袜（中筒+长筒）`；海盐/药盐→`海盐/药盐热敷带（基础款+旗舰款）`；护腰20160142→`护腰20160142（轻巧款+经典款）`）
3. 主分组（排除渠道版/脏组）最长子串命中 → `可绑`
4. 仅渠道版命中（`-天猫/-pdd/-JD/—抖音/-半价`、`（df）/（DF-Dt）/（Dt）` 等后缀）→ `待拍板`
5. 脏组命中（残括号不闭合）→ `待拍板`（**但要追加一步组内归口探查**，残括号 ≠ 坏组）
6. 无既有组 → `待拍板`

### 四条最常复用的硬规则

1. **判「待建组」前必查主组已绑款名明细**（`probe_group_detail.py`）。很多组是"系列统一归口"型，收纳同族所有版本号（V2–V20 全系）。只看组名是否字面匹配 → 必然误判。
2. **近名款陷阱**：待拍板款名去掉品牌前缀后若含品类限定词（艾草/加绒/网眼/磁石…），必须同时用「带限定词」与「不带限定词」两个核心词各扫一遍全量库 —— 两边已绑分布可能完全相反。
   实测：`A-PANAPOPO四面弹艾草-护腰`（有归口，11 条中 6 条已绑）vs `A-PANAPOPO四面弹-护腰`（无归口，15 条全未绑），**仅差「艾草」二字**，曾连续 3 轮误判。
3. **款名"外裹品类壳"是引擎系统性漏判源**：`{品类}（{真实款名}）（后缀）`（例 `PANAPOPO腰椎固定带（护腰标准加强款）（df）`）→ 剥掉最外层壳，用核心款名去组清单搜，或查全量库同款名已绑记录（≥2 条零漂移即可放行）。
4. **口径盲区**：全量库只含本账号店铺，组内 `productNum` 远大于快照可计数；空 `outerId` 的已绑商品看不到款名。故凡"快照里没看到"都**不可断言组内无同族** → 一律列待拍板。

📌 已确认的「统一归口型组」清单、高频提升映射表、MERGE 误吸兜底、渠道版判据校准 —— 见 **`references/workflow-full.md` 第 ⑤ 节**。

---

## 6. 踩坑速查

| 症状 | 原因 | 处置 |
|---|---|---|
| 拉取逐店 `=> 0`、末尾 `DONE total 0` | 登录态失效 | `probe_auth.py` 确诊 → `login_tanyu.py` 扫码 → **别用 URL 判成功**，用 API 200 + total>0 |
| `browserType.launchPersistentContext: ... has been closed` | 两个浏览器脚本并发抢同一 profile | **chrome profile 串行**，一跑完再启下一个（纯 python 读 json 脚本不占 profile） |
| node: command not found / 拉取静默全 0 | node 版本目录被清理重建 | 先 `ls .../node/versions/` 看实际名（历史 `-3`→`-5`→`-6`），换新 PATH 重跑 |
| 绑定后复核找不到文件 | 产物日期后缀与预期不符 | 核对 `bind_batch.py --date`，或手工 rename |
| plan 里混入"刚绑过"的款 | 复用了当日旧快照 | **绑定前必跑 `precheck_plan.py`**，用 `_precheck_clean.json` 重建 plan |
| 建议清单里同一条既在 🟢 又在 🟡 | 人工提升款在 classify 里仍判"待拍板" | 已在 `make_suggest_list.py` 修复（按 plan 的 spuId 从 🟡/🟠 剔除）。脚本末尾有「五区去重合计 vs 热度批」自检，**必须打印 OK**；不等于热度批就说明跨区重复或漏列 |
| 有码批的"杂质"没出现在 ⚪ 页 | 只读了无码 `_junk.json` | 同上已修（cd/od 里 verdict=杂质 的行也会并入 ⚪） |
| `TypeError: string indices must be integers` | 把 `groups`（组名 str 列表）当对象列表 | 写 `gname in x['groups']`，不是 `g['name']` |
| 「已消除 66」但上轮只绑了 65 | 消除原因 ≥3 种：绑定生效 / 热度归零 / 被新建组收编 / 下架离售 | **逐条核对非绑定消除项**，别当成"绑定超预期" |
| 有码款反查后名字没变化 | 有码款外层装的已是 OMS 真名 | 反查只对**无码款**和**占位/异常款名**（如 `12.20改`、`发热鞋垫类目`）有真价值 |
| 大批款被判「仅命中渠道版组」，但那个组明明有上千款 | `group_classify.py` 的 `CHAN_SUFFIX` 把 `（df）`/`（DF-Dt）`/`（Dt）`/`（D）` 结尾的组**一律**当渠道版，剔出主表 | 先查组规模：`productNum` 上千 / `thirdShopIds` 几十家的**是主组**（如 `护腰坐姿椅基础款（df）` 1022款/69店），人工提升；真渠道版是 `-天猫/-pdd/-PDD` 后缀且仅 3~12 款 |
| 归类整批卡死 | 深层嵌套括号触发剥壳回溯 | 已在 `group_classify.py` 修复（深度上限 8 + 非贪婪）；再遇先怀疑某 name 触发死循环 |
| 覆盖 `_tanyu_live_22shops.json` 后没法对比 | 脚本直接覆盖同名文件 | **拉取前先 `cp` 一份带日期的快照做基线** |

📌 日期脚本替换顺序、node 目录坑、占位名流程缺口、绑组名单一次性快照机制 —— 见 **`references/workflow-full.md` 的「⚠️ 每日脚本的生成与日期替换」与「已知机制」章节**。

---

## 7. 单店盘点（用户点名"XX 店的未绑定分组统计一下"）

```bash
node "$SK/scripts/pull_oneshop.js" <thirdShopId> "<shopName>" "_pull_<slug>.json"
```

不重拉全量（单店实时拉取，千级商品 ~15s）。报告必须**分开说**「在售未绑」与「历史下架存量」——大店无分组占比常常很高（众创 94.7% / 器械保健 77.2%），但主体是历史下架存量，真正要处理的"在售无分组"只有几十条。合在一起说会让用户严重误判工作量。

---

## 8. references 与上下游分工

| 文件 | 内容 |
|---|---|
| `references/workflow-full.md` | **完整作业手册**：9 步详解、引擎全部规则与历史 bug 修复、统一归口组清单、高频提升映射表、每日脚本日期替换顺序、历史批次台账 |
| `references/workflow-diagram.md` | **流程图（Mermaid）**：巡检只读链路 → 用户确认关卡 → 写库绑定链路；含两个巡检维度、安全边界 |
| `scripts/` | 全部可执行脚本（参数化，读 `tanyu_config.json`） |
| `assets/` | 早期单文件副本（`group_classify.py` / `bind_batch.py` / `_precheck_plan.py`），保留兼容 |

- **上游** `tanyu-oms-name-lookup`：只管"无码商品 → OMS 真实商品名 → Excel 对照表"。本技能在其产物基础上做归类 + 绑定。
- **上游** `tanyu-data-fetch`：提供 playwright 模块（`node_modules/playwright`），本技能所有浏览器脚本复用其依赖。
- **下游** 无。绑定结果直接落库，出 Excel 交付。
