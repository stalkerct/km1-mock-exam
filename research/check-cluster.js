const fs = require('fs');
const qs = JSON.parse(fs.readFileSync('D:/allprograms/科目一模拟/research/km1-stream-parsed.json', 'utf8'));
// 仪表板/灯光开关密集区 1594-1606
for (let n = 1594; n <= 1606; n++) {
  const q = qs.find(x => x.num === n);
  if (!q) { console.log(n, '缺失'); continue; }
  const img = q.images.length ? q.images.join(',') : '无图';
  console.log(`${n} [${q.type}] ${q.question.slice(0, 38)} ${q.options ? '答:' + q.answer + ' ' + Object.values(q.options)[0].slice(0, 10) : '答:' + (q.answer === 'A' ? '√' : '×')} 图:${img}`);
}
// 拷贝 1596-1601 的图供目视
const verify = 'D:/allprograms/科目一模拟/research/verify';
for (let n = 1596; n <= 1601; n++) {
  const q = qs.find(x => x.num === n);
  if (q && q.images[0]) {
    fs.copyFileSync('D:/allprograms/科目一模拟/research/km1-full-extracted/word/' + q.images[0], verify + '/c' + n + '.' + q.images[0].split('.').pop());
  }
}
console.log('已拷贝 c1596-c1601');
