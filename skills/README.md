# 项目技能指令（抄录）

这里放的是「AI运营组工作台」日常运营真正用到的技能**指令说明**（`SKILL.md`）。
只有说明文档，不含脚本与凭据；要用完整能力，请在 WorkBuddy 技能管理里导入对应技能包。

| 目录 | 技能 | 什么时候用 |
|---|---|---|
| `tanyu-group-binding/` | 探域 · 商品分组绑定 | 把在售 SKU 归入既有分组；每日在售未绑巡检 |
| `tanyu-workshop-card-fix/` | 探域 · 调优工坊卡片修复 | 「待审核 · 话术未生成」闭环；回放后补生成 |
| `tanyu-data-fetch/` | 探域 · 数据拉取 | 拉店铺 / 账号 / 指标原始数据（有头浏览器） |
| `oms-code-lookup/` | OMS 编码查询 | 商品 ID → OMS 编码，处理前置校验异常 |
| `dingtalk-sheet-search/` | 钉钉表格检索 | 跨组织查 OMS 编码表 |
| `deploy-ai-workbench/` | 驾驶舱发布 | 版本号递增、发布、线上验证 |

## 和工作台的对应关系

| 工作台位置 | 对应技能 | 产出 |
|---|---|---|
| 资产库 · 商品分组绑定 | `tanyu-group-binding` | 分组绑定结果 → 回填任务状态 |
| 任务 · 膝部固定器归入既有组 | `tanyu-group-binding` | 同上 |
| 预警 · 12 个 SKU 待审核 | `tanyu-workshop-card-fix` | 话术生成率 |
| 数据看板 · 采纳率 / 生成率 | `tanyu-data-fetch` | `data/metrics.csv` |
| 预警 · OMS 远程码缺失 | `oms-code-lookup` / `dingtalk-sheet-search` | 编码回填 |
| 发布动作 | `deploy-ai-workbench` | 新版链接 |

## 注意

- 技能里的登录态、Cookie、凭据**不进仓库**，也不进团队空间。
- 新增技能时，把 `SKILL.md` 复制到本目录并更新上表，同时在 `MIGRATION.md` 1.4 节登记。
