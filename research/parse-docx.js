const fs = require('fs');
const xml = fs.readFileSync('D:/allprograms/科目一模拟/research/km1-extracted/word/document.xml', 'utf8');

// 提取所有段落文本：<w:p>...</w:p> 内的 <w:t> 拼接
const paras = [];
const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
let m;
while ((m = pRe.exec(xml)) !== null) {
  const texts = [];
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let t;
  while ((t = tRe.exec(m[0])) !== null) texts.push(t[1]);
  const line = texts.join('').trim();
  if (line) paras.push(line);
}
console.log('总段落:', paras.length);
console.log('--- 前 60 段 ---');
console.log(paras.slice(0, 60).join('\n'));
fs.writeFileSync('D:/allprograms/科目一模拟/research/km1-paras.txt', paras.join('\n'), 'utf8');
