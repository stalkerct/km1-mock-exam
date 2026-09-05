const https = require('https');
const fs = require('fs');

const url = 'https://cdn.jsdelivr.net/gh/reiqr/shiroha-quiz@main/apps/android/app/src/main/assets/web/data/c1-full.json';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } }, (res) => {
  console.log('status', res.statusCode);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log('redirect to', res.headers.location);
    return;
  }
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('bytes', buf.length);
    fs.writeFileSync('D:/allprograms/科目一模拟/research/c1-full.json', buf);
    try {
      const bank = JSON.parse(buf.toString('utf8'));
      console.log('题目数量:', bank.questions.length);
      const types = {}, cats = {};
      for (const q of bank.questions) {
        types[q.type] = (types[q.type] || 0) + 1;
        cats[q.category || q.topic] = (cats[q.category || q.topic] || 0) + 1;
      }
      console.log('题型分布:', JSON.stringify(types));
      console.log('分类分布:', JSON.stringify(cats));
    } catch (e) {
      console.log('解析失败:', e.message);
    }
  });
}).on('error', (e) => console.error('ERR', e.code, e.message));
