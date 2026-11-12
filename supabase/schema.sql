-- ============================================================
-- AI运营组工作台 · 云端存储（Supabase）
-- 用法：Supabase 控制台 → 左侧 SQL Editor → New query → 粘贴全文 → Run
-- 跑完页面刷新即可，无需其它配置。
-- 与「远山驾驶舱」用的是同一个项目，只是独立两张表，互不影响。
-- ============================================================

-- 1) 记录表：一行 = 一条店铺 / 账号 / 指标 / 任务……
create table if not exists public.ops_records (
  key        text primary key,          -- 形如 shops:abc123
  coll       text not null,             -- shops / accounts / metrics / tasks ...
  rec_id     text,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists ops_records_coll_idx on public.ops_records (coll);

-- 2) 配置表：一行 = 一份团队配置（达标线、统计区间）
create table if not exists public.ops_kv (
  k          text primary key,
  v          jsonb not null,
  updated_at timestamptz not null default now()
);

-- 3) 打开即用的读写策略（拿到链接就能用，不做登录）
alter table public.ops_records enable row level security;
alter table public.ops_kv      enable row level security;

drop policy if exists ops_records_all on public.ops_records;
create policy ops_records_all on public.ops_records
  for all to anon, authenticated using (true) with check (true);

drop policy if exists ops_kv_all on public.ops_kv;
create policy ops_kv_all on public.ops_kv
  for all to anon, authenticated using (true) with check (true);

-- 4) 权限（Supabase 新项目通常已默认放开，这里显式补一遍）
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.ops_records to anon, authenticated;
grant select, insert, update, delete on public.ops_kv      to anon, authenticated;

-- 5) 让接口立刻认识这两张表
notify pgrst, 'reload schema';
