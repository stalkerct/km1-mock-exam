const fs = require('fs');
const qs = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/km1-stream-parsed.json', 'utf8'));
const samples = [
  { num: 619, why: '信号灯题-单图' },
  { num: 367, why: '高速公路车道-单图' },
  { num: 1597, why: '仪表板-3图' },
  { num: 867, why: '交通标志-此前错归228张' },
  { num: 869, why: '867后一题（编号连续性）' },
];
for (const s of samples) {
  const q = qs.find(x => x.num === s.num && x.images.length);
  if (!q) { console.log(s.num, '未找到'); continue; }
  console.log(`题${q.num} (${s.why}) [${q.type}] ${q.question.slice(0, 45)}`);
  if (q.options) console.log('  选项:', Object.entries(q.options).map(([k, v]) => k + '.' + v.slice(0, 12)).join(' | '), '答:' + q.answer);
  else console.log('  判断题 答:' + (q.answer === 'A' ? '正确' : '错误'));
  console.log('  图片:', q.images.join(', '));
  // 拷贝到校验目录
  for (let i = 0; i < Math.min(q.images.length, 3); i++) {
    const src = 'D:/allprograms/科目一模拟/research/km1-full-extracted/word/' + q.images[i];
    const dst = 'D:/allprograms/科目一模拟/research/verify/q' + q.num + '_' + i + '.' + q.images[i].split('.').pop();
    fs.mkdirSync('D:/allprograms/科目一模拟/research/verify', { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
console.log('\n已拷贝到 research/verify/');
