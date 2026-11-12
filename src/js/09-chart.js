/* ---------- 图表 ---------- */
const C = { w: 760, h: 242, pl: 38, pr: 60, pt: 18, pb: 30 };
let chartData = [];

function buildChart(series) {
  if (!series.length) return `<div class="empty-block" style="margin:4px 0"><b>还没有指标数据</b>点右上「导入指标」粘贴 OMS 导出的表格，或手动录入一条</div>`;
  const vals = [];
  series.forEach(s => { [s.adopt, s.gen].forEach(v => { if (v != null) vals.push(v); }); });
  const T = store.cfg.targets;
  const tvals = vals.concat([T.adopt, T.gen]);
  let lo = Math.floor((Math.min.apply(null, tvals) - 2) / 4) * 4;
  let hi = Math.ceil((Math.max.apply(null, tvals) + 2) / 4) * 4;
  if (hi - lo < 8) hi = lo + 8;

  const iw = C.w - C.pl - C.pr, ih = C.h - C.pt - C.pb;
  const x = i => C.pl + (series.length === 1 ? iw / 2 : (iw / (series.length - 1)) * i);
  const y = v => C.pt + ih - ((v - lo) / (hi - lo)) * ih;

  const path = arr => arr.map((v, i) => v == null ? '' : `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).filter(Boolean).join(' ');

  let gl = '';
  let step = (hi - lo) / 6;
  step = [1, 2, 2.5, 5, 10, 20].find(s => s >= step - 0.001) || 20;
  for (let v = lo; v <= hi + 0.001; v += step) {
    if (Math.abs(v - Math.round(v)) > 0.001) continue;
    gl += `<line class="gl${v === lo ? ' zero' : ''}" x1="${C.pl}" y1="${y(v)}" x2="${C.w - C.pr}" y2="${y(v)}"/>
      <text x="${C.pl - 8}" y="${y(v) + 3.5}" text-anchor="end">${Math.round(v)}</text>`;
  }
  const skip = Math.ceil(series.length / 7);
  let xl = '';
  series.forEach((s, i) => {
    if (i % skip === 0 || i === series.length - 1) {
      xl += `<text x="${x(i)}" y="${C.h - 8}" text-anchor="middle">${esc(s.date.slice(5))}</text>`;
    }
  });

  const adopt = series.map(s => s.adopt), gen = series.map(s => s.gen);
  const lastI = series.length - 1;
  const dots = (arr, color) => arr.map((v, i) => v == null ? '' : `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="${series.length > 20 ? 1.6 : 2.2}" fill="${color}"/>`).join('');

  const tl = (v) => `<line class="target" x1="${C.pl}" y1="${y(v)}" x2="${C.w - C.pr}" y2="${y(v)}"/>`;

  const hover = series.map((s, i) => {
    const w = series.length > 1 ? iw / (series.length - 1) : iw;
    return `<rect class="hv" data-i="${i}" x="${x(i) - w / 2}" y="${C.pt}" width="${w}" height="${ih}" fill="transparent"/>`;
  }).join('');

  chartData = series;

  return `<svg class="chart" viewBox="0 0 ${C.w} ${C.h}" role="img" aria-label="采纳率与生成率趋势">
    <g class="axis">${gl}${xl}</g>
    ${isIn(T.gen, lo, hi) ? tl(T.gen) : ''}
    ${isIn(T.adopt, lo, hi) ? tl(T.adopt) : ''}
    <path class="line-b" d="${path(gen)}"/>
    <path class="line-a" d="${path(adopt)}"/>
    ${dots(gen, 'var(--info)')}
    ${dots(adopt, 'var(--amber)')}
    ${adopt[lastI] != null ? `<text class="endlabel" x="${C.w - C.pr + 6}" y="${y(adopt[lastI]) - 6}" fill="var(--amber)">${f1(adopt[lastI])}%</text>` : ''}
    ${gen[lastI] != null ? `<text class="endlabel" x="${C.w - C.pr + 6}" y="${y(gen[lastI]) + 12}" fill="var(--info)">${f1(gen[lastI])}%</text>` : ''}
    <line id="cross" x1="0" y1="${C.pt}" x2="0" y2="${C.pt + ih}" stroke="var(--ink3)" stroke-width="1" stroke-dasharray="2 3" opacity="0"/>
    <g id="hits">${hover}</g>
  </svg>`;
}
const isIn = (v, lo, hi) => v >= lo && v <= hi;
