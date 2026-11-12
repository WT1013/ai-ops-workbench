---
name: dingtalk-sheet-search
description: 在钉钉在线电子表格(axls)或本地文件(xlsx/csv/tsv/txt/md/json)里做快速精准搜索。当用户要在钉钉表格里"查某个商品/编号对应的值、按某列匹配取同行其它列、搜某行某格、给个ID查OMS码/编码/价格等字段"，或在本地一堆文件里"找含某关键词的文件/单元格/行、跨文件全文搜、在文件夹里定位内容"时使用。覆盖：定位目标(钉钉表含 dlink 快捷方式与跨组织拦截判定) → 拿真实工作表 → 选路(服务端 find / csv-get / 整表或本地文件交给 search_table.py、local_search.py 建索引毫秒级秒查) → 返回命中。内置"量小用服务端搜索、量大/多次查询用本地索引"提速决策与大小写/全半角归一化。只读检索，绝不修改源表/源文件。
agent_created: true
---

# 钉钉表格快速精准搜索

## Overview

把"搜索内容"做成确定、可复用、能提速的流程。**钉钉在线表**与**本地文件**统一成同一种提速思想：把反复/大批的查询，从每次打 API 或全量人工翻，变成一次建索引后毫秒级秒查；对少量定位则直接服务端或本地精确搜索，不浪费拉取。

典型诉求：「在 XX 钉钉表里查商品 123 的 OMS 码」「搜某文件夹里哪些 xlsx/csv 含"艾草护膝"」「按某列值把整行给我」「在本地一堆文档里找含"2026"的所有行」——本 skill 都处理。

## 硬性边界(始终遵守)

1. **只读不写**：只做搜索/读取/导出到本地临时文件。不修改、不删除源表/源文件。用户要改数据走其它流程。
2. **ID 必须真实**：钉钉的工作表 sheetId、nodeId 一律来自命令真实返回；禁止臆造 `Sheet1`/`0`/`default`。
3. **不跨组织硬绕**：钉钉真实表属"合作伙伴"组织而当前 profile 不是时，读取报 `forbidden.accessDenied`，如实告知用户需切到目标组织，不循环重试、不猜替代命令。
4. **dlink 必须解析到真身**：快捷方式逐跳 `doc info` 消费 `linkSourceInfo.nodeId`，只允许最终 `extension=axls`；否则停止。
5. **读完全才算读完**：钉钉分块拉取时 `hasMore` 必须 false、无 `truncationReasons` 才算完整，按 `returnedRange` 续块，设块数上限防死循环。

## 选路决策树(先看这里)

拿到"在哪搜、找什么"后，按下表路由：

| 场景 | 走哪条 | 用哪个 |
|---|---|---|
| 钉钉表：关键词/正则/整格精确，只要定位单元格 | 服务端搜索 | `dws sheet find` |
| 钉钉表：已知范围，取某列对应同行字段(小块映射) | 服务端读取 | `dws sheet csv-get` 带 range |
| 钉钉表：整表/多次查询/聚合去重 | 拉整表→落盘→本地引擎 | `search_table.py` |
| 本地文件(xlsx/csv/tsv/txt/md/…)：全文找内容/按列映射 | 本地引擎 | `local_search.py` |
| 本地有钉钉表导出的 tsv/csv | 本地引擎 | `search_table.py` 或 `local_search.py` |

> 一句话：**单次小定位走服务端，反复/大表/跨文件/取字段映射走本地索引。**

## 工作流

### A. 钉钉在线表(axls)
#### ① 定位目标表格并拿真实工作表
1. 用户给 URL/陌生 nodeId → `dws drive info --node <URL_OR_ID> --format json` 确认类型；dlink 按边界#4逐跳解析，只认 axls。
2. `dws sheet list --node <最终NODE_ID> --format json` → 取目标工作表的真实 `sheetId`。
3. 跨组织拦截时按边界#3处理。命令细节见 `references/dingtalk-sheet-cmds.md` §0-§1。

#### ② 按需求选路执行
- **定位/少量**：`dws sheet find --node <NODE_ID> --sheet-id <SHEET_ID> --find "<关键词>" [--match-entire-cell] [--match-case=false] [--use-regexp] --format json`，读 `matchedCells[].a1Notation`。若命中后还要取同行其它列，用该 A1 所在行范围做一次 `csv-get`。
- **小块映射**：`dws sheet csv-get --node <NODE_ID> --sheet-id <SHEET_ID> --range "A1:F50" --format json`，按 `rowIndices`/`colIndices` 定位列，取目标 key 对应的 value 所在行。
- **整表/多次查询**：分块 `csv-get`(每块 ≤30000 格)或一次 `table-get`，去掉 `[row=N]` 前缀拼成 TSV 落盘到工作目录，然后交给本地引擎。

命令与续块细节见 `references/dingtalk-sheet-cmds.md` §3-§4、§6。

### B. 本地文件检索(直接跑本地引擎)
用户指定本地目录/文件，或钉钉表已导出落盘后，直接用 `local_search.py`：
```
python <本skill>/scripts/local_search.py --paths <目录或文件,逗号分隔> [--glob "*.xlsx,*.csv,*.txt"] --query <关键词> [--all-matches] [--show-context]
python <本skill>/scripts/local_search.py --paths <表.xlsx> --by <key列> --value <值> [--cols 输出列,...]
```
- 自动扫目录(递归)，支持 xlsx/csv/tsv/txt/md/log/json；xlsx 逐 sheet 扫。
- 全文 `--query` 跨文件找"哪个文件哪个单元格/行含词"；`--regex` 走正则。
- 表格 `--by/--value` 做列映射(同 search_table 语义)。xlsx 需 openpyxl(环境已带 3.1.5)。
- 精确匹配默认忽略大小写/全半角(`--norm` 语义内置，本脚本按 norm 处理 exact/icontains)。

### C. 用本地引擎秒查单表(钉钉导出/本地单表)
单份表用 `search_table.py`(更聚焦列映射与多命中)：
```
python <本skill>/scripts/search_table.py --table <导出的.tsv|.csv|.xlsx> --by <key列> --value <值> [--cols 输出列,...] [--all-matches] [--match-mode exact|icontains|contains|regex]
```
- 例：查商品ID对应OMS码 → `--by 商品ID --value JD10001 --cols 商品名,OMS码`。
- 完整参数见脚本 docstring。

## 运行环境
- `dws` CLI：走 connector-dingtalk(dws)skill 的会话注入，直接 `dws sheet ...`。
- python：`C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe`(search_table.py 零依赖；local_search.py 读 xlsx 需 openpyxl，已装)。

## Resources
- `references/dingtalk-sheet-cmds.md` — 钉钉 sheet 检索命令速查(find/csv-get/table-get/list)、分块完整读取、dlink/跨组织边界。
- `scripts/search_table.py` — 单表本地毫秒级检索引擎(列映射/精确/contains/regex/全文)。
- `scripts/local_search.py` — 本地多文件检索引擎(目录递归跨 xlsx/csv/txt… 全文搜 + 表格列映射)。
