# 数据源说明（data/*.csv）

这 8 个 CSV 是工作台的**团队数据源**，随仓库一起发布。改完提交 → 发布后，所有人的页面 60 秒内自动刷新。

## 硬规则

1. **编码 UTF-8（无 BOM）**，分隔符英文逗号，字段含逗号时用双引号包起来。
2. **表头不能改名、不能删列、不能调列序**。加列可以，但页面不认新列（要页面用上得改代码）。
3. **`id` 是主键，不能改**。改了等于删掉旧行 + 新增一行，界面上的历史改动会丢。
4. **空值写空**（`,,`），不要写 `null`、`-`、`/`。
5. 一行一条记录，不要合并单元格、不要加小计行、不要留空行。

## 各表字段

### shops.csv（店铺主数据）

| 字段 | 说明 |
|---|---|
| `id` | `s1`…`s128`，不改 |
| `name` | 店铺全名，与平台后台一致 |
| `platform` | 天猫 / 京东 / 拼多多 / 抖音 |
| `tag` | 重点 / 常规 |
| `owner` | 负责人（组长） |
| `binder` | 绑定人（账号归属人） |
| `order` | 排序号 |
| `auth` | 授权信息说明 |
| `opstat` | 运营中 / 历史·关店 |
| `third` | 三方服务商 |
| `note` | 备注 |

### accounts.csv（账号，不含密码）

| 字段 | 说明 |
|---|---|
| `id` | `ac001`… 不改 |
| `shop` | 所属店铺名 |
| `role` | 主账号 / 子账号 |
| `login` | 登录账号名 |
| `binder` | 绑定人 |
| `tail` | 手机号**后四位**，只记四位 |
| `owner` | 使用人 |
| `post` | 岗位 |
| `status` | 启用 / 停用 |
| `note` | 备注 |

> ⚠️ Excel 会把 `0021` 这类尾号自动变成 `21`。粘贴前把该列设为「文本」，或先存成 CSV 再用文本编辑器核对。

### metrics.csv（指标记录，一行 = 一店一天）

| 字段 | 说明 |
|---|---|
| `id` | 唯一，格式 `m<店铺序号>_<天序>` |
| `shop` | 店铺名 |
| `date` | `YYYY-MM-DD` |
| `adopt` / `gen` / `conv` / `risk` / `agent` / `resp` | 采纳率 / 生成率 / 转化率 / 风控率 / 纯智占比 / 回复率，百分数写数字（`64.1` 表示 64.1%） |
| `note` | 备注 |

### alerts / tasks / qc / assets / apis

| 表 | 关键字段 |
|---|---|
| `alerts` | type / level(P0~P2) / shop / desc / due / status |
| `tasks` | title / owner / prio / status / due / type |
| `qc` | name / type / threshold / level / hits / status |
| `assets` | name / type / cat / shop / url / owner / status / date |
| `apis` | name / type / endpoint / status / calls / errors |

## 改数据的两种方式

| 方式 | 适合 | 生效 |
|---|---|---|
| 直接改 CSV → 提交 → 发布 | 批量、初始化、要留 git 记录 | 发布后 60 秒，所有人 |
| 页面右上角输码 → 界面里改 | 单条状态 / 备注 / 负责人 / 目标值 | 保存即写云端，其他人 60 秒内 |

两条通道撞上同一行时的规则见 `MIGRATION.md` 第 5.2 节（谁更晚谁生效，界面新建的行不会被 CSV 删掉）。

## 校验

```bash
npm run build      # 会打印每张表行数；行数异常说明改坏了
```

`data/manifest.json` 由构建自动生成（版本号 = 内容哈希），**不要手改**。
