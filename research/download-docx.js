const https = require('https');
const fs = require('fs');

// 先测试 api.github.com 连通性：获取该文件的 blob 元信息
const url = 'https://api.github.com/repos/lindsey-chang/TRLLM-Traffic-Rules-Assistant/git/blobs/9f8cccb484d22ecd272f2d26cce0051a2c66e4d3';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github+json' } }, (res) => {
  console.log('status', res.statusCode);
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const raw = Buffer.concat(chunks);
    console.log('bytes', raw.length);
    try {
      const obj = JSON.parse(raw.toString('utf8'));
      console.log('size:', obj.size, 'encoding:', obj.encoding);
      if (obj.content) {
        const buf = Buffer.from(obj.content.replace(/\s/g, ''), 'base64');
        console.log('decoded bytes:', buf.length, 'zip-magic:', buf.slice(0, 2).toString());
        fs.writeFileSync('D:/allprograms/科目一模拟/research/km1-1853.docx', buf);
        console.log('SAVED');
      }
    } catch (e) { console.log('parse err', e.message, raw.toString('utf8').slice(0, 300)); }
  });
}).on('error', (e) => console.error('ERR', e.code, e.message));
