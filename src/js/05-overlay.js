/* ---------- toast / modal ---------- */
function toast(msg, kind) {
  const root = $('#toast-root');
  if (!root) return;
  while (root.children.length >= 3) root.removeChild(root.firstChild);
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => {
    t.classList.remove('on');
    setTimeout(() => t.remove(), 220);
  }, 2200);
}

let modalOnClose = null;
function openModal(cfg) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="moverlay">
      <div class="modal-box ${cfg.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-hd">
          <h3>${esc(cfg.title)}</h3>
          <button class="x" data-close aria-label="关闭">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
        <div class="modal-bd">${cfg.body || ''}</div>
        <div class="modal-ft">
          ${cfg.hint ? `<span class="hint">${cfg.hint}</span>` : ''}
          ${(cfg.buttons || []).map((b, i) => `<button class="btn ${b.cls || ''}" data-mb="${i}">${esc(b.label)}</button>`).join('')}
        </div>
      </div>
    </div>`;
  const ov = $('#moverlay');
  requestAnimationFrame(() => ov.classList.add('on'));
  const close = () => {
    ov.classList.remove('on');
    setTimeout(() => { root.innerHTML = ''; if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); } }, 150);
  };
  window.__closeModal = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
  $$('[data-mb]', ov).forEach(b => b.addEventListener('click', () => {
    const spec = cfg.buttons[+b.dataset.mb];
    if (spec.fn) spec.fn(close, root); else close();
  }));
  document.addEventListener('keydown', function esc1(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc1); }
  });
  if (cfg.onMount) cfg.onMount(root, close);
  return { root, close };
}

function confirmDialog(title, text, onOk, okLabel) {
  openModal({
    title,
    body: `<div style="font-size:12.5px;line-height:1.8;color:var(--ink2)">${text}</div>`,
    buttons: [
      { label: '取消', cls: 'ghost' },
      { label: okLabel || '确认删除', cls: 'danger', fn: (close) => { close(); onOk(); } }
    ]
  });
}

/* =========================================================
