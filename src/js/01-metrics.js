/* ---------- 指标定义（唯一权威） ---------- */
const METRICS = [
  { k: 'adopt', l: '采纳率',   short: '采纳', hi: true,  tgt: 'adopt' },
  { k: 'gen',   l: '生成率',   short: '生成', hi: true,  tgt: 'gen' },
  { k: 'conv',  l: '转化率',   short: '转化', hi: true,  tgt: 'conv' },
  { k: 'risk',  l: '风控率',   short: '风控', hi: false, tgt: null },
  { k: 'agent', l: '纯智占比', short: '纯智', hi: true,  tgt: null },
  { k: 'resp',  l: '回复率',   short: '回复', hi: true,  tgt: 'resp' }
];
const M_KEYS = METRICS.map(m => m.k);

/* 中文表头 → 内部字段（导入用） */
const HEAD_MAP = {
  '店铺': 'shop', '店铺名称': 'shop', 'shop': 'shop',
  '日期': 'date', 'date': 'date',
  '采纳率': 'adopt', '采纳率%': 'adopt', 'adopt': 'adopt',
  '生成率': 'gen', '生成率%': 'gen', 'gen': 'gen',
  '转化率': 'conv', '转化率%': 'conv', 'conv': 'conv',
  '风控率': 'risk', '风控率%': 'risk', 'risk': 'risk',
  '纯智占比': 'agent', '纯智能体占比': 'agent', '纯智占比%': 'agent', 'agent': 'agent',
  '回复率': 'resp', '应答率': 'resp', 'resp': 'resp',
  '备注': 'note', 'note': 'note'
};
