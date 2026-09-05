const fs = require('fs');
const qs = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/km1-full-parsed.json', 'utf8'));
// 挑选不同类型的图片题样本
const picks = [];
const wants = [/标志是何含义/, /信号灯/, /仪表板/, /车道/, /踏板|开关|缩写/];
for (const w of wants) {
  const hit = qs.find(q => q.images.length && w.test(q.question));
  if (hit) picks.push(hit);
}
for (const p of picks) {
  console.log(`题号${p.num} [${p.type}] ${p.question.slice(0, 50)}`);
  console.log(`  图片: ${p.images.join(', ')}`);
}
// 额外统计每题图片数分布
const cnt = {};
for (const q of qs) if (q.images.length) cnt[q.images.length] = (cnt[q.images.length] || 0) + 1;
console.log('每题图片数分布:', JSON.stringify(cnt));
