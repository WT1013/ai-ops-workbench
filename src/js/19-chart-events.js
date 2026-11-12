/* ---------- 图表交互 ---------- */
function bindChart() {
  const wrap = $('#chartWrap'); if (!wrap) return;
  const svg = wrap.querySelector('svg.chart'); if (!svg) return;
  const tip = $('#tip'), cross = svg.querySelector('#cross');
  if (!tip || !cross) return;
  const iw = C.w - C.pl - C.pr;
  const show = (i, px, py) => {
    const d = chartData[i]; if (!d) return;
    const cx = C.pl + (chartData.length === 1 ? iw / 2 : (iw / (chartData.length - 1)) * i);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', '1');
    tip.innerHTML = `<div class="hd">${esc(d.date)}</div>
      <div class="row"><em>采纳率</em><span style="color:var(--amber)">${f1(d.adopt)}%</span></div>
      <div class="row"><em>生成率</em><span style="color:var(--info)">${f1(d.gen)}%</span></div>
      <div class="row"><em>样本店</em><span>${d._n || 0}</span></div>`;
    const rect = svg.getBoundingClientRect();
    const left = (cx / C.w) * rect.width - wrap.scrollLeft;
    tip.style.left = Math.min(Math.max(left, 80), rect.width - 80) + 'px';
    const flip = py != null && py < 74;
    tip.style.top = (flip ? py + 14 : (py != null ? py - 12 : rect.height * 0.5)) + 'px';
    tip.style.transform = flip ? 'translate(-50%,0)' : 'translate(-50%,-100%)';
    tip.classList.add('on');
  };
  $$('.hv', svg).forEach(r => {
    const at = e => {
      const rect = svg.getBoundingClientRect();
      show(+r.dataset.i, e.clientX - rect.left, e.clientY - rect.top);
    };
    r.addEventListener('mouseenter', at);
    r.addEventListener('mousemove', at);
  });
  svg.addEventListener('mouseleave', () => {
    cross.setAttribute('opacity', '0');
    tip.classList.remove('on');
  });

  const ro = $('#readout');
  if (ro && chartData.length) {
    const first = chartData[0], last = chartData[chartData.length - 1];
    const dif = (last.adopt != null && first.adopt != null) ? (last.adopt - first.adopt) : null;
    ro.innerHTML = `区间内采纳率从 <b>${f1(first.adopt)}%</b> 到 <b>${f1(last.adopt)}%</b>${dif == null ? '' : `，净变化 <b>${dif > 0 ? '+' : ''}${f1(dif)} pt</b>`}；
      同期生成率 <b>${f1(first.gen)}%</b> → <b>${f1(last.gen)}%</b>。
      共 <b>${chartData.length}</b> 个数据日，最新一日 <b>${last._n || 0}</b> 家店有记录。`;
  }
}

function bindStores() {
  const tabs = $('#storeTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    window.__storeFilter = b.dataset.f; render();
  });
  const q = $('#storeSearch');
  if (q) {
    q.addEventListener('input', () => {
      window.__storeQ = q.value;
      clearTimeout(window.__qTimer);
      window.__qTimer = setTimeout(render, 220);
    });
  }
}
