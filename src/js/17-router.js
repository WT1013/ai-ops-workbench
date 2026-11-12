/* ---------- 路由 ---------- */
const PAGES = [
  { id: 'signal', ix: '01', name: '首页 · 信号带', short: '信号', grp: '每天看' },
  { id: 'board', ix: '02', name: '数据看板', short: '看板', grp: '每天看' },
  { id: 'stores', ix: '03', name: '店铺库', short: '店铺', grp: '要办事' },
  { id: 'tasks', ix: '05', name: '协同与任务', short: '任务', grp: '要办事' },
  { id: 'assets', ix: '04', name: '资产库', short: '资产', grp: '要办事' },
  { id: 'qc', ix: '06', name: '质检风控设置', short: '风控', grp: '配置区' },
  { id: 'api', ix: '07', name: 'AI 接口', short: '接口', grp: '配置区' }
];
const RENDER = { signal: renderSignal, board: renderBoard, stores: renderStores, assets: renderAssets, tasks: renderTasks, qc: renderQc, api: renderApi };
