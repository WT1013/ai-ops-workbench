/* =========================================================
   访问模式：只读预览 / 成员编辑
   - 任何人拿到链接，默认【只读预览】：能看所有页面与数据，不能改
   - 项目成员输入团队编辑码后进入编辑模式，改动写进团队云端
   - 编辑状态只记在本机浏览器，换人换设备要重新输码
   - 说明：这是前端软闸（挡的是链接外传后随手乱改的人）。
     要做「后端强制隔离」，需要开 Supabase Auth 并按用户写 RLS，
     步骤见 MIGRATION.md 第 4 节「硬隔离（可选）」。
   ========================================================= */

const LS_EDIT = 'wb.signal.v3.edit';
const MODE = { unlocked: false, verified: false };

function editSha() {
  const c = window.__OPS_CFG__ || {};
  return String(c.editSha || '').toLowerCase();
}
function editHint() {
  const c = window.__OPS_CFG__ || {};
  return String(c.editHint || '团队编辑码向项目管理员索取');
}
function canEdit() { return !!MODE.unlocked; }

function readEditFlag() {
  try { return localStorage.getItem(LS_EDIT) === '1'; } catch (e) { return false; }
}
function writeEditFlag(on) {
  try {
    if (on) localStorage.setItem(LS_EDIT, '1'); else localStorage.removeItem(LS_EDIT);
  } catch (e) {}
}

async function sha256Hex(s) {
  if (!(window.crypto && window.crypto.subtle)) {
    throw new Error('当前页面不是 https / localhost，浏览器不允许校验编辑码');
  }
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function normCode(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

/* 把「只读」这件事落到界面上：隐藏写入口、改光标、禁用设置页输入 */
function applyMode() {
  const ro = !canEdit();
  document.body.classList.toggle('ro', ro);
  const pill = document.getElementById('modePill');
  if (pill) {
    pill.textContent = ro ? '只读预览' : '成员编辑';
    pill.classList.toggle('on', !ro);
    pill.title = ro
      ? '当前是只读预览：可以看全部数据，不能修改。项目成员点这里输入编辑码。'
      : '当前是成员编辑模式：你的改动会写入团队云端。点这里退回只读。';
  }
  const tip = document.getElementById('roTip');
  if (tip) tip.style.display = ro ? '' : 'none';
}

function setEditMode(on, quiet) {
  MODE.unlocked = !!on;
  writeEditFlag(!!on);
  applyMode();
  if (!quiet) toast(on ? '已进入成员编辑模式' : '已切回只读预览', on ? 'ok' : '');
  render();
}

/* 输码解锁 */
function askEditCode() {
  const hint = editHint();
  openModal({
    title: '进入成员编辑模式',
    body: `<div style="font-size:12.5px;line-height:1.85;color:var(--ink2);margin-bottom:10px">
        这是团队内部工作台，外部链接默认<b>只读预览</b>。<br>输入团队编辑码后，你就能改数据、改页面、改设置，改动会写进团队云端，所有人都看得到。
      </div>
      <input id="ecInp" type="password" autocomplete="off" placeholder="团队编辑码"
        style="width:100%;height:34px;padding:0 10px;border:1px solid var(--line2);border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;outline:none;font-family:var(--mono)" />
      <div style="font-size:11.5px;color:var(--ink3);margin-top:9px;line-height:1.7">${esc(hint)}</div>`,
    buttons: [
      { label: '只读就行', cls: 'ghost' },
      { label: '解锁', cls: 'primary', fn: c => {
        const v = ($('#ecInp') || {}).value;
        tryUnlock(v).then(ok => {
          if (ok) { c(); setEditMode(true); }
        });
      } }
    ]
  });
  setTimeout(() => { const i = $('#ecInp'); if (i) i.focus(); }, 160);
}

async function tryUnlock(code) {
  const v = normCode(code);
  if (!v) { toast('请先输入编辑码', 'bad'); return false; }
  let h = '';
  try { h = await sha256Hex(v); }
  catch (e) { toast(e.message, 'bad'); return false; }
  if (h !== editSha()) {
    toast('编辑码不对，或你只有查看权限', 'bad');
    return false;
  }
  return true;
}

/* 首次进来：恢复本机记住的编辑状态（只认本机开关，不认链接参数）
   支持 ?edit=1 只是给管理员收藏用的快捷入口，仍需输码 */
function initMode() {
  MODE.unlocked = readEditFlag();
  applyMode();
  if (window.__modeInit) return;
  window.__modeInit = 1;
  const pill = document.getElementById('modePill');
  if (pill) {
    pill.addEventListener('click', () => {
      if (canEdit()) {
        confirmDialog('退回只读预览', '退出编辑模式后，这个人在这台设备上就只能看、不能改。随时可以再输码进来。', () => setEditMode(false), '退回只读');
      } else {
        askEditCode();
      }
    });
  }
}
