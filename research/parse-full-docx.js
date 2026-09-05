const fs = require('fs');
const path = require('path');

const BASE = 'D:/allprograms/科目一模拟/research/km1-full-extracted';
const xml = fs.readFileSync(path.join(BASE, 'word/document.xml'), 'utf8');

// ---------- 1. rels: rId -> media 文件 ----------
const relsXml = fs.readFileSync(path.join(BASE, 'word/_rels/document.xml.rels'), 'utf8');
const rid2file = {};
for (const m of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="(media\/[^"]+)"/g)) {
  rid2file[m[1]] = m[2];
}
console.log('rels 图片映射数:', Object.keys(rid2file).length);

// ---------- 2. 段落流：每段 { text, rids[] } ----------
const paras = [];
const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
let m;
while ((m = pRe.exec(xml)) !== null) {
  const p = m[0];
  // 文本
  let text = '';
  for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) text += t[1];
  // 图片（两种形式）
  const rids = [];
  for (const b of p.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) rids.push(b[1]);
  for (const v of p.matchAll(/<v:imagedata[^>]*r:id="([^"]+)"/g)) rids.push(v[1]);
  paras.push({ text: text.trim(), rids });
}
console.log('段落总数:', paras.length);

// ---------- 3. 按题号切分，累积文本与图片 ----------
const qStartRe = /^(\d{1,4})[、.．]\s*/;
const questions = [];
let cur = null;
for (const p of paras) {
  const sm = p.text.match(qStartRe);
  if (sm && cur) { questions.push(cur); cur = null; }
  if (sm) {
    cur = { num: parseInt(sm[1], 10), text: p.text.slice(sm[0].length), rids: p.rids.slice() };
  } else if (cur) {
    if (p.text) cur.text += p.text;
    cur.rids.push(...p.rids);
  }
}
if (cur) questions.push(cur);
console.log('切分出题目:', questions.length);

// ---------- 4. 解析每题：题干/选项/答案/图片 ----------
const optRe = /([A-D])[、.．]\s*/g;
const out = [];
let malformed = 0;
for (const q of questions) {
  const text = q.text.replace(/\s+/g, '').replace(/（/g, '（');
  const ansMatch = text.match(/答案[：:]\s*([A-D√×对错])/);
  if (!ansMatch) { malformed++; continue; }
  const answer = ansMatch[1];
  const body = text.slice(0, ansMatch.index).replace(/\[有图片\]/g, '');

  const optMarks = [];
  let om;
  optRe.lastIndex = 0;
  while ((om = optRe.exec(body)) !== null) optMarks.push({ key: om[1], start: om.index, cStart: om.index + om[0].length });

  let questionText, options = null, type;
  if (optMarks.length >= 2) {
    questionText = body.slice(0, optMarks[0].start).trim();
    options = {};
    for (let j = 0; j < optMarks.length; j++) {
      const end = j + 1 < optMarks.length ? optMarks[j + 1].start : body.length;
      options[optMarks[j].key] = body.slice(optMarks[j].cStart, end).trim();
    }
    type = 'single';
    if (Object.keys(options).length === 2 && options.A === '正确' && options.B === '错误') type = 'judge';
  } else {
    questionText = body.trim();
    type = 'judge';
  }

  let normAnswer = answer;
  if (type === 'judge') {
    if (answer === '√' || answer === '对' || answer === 'A') normAnswer = 'A';
    else if (answer === '×' || answer === '错' || answer === 'B') normAnswer = 'B';
    else { malformed++; continue; }
  } else {
    if (!options || !options[answer]) { malformed++; continue; }
  }

  const files = q.rids.map(r => rid2file[r]).filter(Boolean);
  out.push({
    num: q.num, type,
    question: questionText,
    options: type === 'judge' ? null : options,
    answer: normAnswer,
    images: [...new Set(files)]
  });
}
console.log('解析成功:', out.length, '格式异常丢弃:', malformed);

// ---------- 5. 统计 ----------
let withImg = 0, noImg = 0;
const typeImg = { judge: 0, single: 0 };
for (const q of out) {
  if (q.images.length) { withImg++; typeImg[q.type]++; } else noImg++;
}
console.log('带图片题:', withImg, JSON.stringify(typeImg), '纯文字题:', noImg);
// 图片题但没图（说明 rels 缺失或位置错）→ 需警惕：含"如图/这种"却无图
const suspicious = out.filter(q => !q.images.length && /如图|这种|这个标志|图中|红圈|仪表板|灯光开关|路缘石|菱形/.test(q.question));
console.log('无图但题干含图示词（危险）:', suspicious.length, suspicious.slice(0, 5).map(q => q.num + ':' + q.question.slice(0, 30)));

fs.writeFileSync('D:/allprograms/科目一模拟/research/km1-full-parsed.json', JSON.stringify(out), 'utf8');
console.log('已保存 km1-full-parsed.json');
