const fs = require('fs');
const path = 'C:/Users/ct/AppData/Local/Temp/dsh-spill-7uhAc9/session-6cd69c761c53/71a95fb724f2-web_fetch.txt';
let raw = fs.readFileSync(path, 'utf8');
console.log('文件大小:', raw.length);
const contentMatch = raw.match(/"content":"([A-Za-z0-9+/=\s]+)"/);
console.log('能否匹配 content 字段:', !!contentMatch);
if (contentMatch) {
  const b64 = contentMatch[1].replace(/\s/g, '');
  console.log('base64 长度:', b64.length);
  const buf = Buffer.from(b64, 'base64');
  console.log('解码后字节数:', buf.length);
  fs.writeFileSync('D:/allprograms/科目一模拟/research/c1-full.json', buf);
  try {
    const bank = JSON.parse(buf.toString('utf8'));
    console.log('题目数量:', bank.questions.length);
    const types = {};
    const cats = {};
    for (const q of bank.questions) {
      types[q.type] = (types[q.type] || 0) + 1;
      cats[q.category || q.topic] = (cats[q.category || q.topic] || 0) + 1;
    }
    console.log('题型分布:', JSON.stringify(types));
    console.log('分类分布:', JSON.stringify(cats));
    console.log('字段:', Object.keys(bank.questions[0]).join(','));
  } catch (e) {
    console.log('解码后 JSON 解析失败:', e.message);
    console.log('结尾100字符:', JSON.stringify(buf.toString('utf8').slice(-100)));
  }
}
