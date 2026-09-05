const fs = require('fs');
const path = require('path');
const BASE = 'D:/allprograms/科目一模拟/research/km1-full-extracted';

const xml = fs.readFileSync(path.join(BASE, 'word/document.xml'), 'utf8');
const relsXml = fs.readFileSync(path.join(BASE, 'word/_rels/document.xml.rels'), 'utf8');

// rels: rId -> media 文件
const rid2file = {};
for (const m of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="(media\/[^"]+)"/g)) rid2file[m[1]] = m[2];

// ---------- 1. 全文档 token 流（保持 XML 顺序） ----------
const tokRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<a:blip[^>]*r:embed="([^"]+)"|<v:imagedata[^>]*r:id="([^"]+)"/g;
let text = '';
const imgPos = []; // {pos, rid} pos=该图所在位置对应的已拼接文本长度
let m;
while ((m = tokRe.exec(xml)) !== null) {
  if (m[1] !== undefined) text += m[1];
  else imgPos.push({ pos: text.length, rid: m[2] || m[3] });
}
console.log('全文长度:', text.length, '图片token:', imgPos.length);

// ---------- 2. 题号切分（带序号合理性校验，防"2022."之类误切） ----------
const markerRe = /(\d{1,4})[、.．]/g;
const allMarkers = [];
while ((m = markerRe.exec(text)) !== null) {
  allMarkers.push({ num: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length });
}
const markers = [];
let lastNum = 0;
for (const mk of allMarkers) {
  // 序号必须递增且跳变不超过40（容忍损坏区），且≤1900
  if (mk.num > lastNum && mk.num <= lastNum + 40 && mk.num <= 1900) {
    markers.push(mk);
    lastNum = mk.num;
  }
}
console.log('题号候选:', allMarkers.length, '→ 合理标记:', markers.length, '最后题号:', lastNum);

// ---------- 3. 逐题提取 ----------
const optRe = /([A-D])[、.．]/g;
const out = [];
let malformed = 0, multiAns = 0;
for (let i = 0; i < markers.length; i++) {
  const s = markers[i].end;
  const e = i + 1 < markers.length ? markers[i + 1].start : text.length;
  const region = text.slice(s, e);
  const ansMatches = [...region.matchAll(/答案[：:]\s*([A-D√×对错])/g)];
  if (!ansMatches.length) { malformed++; continue; }
  if (ansMatches.length > 1) multiAns++;
  const answer = ansMatches[ansMatches.length - 1][1];
  const ansEnd = ansMatches[ansMatches.length - 1].index + ansMatches[ansMatches.length - 1][0].length;
  const body = region.slice(0, ansMatches[ansMatches.length - 1].index).replace(/\[有图片\]/g, '').replace(/\s+/g, '');

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
  if (questionText.length < 6) { malformed++; continue; }

  // 图片归属：位置落在 [s, e) 的 token（用绝对位置）
  const files = [];
  const seenRid = new Set();
  for (const ip of imgPos) {
    if (ip.pos >= s && ip.pos < e && !seenRid.has(ip.rid)) {
      seenRid.add(ip.rid);
      const f = rid2file[ip.rid];
      if (f) files.push(f);
    }
  }
  out.push({ num: markers[i].num, type, question: questionText, options: type === 'judge' ? null : options, answer: normAnswer, images: files, ansEndAbs: s + ansEnd });
}
console.log('解析成功:', out.length, '格式异常:', malformed, '多答案区域:', multiAns);

// ---------- 4. 统计 ----------
let withImg = 0;
const typeImg = { judge: 0, single: 0 };
const imgCnt = {};
for (const q of out) {
  if (q.images.length) {
    withImg++; typeImg[q.type]++;
    imgCnt[Math.min(q.images.length, 5)] = (imgCnt[Math.min(q.images.length, 5)] || 0) + 1;
  }
}
console.log('带图题:', withImg, JSON.stringify(typeImg), '| 每题图片数(5+封顶):', JSON.stringify(imgCnt));
const suspicious = out.filter(q => !q.images.length && /如图|这种|这个标志|图中|红圈|仪表板|灯光开关|路缘石|菱形/.test(q.question));
console.log('无图但含图示词（需排除）:', suspicious.length);
// 图片题但题干不含图示词（可疑匹配）
const noWordImg = out.filter(q => q.images.length && !/如图|这种|图|标志|仪表|开关|所示|灯|车道|踏板|缩写|符号|标线/.test(q.question));
console.log('有图但题干无图示词（可疑）:', noWordImg.length, noWordImg.slice(0, 3).map(q => q.num + ':' + q.question.slice(0, 25)));

fs.writeFileSync('D:/allprograms/科目一模拟/research/km1-stream-parsed.json', JSON.stringify(out), 'utf8');
console.log('已保存 km1-stream-parsed.json');
