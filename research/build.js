const fs = require('fs');

const tpl = fs.readFileSync('D:/allprograms/科目一模拟/app-template.html', 'utf8');
const bank = fs.readFileSync('D:/allprograms/科目一模拟/research/bank-final.json', 'utf8');

if (!tpl.includes('__BANK_DATA__')) {
  console.error('模板缺少 __BANK_DATA__ 占位符'); process.exit(1);
}
// 验证题库 JSON 合法
const data = JSON.parse(bank);
if (!Array.isArray(data) || data.length < 800) {
  console.error('题库异常:', data.length); process.exit(1);
}
// 图片题校验：每个 data URI 必须合法
let imgQ = 0, badImg = 0;
for (const q of data) {
  if (q.images && q.images.length) {
    imgQ++;
    for (const s of q.images) if (!/^data:image\/(png|jpeg);base64,/.test(s)) badImg++;
  }
}
if (badImg) { console.error('非法图片 URI:', badImg); process.exit(1); }

const out = tpl.replace('__BANK_DATA__', bank);
fs.writeFileSync('D:/allprograms/科目一模拟/科目一模拟考试.html', out);
const imgCount = imgQ;
console.log('构建完成: 科目一模拟考试.html，大小 ' + (fs.statSync('D:/allprograms/科目一模拟/科目一模拟考试.html').size / 1048576).toFixed(2) + ' MB，题库 ' + data.length + ' 题（图片题 ' + imgCount + '）');
