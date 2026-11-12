/**
 * 导出业务数据为 CSV（团队共享数据源）
 *
 * 用法：node scripts/export-data.cjs [--force]
 *
 * 规则：
 * - data/*.csv 一旦存在就【不覆盖】，除非加 --force。
 *   因为 CSV 已经是团队的工作数据源，覆盖等于把别人的改动冲掉。
 * - 首次从 src/js/02-seed.js 的种子数据导出，作为基线。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const KINDS = ['shops', 'accounts', 'metrics', 'alerts', 'tasks', 'qc', 'assets', 'apis'];

/* 每种数据的列顺序（也是 CSV 的表头） */
const COLS = {
  shops: ['id', 'name', 'platform', 'tag', 'owner', 'binder', 'order', 'auth', 'opstat', 'third', 'note'],
  accounts: ['id', 'shop', 'role', 'login', 'binder', 'tail', 'owner', 'post', 'status', 'note'],
  metrics: ['id', 'shop', 'date', 'adopt', 'gen', 'conv', 'risk', 'agent', 'resp', 'note'],
  alerts: ['id', 'type', 'level', 'shop', 'desc', 'due', 'status', 'note'],
  tasks: ['id', 'title', 'owner', 'prio', 'status', 'due', 'type', 'note'],
  qc: ['id', 'name', 'type', 'shop', 'threshold', 'level', 'hits', 'status', 'note'],
  assets: ['id', 'name', 'type', 'cat', 'shop', 'url', 'owner', 'status', 'date', 'note'],
  apis: ['id', 'name', 'type', 'shop', 'endpoint', 'status', 'calls', 'errors', 'owner', 'note']
};

/* ---- 在 vm 里跑种子模块，拿到 buildSeed() ---- */
function loadSeed() {
  const files = ['src/js/01-metrics.js', 'src/js/02-seed.js'];
  const code = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const sandbox = {
    console,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    JSON,
    /* 00-head.js 里的工具函数，种子模块会用到 */
    tail4: v => String(v == null ? '' : v).replace(/\D/g, '').slice(-4),
    todayStr: () => new Date().toISOString().slice(0, 10),
    dayBefore: n => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  };
  vm.createContext(sandbox);
  /* 02-seed.js 末尾留了半个注释块（原本由下一个模块续写），这里补上收尾 */
  vm.runInContext(code + '\n*/\n;globalThis.__seed = buildSeed();', sandbox, { timeout: 10000 });
  return sandbox.__seed;
}

function cell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows, cols) {
  const head = cols.join(',');
  const body = rows.map(r => cols.map(c => cell(r[c])).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

const force = process.argv.indexOf('--force') >= 0;
fs.mkdirSync(DATA_DIR, { recursive: true });

const seed = loadSeed();
let created = 0, kept = 0;
KINDS.forEach(k => {
  const file = path.join(DATA_DIR, k + '.csv');
  if (fs.existsSync(file) && !force) { kept++; return; }
  fs.writeFileSync(file, toCsv(seed[k] || [], COLS[k]), 'utf8');
  created++;
  console.log('  write', 'data/' + k + '.csv', (seed[k] || []).length, 'rows');
});

console.log('CSV 导出完成：新建 ' + created + ' 个，已存在跳过 ' + kept + ' 个');
if (kept) console.log('（要按种子数据重建请加 --force，会覆盖团队现有 CSV）');
