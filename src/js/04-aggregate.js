/* ---------- 聚合 ---------- */
const agg = {
  shopNames() {
    const s = new Set(store.list('shops').map(x => x.name).filter(Boolean));
    store.list('metrics').forEach(m => m.shop && s.add(m.shop));
    return Array.from(s).sort();
  },
  owners() {
    const s = new Set(store.list('shops').map(x => x.owner).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  },
  /* 账号角色词表：固定常用 + 数据里实际出现的 */
  roles() {
    const base = ['娟娟', '居居', '探域', '申诉', '小娟', '小居', '瑶瑶', '小杨', '栩栩', '只只', '笑笑', '主账号'];
    const s = new Set(base);
    store.list('accounts').forEach(a => { if (a.role) s.add(a.role); });
    return Array.from(s);
  },
  /* 每店的账号列表 */
  accountsByShop() {
    const map = {};
    store.list('accounts').forEach(a => {
      const k = a.shop;
      if (!k) return;
      (map[k] = map[k] || []).push(a);
    });
    return map;
  },
  dates() {
    const s = new Set(store.list('metrics').map(m => m.date).filter(Boolean));
    return Array.from(s).sort().reverse();
  },
  /* 每店最新一条 */
  latestByShop() {
    const map = {};
    store.list('metrics').forEach(m => {
      if (!m.shop || !m.date) return;
      if (!map[m.shop] || m.date > map[m.shop].date) map[m.shop] = m;
    });
    return map;
  },
  /* 某天各店均值 */
  dayAvg(date) {
    const recs = store.list('metrics').filter(m => m.date === date);
    const out = {};
    M_KEYS.forEach(k => { out[k] = avg(recs.map(m => num(m[k]))); });
    out._n = recs.length;
    return out;
  },
  /* 六项：近 7 天 vs 前 7 天 */
  sixStats() {
    const ds = agg.dates();
    const cur = ds.slice(0, 7), prev = ds.slice(7, 14);
    const meanOf = arr => {
      const recs = store.list('metrics').filter(m => arr.indexOf(m.date) >= 0);
      const o = {};
      M_KEYS.forEach(k => { o[k] = avg(recs.map(m => num(m[k]))); });
      return o;
    };
    const a = meanOf(cur), b = meanOf(prev);
    return METRICS.map(def => ({ def, cur: a[def.k], prev: b[def.k] }));
  },
  /* 近 n 天序列 */
  series(n) {
    const ds = agg.dates().slice(0, n).reverse();
    return ds.map(d => Object.assign({ date: d }, agg.dayAvg(d)));
  },
  /* 未达标店铺 */
  breaches() {
    const latest = agg.latestByShop(), T = store.cfg.targets, out = [];
    Object.keys(latest).forEach(shop => {
      const m = latest[shop];
      METRICS.forEach(def => {
        if (!def.tgt) return;
        const v = num(m[def.k]);
        if (v == null) return;
        if (def.hi ? v < T[def.tgt] : v > T[def.tgt]) {
          out.push({ shop, metric: def.l, k: def.k, v, tgt: T[def.tgt], gap: +(v - T[def.tgt]).toFixed(1) });
        }
      });
    });
    return out.sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
  },
  counts() {
    const alerts = store.list('alerts');
    const tasks = store.list('tasks');
    const qc = store.list('qc');
    const apis = store.list('apis');
    const shops = store.list('shops');
    const latest = agg.latestByShop();
    const bad = Object.keys(latest).filter(s => agg.breaches().some(b => b.shop === s)).length;
    return {
      alertOpen: alerts.filter(a => a.status !== '已处理').length,
      badShops: bad,
      shops: shops.length,
      keyShops: shops.filter(s => s.tag === '重点').length,
      records: store.list('metrics').length,
      tasksTodo: tasks.filter(t => t.status !== '已完成').length,
      qcActive: qc.filter(q => q.status === '生效中').length,
      apiDown: apis.filter(a => a.status !== '正常').length,
      assets: store.list('assets').length
    };
  },
  /* 规则化洞察：找最该修的店 + 原因 */
  insight() {
    const latest = agg.latestByShop(), T = store.cfg.targets;
    const rows = Object.keys(latest).map(shop => {
      const m = latest[shop], v = num(m.adopt);
      return { shop, v, gap: v == null ? -999 : v - T.adopt, rec: m };
    }).filter(r => r.v != null).sort((a, b) => a.v - b.v);
    if (!rows.length) return null;
    const worst = rows[0];
    const below = rows.filter(r => r.v < T.adopt).length;
    return { worst, below, total: rows.length };
  }
};
