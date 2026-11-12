/**
 * 提交前自检：语法、禁用词、体积
 *   node scripts/check.cjs
 * 退出码非 0 表示不能提交。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 与 build.cjs 保持一致的清单（顺序无关，只做汇总） */
const jsFiles = fs.readdirSync(path.join(ROOT, 'src/js')).filter(f => f.endsWith('.js')).sort();
const cssFiles = fs.readdirSync(path.join(ROOT, 'src/styles')).filter(f => f.endsWith('.css')).sort();

let bad = 0;
const fail = m => { console.log('  ✗ ' + m); bad++; };

/* 1) JS 整体语法（模块是拼接后才完整的，单独文件必然不闭合，所以整体校验） */
const js = jsFiles.map(f => read('src/js/' + f)).join('\n');
try { new vm.Script(js, { filename: 'bundle.js' }); console.log('  ✓ JS 语法通过'); }
catch (e) { fail('JS 语法错误：' + e.message); }

/* 2) CSS 花括号平衡 */
const css = cssFiles.map(f => read('src/styles/' + f)).join('\n');
const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
if (open === close) console.log('  ✓ CSS 括号平衡（' + open + ' 组）');
else fail('CSS 括号不平衡：{ ' + open + ' 个 / } ' + close + ' 个');

/* 3) 禁用内容 */
const BAN_WORD = ['yongheng123', 'xianma123', '123yongheng'];
const BAN_CODE = ['data-pwd', 'openVault', 'vaultPersist', '__parseXlsxRows'];
BAN_WORD.forEach(w => { if (js.indexOf(w) >= 0 || css.indexOf(w) >= 0) fail('出现明文密码字面量：' + w); });
BAN_CODE.forEach(w => { if (js.indexOf(w) >= 0) fail('出现已下线的保险箱代码：' + w); });

/* 4) 体积表 */
const row = f => {
  const s = read('src/js/' + f);
  return f + '  ' + (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB  ' + s.split('\n').length + ' 行';
};
console.log('\n模块体积：');
jsFiles.forEach(f => console.log('  ' + row(f)));
console.log('  ── JS 合计 ' + (Buffer.byteLength(js) / 1024).toFixed(1) + ' KB');
console.log('  ── CSS 合计 ' + (Buffer.byteLength(css) / 1024).toFixed(1) + ' KB');

console.log(bad ? '\n自检失败：' + bad + ' 项' : '\n自检通过');
process.exit(bad ? 1 : 0);
