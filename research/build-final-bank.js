const fs = require('fs');
const path = require('path');

const norm = s => (s || '').replace(/[\s、，。．,.？?：:；;！!（）()《》\"''\[\]"]/g, '');

// ---------- 来源1: shiroha（规则较新，优先） ----------
const shiroha = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/c1-full.json', 'utf8')).questions;

// ---------- 来源2: 全量流解析（含图片） ----------
const stream = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/km1-stream-parsed.json', 'utf8'));

// ---------- 图片 -> data URI ----------
const IMG_DIR = 'D:/allprograms/科目一模拟/research/img-compressed';
function dataUri(mediaFile) {
  const base = path.basename(mediaFile).replace(/\.(png|jpeg|jpg)$/i, '');
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(IMG_DIR, base + ext);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return 'data:' + mime + ';base64,' + buf.toString('base64');
    }
  }
  return null;
}

// ---------- 分类关键词（与之前一致） ----------
const rules = [
  ['高速公路', /高速公路|匝道|加速车道|减速车道|服务区|收费站|ETC/],
  ['交通标线', /标线|虚实线|网状线|导流线|黄色虚实线|菱形/],
  ['交通标志', /标志/],
  ['交通信号', /信号灯|红灯|绿灯|黄灯|交通警察的指挥|手势信号/],
  ['灯光使用', /灯光|远光灯|近光灯|雾灯|转向灯|危险报警闪光灯|示廓灯|后位灯|前照灯|示宽灯|仪表板/],
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

// ---------- 敏感法规过滤（旧库） ----------
const volatileRe = /记\s*\d+\s*分|一次记|记几分|累积记分|记分周期|记分达到|满分|审验|身体条件证明|提交.{0,6}证明/;
const ageRe = /60周岁|70周岁|年龄在\d+周岁|年龄的/;

// ---------- 组装 ----------
const bank = [];
const seen = new Set();
// 去重键：文字题 = 题干+选项；图片题 = 题干+首图（同题干不同图是不同的题）
function push(q, firstImg) {
  const stem = norm(q.question);
  const opts = norm(Object.values(q.options || {}).join('|'));
  const key = firstImg ? (stem + '#' + firstImg) : (stem + '@' + opts);
  if (seen.has(key) || !stem || stem.length < 6) return false;
  seen.add(key);
  bank.push(q);
  return true;
}

// shiroha 优先
let sCount = 0;
for (const q of shiroha) {
  if (q.type === 'multiple') continue;
  const opts = {};
  for (const o of q.options) opts[o.key] = o.text;
  if (push({
    id: 'S' + q.id, type: q.type, question: q.question, options: opts,
    answer: q.answerKeys[0], analysis: q.analysis || '',
    category: q.category || q.topic, images: []
  }, null)) sCount++;
}
console.log('shiroha 收录:', sCount);

// 流解析题（文字题 + 图片题）
const stat = { textAdded: 0, imgAdded: 0, dup: 0, volatile: 0, noImgFile: 0, malformed: 0 };
for (const q of stream) {
  if (q.question.length < 8) { stat.malformed++; continue; }
  if (q.type === 'single') {
    const keys = Object.keys(q.options || {});
    if (keys.length < 4 || keys.some(k => !q.options[k])) { stat.malformed++; continue; }
  }
  // 敏感法规过滤
  const vol = volatileRe.test(q.question) || ageRe.test(q.question) ||
    (q.options && Object.values(q.options).some(v => volatileRe.test(v)));
  if (vol) { stat.volatile++; continue; }

  const key = norm(q.question);
  if (q.images.length === 0 && seen.has(key + '@' + norm(Object.values(q.options || {}).join('|')))) { stat.dup++; continue; }

  // 图片处理
  let images = [];
  if (q.images.length) {
    const uris = q.images.map(dataUri).filter(Boolean);
    if (!uris.length) { stat.noImgFile++; continue; } // 有图题但文件缺失 → 弃
    images = uris;
  }

  const entry = {
    id: 'K' + String(q.num).padStart(4, '0'),
    type: q.type,
    question: q.question,
    options: q.type === 'judge' ? { A: '正确', B: '错误' } : q.options,
    answer: q.answer,
    analysis: '',
    category: classify(q),
    images
  };
  if (push(entry, q.images.length ? q.images[0] : null)) { images.length ? stat.imgAdded++ : stat.textAdded++; }
  else stat.dup++;
}
console.log('流解析统计:', JSON.stringify(stat));

// ---------- 总量与分布 ----------
console.log('\n=== 题库总量:', bank.length, '===');
const byType = { judge: 0, single: 0 }, byImg = { img: 0, text: 0 }, cats = {};
for (const q of bank) {
  byType[q.type]++;
  byImg[q.images.length ? 'img' : 'text']++;
  cats[q.category] = (cats[q.category] || 0) + 1;
}
console.log('题型:', JSON.stringify(byType), '图/文:', JSON.stringify(byImg));
console.log('分类:', JSON.stringify(cats));

// 图片题的题型细分
const imgJudge = bank.filter(q => q.images.length && q.type === 'judge').length;
const imgSingle = bank.filter(q => q.images.length && q.type === 'single').length;
console.log('图片题: 判断', imgJudge, '单选', imgSingle);

fs.writeFileSync('D:/allprograms/科目一模拟/research/bank-final.json', JSON.stringify(bank), 'utf8');
const sz = fs.statSync('D:/allprograms/科目一模拟/research/bank-final.json').size;
console.log('bank-final.json 大小: ' + (sz / 1048576).toFixed(2) + ' MB');
