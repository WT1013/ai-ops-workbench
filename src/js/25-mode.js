/* =========================================================
   访问权限：只有一种身份 —— 登录的组内成员，都能改
   - 取消原来的「成员编辑 / 只读预览」双模式与编辑码
   - 谁能打开：能登录的人；登录后增删改一律放行
   - 数据只有一份：团队云端库，谁改所有人看到（同步在 22-auth.js）
   ========================================================= */

/* 保留同名接口，老的调用点、自定义脚本、测试都不用改 */
function canEdit() { return true; }

/* 清掉历史版本可能留在 body 上的只读标记与徽标 */
function applyMode() {
  document.body.classList.remove('ro');
  const pill = document.getElementById('modePill');
  if (pill) pill.remove();
  const tip = document.getElementById('roTip');
  if (tip) tip.remove();
}

function setEditMode() { applyMode(); }
function initMode() { applyMode(); }

/* 编辑码入口已下线，留空实现避免旧代码报错 */
async function tryUnlock() { return true; }
