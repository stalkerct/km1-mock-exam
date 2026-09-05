const fs = require('fs');

// ---------- 工具 ----------
const norm = (s) => (s || '').replace(/[\s、，。．,.？?：:；;！!（）()《》\"'']/g, '');

// ---------- 载入 shiroha 题库（新，规则较新） ----------
const shiroha = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/c1-full.json', 'utf8')).questions;

// ---------- 载入旧题库解析结果 ----------
const old = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/km1-parsed.json', 'utf8'));

// ---------- 分类关键词（顺序敏感：具体在前） ----------
const rules = [
  ['高速公路', /高速公路|匝道|加速车道|减速车道|服务区|收费站|ETC/],
  ['交通标线', /标线|虚实线|网状线|导流线|黄色虚实线|菱形/],
  ['交通标志', /标志/],
  ['交通信号', /信号灯|红灯|绿灯|黄灯|交通警察的指挥|手势信号/],
  ['灯光使用', /灯光|远光灯|近光灯|雾灯|转向灯|危险报警闪光灯|示廓灯|后位灯|前照灯|示宽灯/],
  ['停车规定', /停车|停放|禁停|泊车/],
  ['超车变道', /超车|变更车道|变道|掉头/],
  ['会车规则', /会车/],
  ['让行规则', /让行|让路|先行|避让|礼让|优先通行/],
  ['事故处理', /事故|肇事|追尾|碰撞|逃逸|现场/],
  ['应急处置', /故障|爆胎|熄火|制动失效|侧滑|轮胎漏气|车辆起火|落水/],
  ['车辆装载', /载货|载物|超载|装载|牵引|核载|载客/],
  ['车辆证件', /号牌|行驶证|登记证|保险|检验合格标志|交强险|年检/],
  ['车辆检查', /检查|安全技术性能|安全隐患|上车前|出车前/],
  ['驾驶证与资格', /驾驶证|准驾|实习期|申领|换证|补证|记分|审验|满分|身体条件|驾考|学习驾驶/],
  ['法律责任', /罚款|拘留|吊销|扣留|注销|刑事责任|判.{0,4}徒刑|拘役|管制|刑罚|违法.{0,6}处理/],
  ['安全文明', /安全带|饮酒|醉酒|吸毒|毒品|疲劳驾驶|手持电话|接打手机|吸烟|穿拖鞋/],
  ['速度规定', /时速|速度不能超过|最高速度|最低速度|车速|公里\/小时|公里每小时|限速|能见度/],
];
function classify(q) {
  const t = q.question + (q.options ? Object.values(q.options).join('') : '');
  for (const [cat, re] of rules) if (re.test(t)) return cat;
  return '安全驾驶';
}

// ---------- 旧题库敏感法规过滤（2022新规易过时项，保守排除） ----------
const volatileRe = /记\s*\d+\s*分|一次记|记几分|累积记分|记分周期|记分达到|满分|审验|身体条件证明|提交.{0,6}证明/;
// 年龄类：60/70周岁规则变化
const ageRe = /60周岁|70周岁|年龄在\d+周岁|年龄的/;

// ---------- 归一化 shiroha ----------
const bank = [];
const seen = new Set();
const dupWithShiroha = [];
for (const q of shiroha) {
  if (q.type === 'multiple') continue; // 考试不用多选
  const opts = {};
  for (const o of q.options) opts[o.key] = o.text;
  const answerKey = q.answerKeys[0];
  const key = norm(q.question);
  seen.add(key);
  bank.push({
    id: 'S' + q.id,
    type: q.type,
    question: q.question,
    options: opts,
    answer: answerKey,
    analysis: q.analysis || '',
    category: q.category || q.topic,
    source: 'shiroha'
  });
}
console.log('shiroha 收录(判断+单选):', bank.length);

// ---------- 归一化 old ----------
let stat = { img: 0, dup: 0, volatile: 0, added: 0, malformed: 0 };
const oldSeen = new Set();
for (const q of old) {
  if (q.hasImage) { stat.img++; continue; }
  if (!q.question || q.question.length < 8) { stat.malformed++; continue; }
  // 单选必须有4个选项且非空
  if (q.type === 'single') {
    const keys = Object.keys(q.options || {});
    if (keys.length < 4 || keys.some(k => !q.options[k] || q.options[k].length === 0)) { stat.malformed++; continue; }
  }
  const key = norm(q.question);
  if (seen.has(key) || oldSeen.has(key)) { stat.dup++; continue; }
  if (volatileRe.test(q.question) || ageRe.test(q.question)) { stat.volatile++; continue; }
  oldSeen.add(key);

  let entry;
  if (q.type === 'judge') {
    entry = {
      id: 'K' + String(q.num).padStart(4, '0'),
      type: 'judge',
      question: q.question,
      options: { A: '正确', B: '错误' },
      answer: q.answer === '对' ? 'A' : 'B',
      analysis: '',
      category: classify(q),
      source: 'jiaxiao-baodian'
    };
  } else {
    entry = {
      id: 'K' + String(q.num).padStart(4, '0'),
      type: 'single',
      question: q.question,
      options: q.options,
      answer: q.answer,
      analysis: '',
      category: classify(q),
      source: 'jiaxiao-baodian'
    };
  }
  bank.push(entry);
  stat.added++;
}
console.log('旧库统计:', JSON.stringify(stat));
console.log('合并后总数:', bank.length);

// ---------- 最终统计 ----------
const typeCount = {}, catCount = {};
for (const q of bank) {
  typeCount[q.type] = (typeCount[q.type] || 0) + 1;
  catCount[q.category] = (catCount[q.category] || 0) + 1;
}
console.log('题型:', JSON.stringify(typeCount));
console.log('分类:', JSON.stringify(catCount, null, 1));

fs.writeFileSync('D:/allprograms/科目一模拟/research/bank-merged.json', JSON.stringify(bank), 'utf8');
console.log('已保存 bank-merged.json');
