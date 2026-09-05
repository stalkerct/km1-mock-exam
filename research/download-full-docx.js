const https = require('https');
const fs = require('fs');

// 原版 27MB docx（含全部图片）— 通过 GitHub blob API 下载（该域名此前 Node 直连可用）
const url = 'https://api.github.com/repos/lindsey-chang/TRLLM-Traffic-Rules-Assistant/git/blobs/d4d5e205420caf88f70c6bdd0b302d2d25bfe7ef';
const OUT = 'D:/allprograms/科目一模拟/research/km1-1853-full.docx';

function attempt(n) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode !== 200) {
        console.log('attempt', n, 'status', res.statusCode);
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      let recv = 0;
      res.on('data', c => { chunks.push(c); recv += c.length; if (recv % (5 * 1024 * 1024) < 65536) process.stdout.write('已接收 ' + (recv / 1048576).toFixed(1) + 'MB\r'); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
      req.on('error', reject);
    });
    req.setTimeout(120000, () => { req.destroy(new Error('timeout')); });
  });
}

(async () => {
  for (let i = 1; i <= 5; i++) {
    try {
      const raw = await attempt(i);
      console.log('\n下载完成:', raw.length, 'bytes');
      const obj = JSON.parse(raw.toString('utf8'));
      console.log('blob size:', obj.size, 'encoding:', obj.encoding);
      const buf = Buffer.from(obj.content.replace(/\s/g, ''), 'base64');
      console.log('解码:', buf.length, 'bytes, zip-magic:', buf.slice(0, 2).toString());
      if (buf.slice(0, 2).toString() === 'PK') {
        fs.writeFileSync(OUT, buf);
        console.log('SAVED ->', OUT);
        return;
      }
      throw new Error('bad magic');
    } catch (e) {
      console.error('attempt', i, 'failed:', e.message);
      if (i === 5) process.exit(1);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
})();
