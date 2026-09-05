const fs = require('fs');
const bank = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/bank-merged.json', 'utf8'));

// 1. 检查损坏区段题目
console.log('=== 损坏区段抽查 (K0180-K0270) ===');
for (const q of bank) {
  const n = parseInt(q.id.slice(1), 10);
  if (q.id[0] === 'K' && n >= 180 && n <= 270) {
    console.log(`[${q.id}] ${q.question.slice(0, 60)}${q.question.length > 60 ? '...' : ''}`);
    if (q.type === 'single') console.log('   选项:', Object.entries(q.options).map(([k, v]) => `${k}.${v.slice(0, 15)}`).join(' | '), '答:', q.answer);
    else console.log('   答:', q.answer === 'A' ? '正确' : '错误');
  }
}

// 2. 全库格式校验
let bad = [];
for (const q of bank) {
  if (q.type === 'single') {
    const keys = Object.keys(q.options).sort().join('');
    if (keys !== 'ABCD') bad.push(q.id + ':选项键=' + keys);
    else if (!'ABCD'.includes(q.answer)) bad.push(q.id + ':答案=' + q.answer);
  } else {
    if (q.answer !== 'A' && q.answer !== 'B') bad.push(q.id + ':判断答案异常=' + q.answer);
  }
  if (q.question.length > 200) bad.push(q.id + ':题干过长' + q.question.length);
  if (q.type === 'single' && Object.values(q.options).some(v => v.length > 80)) bad.push(q.id + ':选项过长');
}
console.log('\n=== 格式问题 ===', bad.length ? bad.slice(0, 20) : '无');

// 3. 随机抽样看内容质量
console.log('\n=== 随机抽样 8 题 ===');
const idxs = new Set();
while (idxs.size < 8) idxs.add(Math.floor(Math.random() * bank.length));
for (const i of idxs) {
  const q = bank[i];
  console.log(`\n[${q.id}|${q.type}|${q.category}] ${q.question}`);
  if (q.type === 'single') for (const [k, v] of Object.entries(q.options)) console.log(`   ${k}. ${v}`);
  console.log(`   答案: ${q.type === 'judge' ? (q.answer === 'A' ? '正确' : '错误') : q.answer}`);
}
