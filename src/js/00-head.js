(function () {
"use strict";

/* =========================================================
   工作台 · 信号带 v2
   数据层：团队云端（Postgres），配置与业务数据全部共享同步
   指标不落死值，全部由「店铺 × 日期」的记录实时聚合
   ========================================================= */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
const num = v => { const n = parseFloat(String(v).replace(/[%,，\s]/g, '')); return isNaN(n) ? null : n; };
const f1 = v => (v == null || v === '') ? '—' : (Math.round(v * 10) / 10).toFixed(1);
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayBefore = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => { const v = a.filter(x => x != null); return v.length ? sum(v) / v.length : null; };
