/* =========================================================
   店铺 / 账号 导入（Excel .xlsx / .xls · .csv · .tsv · 粘贴 · .json）
   ---------------------------------------------------------
   与「导入指标」是两套：这里导的是店铺主数据与账号表。
   - 店铺按 name 去重，账号按「店铺 + 登录账号」去重
   - 已存在时只补空字段，不覆盖同事手工填过的值
   - 账号里的店铺在库里找不到 → 自动建档，标记待补全
   - 账号只留「绑定人 + 手机后四位」，不接收密码列
   ========================================================= */

const SHOP_HEAD_MAP = {
  '店铺': 'name', '店铺名': 'name', '店铺名称': 'name', '店名': 'name', '门店': 'name', 'name': 'name',
  '平台': 'platform', '所属平台': 'platform', 'platform': 'platform',
  '标签': 'tag', 'tag': 'tag', '标记': 'tag',
  '负责人': 'owner', '组长': 'owner', 'owner': 'owner',
  '绑定人': 'binder', 'binder': 'binder',
  '排序': 'order', '排序号': 'order', '序号': 'order', 'order': 'order',
  '授权': 'auth', '授权信息': 'auth', 'auth': 'auth',
  '运营状态': 'opstat', 'opstat': 'opstat', '店铺状态': 'opstat', '状态': 'opstat',
  '三方': 'third', '服务商': 'third', '三方服务商': 'third', 'third': 'third',
  '备注': 'note', 'note': 'note', '说明': 'note'
};

const ACCT_HEAD_MAP = {
  '店铺': 'shop', '店铺名': 'shop', '店铺名称': 'shop', 'shop': 'shop',
  '角色': 'role', 'role': 'role', '账号类型': 'role',
  '登录账号': 'login', '账号': 'login', '登录名': 'login', 'login': 'login', '账号名': 'login',
  '绑定人': 'binder', 'binder': 'binder',
  '尾号': 'tail', 'tail': 'tail', '手机后四位': 'tail', '后四位': 'tail', '手机尾号': 'tail', '手机号': 'tail',
  '绑定号码': 'tail', '绑定手机': 'tail', '手机号码': 'tail', '手机': 'tail', '电话': 'tail',
  '使用人': 'owner', 'owner': 'owner',
  '岗位': 'post', 'post': 'post', '职位': 'post',
  '状态': 'status', 'status': 'status', '启用状态': 'status',
  '店铺负责人': 'shopowner', '负责人': 'shopowner', '店长': 'shopowner',
  '备注': 'note', 'note': 'note', '说明': 'note',
  /* 密码列：认出来但一律丢弃，工作台不保存密码 */
  '密码': '__skip', '登录密码': '__skip', 'password': '__skip', 'pwd': '__skip'
};

const PLAT_ALIAS = {
  '拼多多': '拼多多', '多多': '拼多多', 'pdd': '拼多多',
  '天猫': '天猫', 'tmall': '天猫',
  '京东': '京东', 'jd': '京东',
  '抖音': '抖音', '抖店': '抖音', 'douyin': '抖音'
};

const impS = v => String(v == null ? '' : v).replace(/[\u200b\u3000]/g, ' ').trim();
const impKey = v => impS(v).replace(/\s/g, '').toLowerCase();

/* 表头归一：容忍空格、全角空格、括号补充说明 */
function impHeadCell(cell) {
  const a = impS(cell).replace(/\s/g, '').toLowerCase();
  const b = a.replace(/[（(][^)）]*[)）]/g, '');
  return [a, b];
}
function impLookup(map, cell) {
  const keys = impHeadCell(cell);
  for (let i = 0; i < keys.length; i++) if (map[keys[i]]) return map[keys[i]];
  return null;
}

/* 一行 CSV 拆分：支持 RFC4180 的双引号包裹 */
function impSplitLine(line, delim) {
  if (delim !== ',') return line.split(delim).map(s => s.trim());
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (q) {
      if (c === '"') {
        if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function impTextToCells(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .split('\n').filter(l => l.trim());
  if (lines.length < 2) return { err: '至少要有表头 + 1 行数据' };
  const head = lines[0];
  const delim = head.indexOf('\t') >= 0 ? '\t' : (head.indexOf(',') >= 0 ? ',' : /\s{2,}/);
  return { cells: lines.map(l => impSplitLine(l, delim)) };
}

/* .xlsx / .xls：用 SheetJS 读成二维数组（raw:false，统一成文本，避免尾号被当数字） */
function impReadWorkbook(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const X = window.XLSX;
        if (!X) throw new Error('Excel 解析库没加载上，请改用 CSV 或粘贴');
        const wb = X.read(new Uint8Array(fr.result), { type: 'array', raw: false, cellDates: false });
        const names = wb.SheetNames || [];
        if (!names.length) throw new Error('这个文件里没有工作表');
        resolve({ wb, names, X });
      } catch (e) { reject(e); }
    };
    fr.onerror = () => reject(new Error('文件读取失败'));
    fr.readAsArrayBuffer(file);
  });
}

function impSheetToCells(X, wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return { cells: [] };
  const aoa = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
  const cells = (aoa || []).map(r => (Array.isArray(r) ? r.map(c => impS(c)) : []));
  return { cells };
}

/* 多工作表时挑最像的那张 */
function impPickSheet(names, obj) {
  const want = obj === 'shops' ? /店|铺|shop/i : /账号|帐号|acct|account|登录/i;
  const hit = names.find(n => want.test(n));
  return hit || names[0];
}

/* ---------- 字段归一 ---------- */
const impPlatform = v => {
  const s = impS(v);
  if (!s) return '未分类';
  return PLAT_ALIAS[s.toLowerCase()] || s;
};
const impTag = (tag, opstat) => {
  const t = impS(tag), o = impS(opstat);
  if (/历史|关店|关闭|下线|停业/.test(t + o)) return '历史';
  if (/重点|核心|关键|主推/.test(t)) return '重点';
  return '常规';
};
const impOpstat = v => (/历史|关店|关闭|下线|停业/.test(impS(v)) ? '历史·关店' : '运营中');
const impTail = v => {
  let s = impS(v).replace(/\D/g, '');
  if (!s) return '';
  if (s.length > 4) s = s.slice(-4);
  return s.padStart(4, '0');
};
const impRole = v => {
  const s = impS(v);
  if (!s) return '';
  if (/主/.test(s)) return '主账号';
  if (/子|副/.test(s)) return '子账号';
  return s;
};
const impStatus = v => (/停用|禁用|关闭|注销/.test(impS(v)) ? '停用' : '启用');

/* 绑定人单元格常见「手机号（姓名）」：拆出姓名，手机号交给 impTail 取后四位 */
function impBinderName(v) {
  const s = impS(v);
  if (!s) return '';
  if (/^1\d{10}$/.test(s)) return '';                       // 只有手机号，没有姓名
  const m = s.match(/^1\d{10}\s*[（(]\s*([^)）]+?)\s*[)）]/);
  if (m) return m[1].trim();
  const m2 = s.match(/^([^（(]+?)\s*[（(]\s*1\d{10}\s*[)）]/); // 「姓名（手机号）」
  if (m2) return m2[1].trim();
  return s;
}

/* 分组标题常混进日期/备注：「祥佳个人护理专营店-3/24承接」「衡源湘养生馆11.19」→ 只留店名 */
function impGroupShopName(v) {
  const raw = impS(v);
  let s = raw;
  s = s.replace(/\s*[-—–]?\s*\d{1,2}\s*[\/.]\s*\d{1,2}(?:\s*[-—–]\s*\d{1,2}\s*[\/.]\s*\d{1,2})?\s*(承接|起|闭店|关店|已关|停业)?\s*$/, '');
  s = s.replace(/\s*\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}.*$/, '');
  s = s.replace(/[（(]\s*\d{4}\s*[-/.]\s*\d{1,2}.*[)）]\s*$/, '');
  s = s.replace(/\s*(承接|闭店|关店|已关|停业|已下架)\s*$/, '');
  s = s.trim();
  return s || raw;
}

/* 一张表里可能是「标题行 + 表头 + 数据」重复好几段（如 天猫段 / 训练师段 / 京东段），
   也常有标题占掉第一行。这里按「一行里认出 ≥2 个列名」判定表头，把表切成若干段。 */
function impSegments(cells, map) {
  const segs = [];
  let cur = null, lastText = '';
  (cells || []).forEach((row, i) => {
    const keys = (row || []).map(c => impLookup(map, c));
    const hits = keys.filter(Boolean);
    if (hits.length >= 2 && new Set(hits).size >= 2) {
      const idx = {};
      keys.forEach((k, j) => { if (k && idx[k] == null) idx[k] = j; });
      cur = { title: lastText, headNo: i + 1, idx: idx, rows: [] };
      segs.push(cur);
      lastText = '';
      return;
    }
    const cellsTxt = (row || []).map(c => impS(c)).filter(Boolean);
    if (!cellsTxt.length) return;
    if (!cur) { lastText = cellsTxt.join(' ').slice(0, 40); return; }  // 表头之前 = 标题行
    cur.rows.push({ no: i + 1, line: row });
  });
  return segs;
}

/* 店铺名主干：去掉「官方旗舰店 / 京东自营 / 专营店」这类通用后缀，用于跟账号名比对 */
const IMP_SHOP_GENERIC = /(官方旗舰店|旗舰店|专卖店|专营店|京东自营|自营|企业店|官方店|店|馆)/g;
function impShopStem(name) {
  return impKey(String(name || '').replace(IMP_SHOP_GENERIC, ''));
}

/* 表格里没有「店铺」列时，从登录账号反推店铺：
   1) 冒号前缀         zeamo旗舰店:思思
   2) 去掉末尾角色名   VEEVCC-惜云 → VEEVCC
   反推出的名字必须能对上库里已有的店，否则宁可不猜（避免造垃圾店）。 */
function impShopFromLogin(login, role, shops) {
  const s = impS(login);
  if (!s) return '';
  const parts = s.split(/[:：]/);
  if (parts.length > 1 && impS(parts[0])) return impGroupShopName(parts[0]);

  let base = s;
  const r = impS(role);
  if (r && base.length > r.length && base.slice(-r.length) === r) base = base.slice(0, -r.length);
  base = base.replace(/[-_·—\s]+$/, '');
  const nBase = impKey(base);
  if (nBase.length < 3) return '';

  const list = shops || (typeof store !== 'undefined' ? store.list('shops') : []);
  let best = '';
  list.forEach(sh => {
    const n = impKey(sh.name);
    if (!n || n.length < 3) return;
    const hit = n === nBase || n.indexOf(nBase) === 0 || nBase.indexOf(n) === 0;
    if (hit && sh.name.length > best.length) best = sh.name;
  });
  if (best) return best;

  /* 3) 用「去掉通用后缀的店名主干」比对：
        KYOLENS医疗保健莹莹 → 主干 kyolens医疗保健 → KYOLENS医疗保健京东自营旗舰店
        同一主干对上多家店视为歧义，不猜。 */
  const nLogin = impKey(base.length >= 3 ? base : s);
  const cands = [];
  list.forEach(sh => {
    const st = impShopStem(sh.name);
    if (st.length >= 4 && nLogin.indexOf(st) === 0) cands.push({ name: sh.name, len: st.length });
  });
  if (!cands.length) return '';
  const maxLen = Math.max.apply(null, cands.map(c => c.len));
  const top = cands.filter(c => c.len === maxLen);
  if (top.length === 1) return top[0].name;

  /* 4) 主干撞车时用关键词区分：zeamo自营 → 只在名字带「自营」的那家唯一命中 */
  const IMP_SHOP_TOKENS = ['自营', '医疗保健', '居家', '运动户外', '母婴', '个护健康',
    '运动护具', '宠物', '医疗器械', '洗护', '护肤', '美妆', '旗舰'];
  const toks = IMP_SHOP_TOKENS.filter(t => base.indexOf(t) >= 0);
  if (toks.length) {
    const f = top.filter(c => toks.some(t => c.name.indexOf(t) >= 0));
    if (f.length === 1) return f[0].name;
  }
  return '';
}

/* 从每段表上方的标题猜平台：「天猫探域账号」「京东工作账号汇总」 */
function impPlatFromTitle(t) {
  const s = impS(t);
  if (!s) return '';
  if (/天猫|tmall/i.test(s)) return '天猫';
  if (/京东|jingdong|\bjd\b/i.test(s)) return '京东';
  if (/拼多多|pinduoduo|pdd/i.test(s)) return '拼多多';
  if (/抖音|抖店|douyin/i.test(s)) return '抖音';
  return '';
}

/* 分组式账号表（很多店铺信息表就是这个结构）：
     店铺            | 密码   | 使用人 | 岗位   | 绑定人
     某某旗舰店       |        |        |        |            ← 只有店名 = 分组标题
     某某旗舰店小杨   | ****  | 刘娟   | 组长   | 手机号（姓名） ← 下面的才是账号
   统一处理四种情况：分组式 / 标准扁平式 / 没有店铺列 / 一段表里叠多段。 */
function impParseAcctRows(cells) {
  const segs = impSegments(cells, ACCT_HEAD_MAP);
  const rows = [], skip = [], noShop = [];
  const seen = {};
  let groups = 0;

  segs.forEach(seg => {
    const idx = seg.idx;
    const grouped = idx.shop != null && idx.login == null;
    const segPlat = impPlatFromTitle(seg.title);
    let curShop = '';

    seg.rows.forEach(({ no, line }) => {
      const get = k => (idx[k] == null ? '' : impS(line[idx[k]]));
      let shop = '', login = '';

      if (grouped) {
        const first = impS(line[idx.shop]);
        if (!first) return;
        if (/^合计|^小计|^总计/.test(first)) return;
        const others = Object.keys(idx)
          .filter(k => k !== 'shop' && k !== '__skip')
          .map(k => impS(line[idx[k]]));
        if (others.every(v => v === '')) {           // 只有店名 = 分组标题
          curShop = impGroupShopName(first);
          groups++;
          return;
        }
        if (!curShop) { skip.push(no); return; }
        shop = curShop;
        login = first;
      } else {
        login = get('login');
        shop = get('shop');
        if (!login) { skip.push(no); return; }
        if (!shop) shop = impShopFromLogin(login, get('role'), null);
        if (!shop) { noShop.push({ no: no, login: login }); return; }
      }

      const key = impKey(shop) + '|' + impKey(login);
      if (seen[key]) return;
      seen[key] = 1;
      rows.push({
        shop: shop,
        role: impRole(get('role')),
        login: login,
        binder: impBinderName(get('binder')),
        tail: impTail(get('tail') || get('binder')),
        owner: get('owner'),
        post: get('post'),
        status: impStatus(get('status')),
        note: get('note'),
        shopowner: get('shopowner'),
        plat: segPlat
      });
    });
  });

  return { rows, skip, noShop, groups, segs: segs.length };
}

/* 空值判断：0 与 '0' 都算有值 */
const impBlank = v => v == null || impS(v) === '';

/* 只补空，不覆盖：返回补上的字段数 */
function impFillEmpty(rec, patch, skip) {
  let n = 0;
  Object.keys(patch).forEach(k => {
    if (skip && skip.indexOf(k) >= 0) return;
    if (impBlank(patch[k])) return;
    if (impBlank(rec[k])) { rec[k] = patch[k]; n++; }
  });
  return n;
}

/* ---------- 解析成记录 ---------- */
function impMapRows(cells, map) {
  const segs = impSegments(cells, map);
  if (!segs.length) return { rows: [], err: '表头一行都没认出来，请检查列名' };

  const rows = [], bad = [];
  segs.forEach(seg => {
    const got = Object.keys(seg.idx);
    seg.rows.forEach(({ line }) => {
      const first = impS(line[0]);
      if (/^合计|^小计|^总计|^备注[:：]?$/.test(first)) return;
      const raw = {};
      got.forEach(k => { if (k !== '__skip') raw[k] = impS(line[seg.idx[k]]); });
      if (!got.some(k => k !== '__skip' && !impBlank(raw[k]))) return;
      rows.push(raw);
    });
  });
  return { rows, bad, idx: segs[0].idx, segs: segs.length };
}

function impNormShops(raw) {
  const out = [], skip = [];
  raw.forEach((o, i) => {
    const name = impS(o.name);
    if (!name) { skip.push(i + 2); return; }
    out.push({
      name: name,
      platform: impPlatform(o.platform),
      tag: impTag(o.tag, o.opstat),
      owner: impS(o.owner),
      binder: impS(o.binder),
      order: impBlank(o.order) ? '' : (Number(o.order) || ''),
      auth: impS(o.auth),
      opstat: impOpstat(o.opstat || o.tag),
      third: impS(o.third),
      note: impS(o.note)
    });
  });
  return { rows: out, skip };
}

function impNormAccts(raw) {
  const out = [], skip = [];
  raw.forEach((o, i) => {
    const shop = impS(o.shop), login = impS(o.login);
    if (!shop || !login) { skip.push(i + 2); return; }
    out.push({
      shop: shop,
      role: impRole(o.role),
      login: login,
      binder: impBinderName(o.binder),
      tail: impTail(o.tail) || impTail(o.binder),
      owner: impS(o.owner),
      post: impS(o.post),
      status: impStatus(o.status),
      note: impS(o.note)
    });
  });
  return { rows: out, skip };
}

/* 同一文件里重复的行（同店同名 / 同店同账号）只留第一条 */
function impDedupe(rows, keyFn) {
  const seen = {}, out = [];
  rows.forEach(r => { const k = keyFn(r); if (seen[k]) return; seen[k] = 1; out.push(r); });
  return out;
}

/* ---------- 弹窗 ---------- */
const impState = { obj: 'shops', src: 'file', cells: null, sheet: '', names: [], file: '', parsed: null };

function impSample(obj) {
  return obj === 'shops'
    ? '店铺名称,平台,标签,负责人,绑定人,运营状态,备注\nZY 京东自营旗舰店,京东,重点,王涛,李静,运营中,新签'
    : '店铺名称,角色,登录账号,绑定人,尾号,使用人,岗位,状态\nZY 京东自营旗舰店,主账号,ZY京东自营,李静,0021,张敏,店长,启用';
}

function openStoreImport() {
  impState.obj = 'shops';
  impState.src = 'file';
  impState.cells = null; impState.sheet = ''; impState.names = []; impState.file = ''; impState.parsed = null;

  openModal({
    title: '导入店铺 / 账号',
    wide: true,
    body: `
      <div class="imp-grp">
        <span class="imp-grp-lbl">导入对象</span>
        <div class="imp-tabs" id="impObjTabs">
          <button class="on" data-obj="shops">店铺主数据</button>
          <button data-obj="accounts">账号</button>
        </div>
      </div>
      <div class="imp-grp">
        <span class="imp-grp-lbl">数据来源</span>
        <div class="imp-tabs" id="impSrcTabs">
          <button class="on" data-src="file">选择文件</button>
          <button data-src="paste">粘贴表格</button>
        </div>
      </div>

      <div id="impFileBox">
        <input type="file" id="impFilePick" accept=".xlsx,.xls,.csv,.tsv,.txt,.json" style="font-size:12px;color:var(--ink2)" />
        <div class="fld" style="margin-top:8px"><span class="tip" id="impFileTip">
          支持 Excel（.xlsx / .xls）、CSV、TSV。表头一行写清列名即可，列顺序不限。
        </span></div>
      </div>

      <div id="impPasteBox" style="display:none">
        <textarea class="imp-area" id="impPasteArea" spellcheck="false"></textarea>
        <div class="fld" style="margin-top:8px"><span class="tip">从 Excel 直接框选复制（含表头）粘进来即可。</span></div>
      </div>

      <div class="imp-preview" id="impStorePrev">等待读取…</div>
    `,
    buttons: [
      { label: '取消', cls: 'ghost' },
      { label: '导入', cls: 'primary', fn: (close) => doStoreImport(close) }
    ],
    onMount: (root) => {
      const area = $('#impPasteArea', root);
      area.value = impSample('shops');
      area.addEventListener('input', () => {
        const r = impTextToCells(area.value);
        impState.cells = r.cells || null;
        impState.sheet = ''; impState.names = []; impState.file = '粘贴内容';
        impState.parsed = null;
        impPreviewStores(root);
      });

      $$('[data-obj]', root).forEach(b => b.addEventListener('click', () => {
        $$('[data-obj]', root).forEach(x => x.classList.toggle('on', x === b));
        impState.obj = b.dataset.obj;
        area.value = impSample(impState.obj);
        impState.cells = null; impState.sheet = ''; impState.names = []; impState.file = ''; impState.parsed = null;
        $('#impFilePick', root).value = '';
        impPreviewStores(root);
      }));

      $$('[data-src]', root).forEach(b => b.addEventListener('click', () => {
        $$('[data-src]', root).forEach(x => x.classList.toggle('on', x === b));
        impState.src = b.dataset.src;
        $('#impFileBox', root).style.display = impState.src === 'file' ? 'block' : 'none';
        $('#impPasteBox', root).style.display = impState.src === 'paste' ? 'block' : 'none';
        if (impState.src === 'paste') { area.value = impSample(impState.obj); area.focus(); }
      }));

      $('#impFilePick', root).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        impState.file = f.name;
        impState.parsed = null;
        const box = $('#impStorePrev', root);
        box.innerHTML = '正在解析 <b>' + esc(f.name) + '</b> …';
        try {
          if (/\.xlsx?$/i.test(f.name)) {
            const { wb, names, X } = await impReadWorkbook(f);
            impState.names = names;
            impState.sheet = impPickSheet(names, impState.obj);
            const r = impSheetToCells(X, wb, impState.sheet);
            impState.cells = r.cells;
          } else {
            const text = await f.text();
            if (/\.json$/i.test(f.name)) {
              const arr = JSON.parse(text);
              const list = Array.isArray(arr) ? arr : (arr.rows || arr.data || []);
              const head = Object.keys(list[0] || {});
              impState.cells = [head].concat(list.map(o => head.map(h => impS(o[h]))));
              impState.names = []; impState.sheet = '';
            } else {
              const r = impTextToCells(text);
              if (r.err) throw new Error(r.err);
              impState.cells = r.cells;
              impState.names = []; impState.sheet = '';
            }
          }
          impPreviewStores(root);
        } catch (err) {
          box.innerHTML = '<span class="bad">' + esc(err.message || String(err)) + '</span>';
        }
      });

      impPreviewStores(root);
    }
  });
}

/* ---------- 预览 ---------- */
function impPreviewStores(root) {
  const box = $('#impStorePrev', root);
  if (!box) return;
  const obj = impState.obj;

  if (!impState.cells) {
    box.innerHTML = obj === 'shops'
      ? '还没有读到内容。选一个文件，或切到「粘贴表格」把 Excel 里的表贴进来。<br>需要的列：<b>店铺名称</b>（必填）、平台、标签、负责人、绑定人、备注。'
      : '还没有读到内容。选一个文件，或切到「粘贴表格」。<br>需要的列：<b>店铺名称 + 登录账号</b>（必填）、角色、绑定人、尾号、使用人、岗位、状态。<br>也支持「店铺分组」式表格：一行只写店名做分组，下面的行在店铺列写账号名，会自动归到该店。密码列会被忽略。';
    return;
  }

  const map = obj === 'shops' ? SHOP_HEAD_MAP : ACCT_HEAD_MAP;
  const raw = impMapRows(impState.cells, map);

  let norm, modeNote = '', acctInfo = null;
  if (obj === 'accounts') {
    acctInfo = impParseAcctRows(impState.cells);
    if (acctInfo.rows.length) {
      norm = { rows: acctInfo.rows, skip: acctInfo.skip.concat(acctInfo.noShop.map(x => x.no)) };
      const bits = [];
      if (acctInfo.segs > 1) bits.push(`这张表里认出 <b>${acctInfo.segs}</b> 段表（每段自己的表头）`);
      if (acctInfo.groups) bits.push(`<b>${acctInfo.groups}</b> 个店铺分组`);
      const headCells = (impState.cells[0] || []).some(c => /密码|password|pwd/i.test(impS(c)))
        || (impState.cells[1] || []).some(c => /密码|password|pwd/i.test(impS(c)));
      if (headCells) bits.push('密码列已忽略（工作台不保存密码）');
      if (bits.length) modeNote = '识别结果：' + bits.join(' · ');
    }
  }
  if (!norm) {
    if (raw.err) { box.innerHTML = '<span class="bad">' + esc(raw.err) + '</span>'; return; }
    norm = obj === 'shops' ? impNormShops(raw.rows) : impNormAccts(raw.rows);
  }
  const rows = impDedupe(norm.rows, obj === 'shops' ? r => impKey(r.name) : r => impKey(r.shop) + '|' + impKey(r.login));

  if (!rows.length) {
    const why = acctInfo && acctInfo.noShop.length
      ? `认出了 ${acctInfo.noShop.length} 行账号，但看不出属于哪家店：${acctInfo.noShop.slice(0, 6).map(x => x.login).join('、')}… 在表里加一列「店铺」就能导。`
      : '没有可导入的行（必填列是空的）';
    box.innerHTML = '<span class="bad">' + esc(why) + '</span>';
    return;
  }

  const sheetLine = impState.names.length
    ? `工作表：<b>${esc(impState.sheet)}</b>${impState.names.length > 1 ? `（文件里还有 ${impState.names.filter(n => n !== impState.sheet).map(n => esc(n)).join('、')}）` : ''}<br>`
    : '';

  if (obj === 'shops') {
    const byName = {};
    store.list('shops').forEach(s => { byName[impKey(s.name)] = s; });
    let willNew = 0, willFill = 0, fillCells = 0;
    rows.forEach(r => {
      const hit = byName[impKey(r.name)];
      if (!hit) { willNew++; return; }
      let n = 0;
      ['platform', 'owner', 'binder', 'auth', 'opstat', 'third', 'note'].forEach(k => {
        if (impBlank(r[k])) return;
        if (impBlank(hit[k])) n++;
      });
      if (n) { willFill++; fillCells += n; }
    });
    impState.parsed = rows;

    const dup = norm.rows.length - rows.length;
    box.innerHTML = `${sheetLine}
      读到 <b>${norm.rows.length}</b> 行 · 去掉重复 <b>${dup}</b> 行<br>
      将新建 <b class="ok">${willNew}</b> 家店 · 补全已有店 <b>${willFill}</b> 家（共填 ${fillCells} 个空字段）
      ${willFill && !willNew ? ' · 已有字段不会被覆盖' : ''}
      ${norm.skip.length ? `<br><span class="bad">跳过 ${norm.skip.length} 行缺店铺名（第 ${norm.skip.slice(0, 6).join('、')} 行）</span>` : ''}
      ${impMiniTable(rows, obj)}`;
    return;
  }

  /* 账号 */
  const shopNames = {}; store.list('shops').forEach(s => { shopNames[impKey(s.name)] = true; });
  const acctKeys = {}; store.list('accounts').forEach(a => { acctKeys[impKey(a.shop) + '|' + impKey(a.login)] = a; });
  const newShops = {};
  let willNew = 0, willFill = 0, fillCells = 0;
  rows.forEach(r => {
    if (!shopNames[impKey(r.shop)]) newShops[r.shop] = true;
    const hit = acctKeys[impKey(r.shop) + '|' + impKey(r.login)];
    if (!hit) { willNew++; return; }
    let n = 0;
    ['role', 'binder', 'tail', 'owner', 'post', 'status', 'note'].forEach(k => {
      if (impBlank(r[k])) return;
      if (impBlank(hit[k])) n++;
    });
    if (n) { willFill++; fillCells += n; }
  });
  impState.parsed = rows;
  const nsList = Object.keys(newShops);
  const dup = norm.rows.length - rows.length;

  box.innerHTML = `${sheetLine}
    读到 <b>${norm.rows.length}</b> 条 · 去掉重复 <b>${dup}</b> 条<br>
    ${modeNote ? modeNote + '<br>' : ''}
    将新建账号 <b class="ok">${willNew}</b> 条 · 补全已有账号 <b>${willFill}</b> 条（共填 ${fillCells} 个空字段）
    ${nsList.length ? `<br>其中 <b>${nsList.length}</b> 家店库里还没有，会一并建档：<span class="dim">${nsList.slice(0, 4).map(esc).join('、')}${nsList.length > 4 ? ' 等' : ''}</span>` : ''}
    ${norm.skip.length ? `<br><span class="bad">跳过 ${norm.skip.length} 行：${acctInfo && acctInfo.skip.length ? `其中 ${acctInfo.skip.length} 行缺店铺名或登录账号；` : ''}${acctInfo && acctInfo.noShop.length ? `${acctInfo.noShop.length} 行看不出属于哪家店（${acctInfo.noShop.slice(0, 5).map(x => esc(x.login)).join('、')}${acctInfo.noShop.length > 5 ? ' 等' : ''}），加一列「店铺」就能导` : '缺店铺名或登录账号'}</span>` : ''}
    ${impMiniTable(rows, obj)}`;
}

function impMiniTable(rows, obj) {
  const head = obj === 'shops'
    ? ['店铺名称', '平台', '标签', '负责人', '备注']
    : ['店铺名称', '登录账号', '绑定人', '尾号', '状态'];
  const pick = obj === 'shops'
    ? r => [r.name, r.platform, r.tag, r.owner, r.note]
    : r => [r.shop, r.login, r.binder, r.tail, r.status];
  const body = rows.slice(0, 5).map(r => '<tr>' + pick(r).map(c => `<td>${esc(c || '—')}</td>`).join('') + '</tr>').join('');
  return `<div class="imp-tbl-note">下面是文件里的值。已存在的记录只补空字段，不会覆盖库里已有内容。</div>
    <div class="imp-tbl-wrap"><table class="imp-tbl">
      <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table>
      ${rows.length > 5 ? `<div class="dim" style="margin-top:4px">只预览前 5 条，实际导入 ${rows.length} 条</div>` : ''}
    </div>`;
}

/* ---------- 执行 ---------- */
function doStoreImport(close) {
  if (!canEdit()) { denyWrite(); return; }
  const rows = impState.parsed;
  if (!rows || !rows.length) { toast('还没有可导入的内容', 'bad'); return; }

  const obj = impState.obj;
  const now = Date.now();
  let created = 0, filled = 0, fillCells = 0, autoShops = 0;

  if (obj === 'shops') {
    const byName = {};
    store.db.shops.forEach(s => { byName[impKey(s.name)] = s; });
    let maxOrder = 0;
    store.db.shops.forEach(s => { const n = Number(s.order) || 0; if (n > maxOrder) maxOrder = n; });

    rows.forEach(r => {
      const hit = byName[impKey(r.name)];
      if (hit) {
        const n = impFillEmpty(hit, r, ['name', 'order']);
        if (n) { filled++; fillCells += n; hit.__mt = now; }
        return;
      }
      const rec = Object.assign({}, r, {
        id: uid('s'),
        order: r.order === '' ? (++maxOrder) : r.order,
        __mt: now, __src: 'ui'
      });
      store.db.shops.push(rec);
      byName[impKey(r.name)] = rec;
      created++;
    });
  } else {
    const byAcct = {};
    store.db.accounts.forEach(a => { byAcct[impKey(a.shop) + '|' + impKey(a.login)] = a; });
    const byShop = {};
    store.db.shops.forEach(s => { byShop[impKey(s.name)] = s; });
    let maxOrder = 0;
    store.db.shops.forEach(s => { const n = Number(s.order) || 0; if (n > maxOrder) maxOrder = n; });

    rows.forEach(r => {
      if (!byShop[impKey(r.shop)]) {
        const shopRec = {
          id: uid('s'), name: r.shop, platform: impS(r.plat) || '未分类', tag: '常规',
          owner: impS(r.shopowner), binder: '',
          order: ++maxOrder, auth: '', opstat: '运营中', third: '',
          note: '由账号导入自动建档，待补全', __mt: now, __src: 'ui'
        };
        store.db.shops.push(shopRec);
        byShop[impKey(r.shop)] = shopRec;
        autoShops++;
      } else if (impS(r.shopowner) && impBlank(byShop[impKey(r.shop)].owner)) {
        byShop[impKey(r.shop)].owner = impS(r.shopowner);   // 表里带店铺负责人就直接补上
        byShop[impKey(r.shop)].__mt = now;
      }
      const key = impKey(r.shop) + '|' + impKey(r.login);
      const hit = byAcct[key];
      if (hit) {
        const n = impFillEmpty(hit, r, ['shop', 'login']);
        if (n) { filled++; fillCells += n; hit.__mt = now; }
        return;
      }
      const rec = Object.assign({}, r, { id: uid('ac'), __mt: now, __src: 'ui' });
      store.db.accounts.push(rec);
      byAcct[key] = rec;
      created++;
    });
  }

  if (store.db.meta && store.db.meta.seed) store.db.meta = { seed: false, ver: DB_VER };
  store.save();

  const parts = [];
  if (obj === 'shops') {
    parts.push('新建店铺 ' + created);
    if (filled) parts.push('补全 ' + filled + ' 家（' + fillCells + ' 个字段）');
  } else {
    parts.push('新建账号 ' + created);
    if (filled) parts.push('补全 ' + filled + ' 条（' + fillCells + ' 个字段）');
    if (autoShops) parts.push('自动建档 ' + autoShops + ' 家店');
  }
  close();
  toast('导入完成：' + (parts.length ? parts.join(' · ') : '没有新增内容'), created || filled ? 'ok' : 'bad');
  render();
}
