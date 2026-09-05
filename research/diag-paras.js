const fs = require('fs');
const path = require('path');
const BASE = 'D:/allprograms/科目一模拟/research/km1-full-extracted';
const xml = fs.readFileSync(path.join(BASE, 'word/document.xml'), 'utf8');

// 段落流（含原始 XML 判断 numPr）
const paras = [];
const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
let m;
while ((m = pRe.exec(xml)) !== null) {
  const p = m[0];
  let text = '';
  for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) text += t[1];
  const rids = [];
  for (const b of p.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) rids.push(b[1]);
  for (const v of p.matchAll(/<v:imagedata[^>]*r:id="([^"]+)"/g)) rids.push(v[1]);
  paras.push({
    text: text.trim(),
    rids,
    hasNumPr: /<w:numPr>/.test(p),
    hasTxbx: /<w:txbxContent>/.test(p)
  });
}

// 找到 image286 所在段落的 index（867 blob 的第一张图）
let idx = paras.findIndex(p => p.rids.some(r => r.includes('image286')));
console.log('image286 所在段落 index:', idx);
console.log('\n=== 该段前后 12 段 ===');
for (let i = Math.max(0, idx - 2); i <= Math.min(paras.length - 1, idx + 12); i++) {
  const p = paras[i];
  console.log(`[${i}] numPr=${p.hasNumPr ? 'Y' : 'n'} txbx=${p.hasTxbx ? 'Y' : 'n'} rids=${p.rids.length} text="${p.text.slice(0, 60)}"`);
}

// 统计 numPr 段落
const numPrCount = paras.filter(p => p.hasNumPr).length;
const numPrWithText = paras.filter(p => p.hasNumPr && p.text).length;
console.log(`\nnumPr 段落总数: ${numPrCount}, 其中有文本的: ${numPrWithText}`);
// image286 之后连续无文本图片段的范围
let run = 0;
for (let i = idx; i < paras.length; i++) {
  if (paras[i].rids.length && !paras[i].text) run++;
  else if (run > 3) { console.log(`从 ${idx} 起连续 ${run} 个纯图片段落到 ${i}`); break; }
  else run = 0;
}
