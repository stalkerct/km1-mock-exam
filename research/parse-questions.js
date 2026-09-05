const fs = require('fs');

const paras = fs.readFileSync('D:/allprograms/科目一模拟/research/km1-paras.txt', 'utf8').split('\n');
const full = paras.join('\n');

// 用题号标记切分题目：数字+顿号/点+空格开头
const qStartRe = /(?:^|\n)\s*(\d{1,4})[、.．]\s*/g;

const starts = [];
let m;
while ((m = qStartRe.exec(full)) !== null) {
  starts.push({ num: parseInt(m[1], 10), idx: m.index, afterIdx: m.index + m[0].length });
}
console.log('题号标记数量:', starts.length);

const questions = [];
for (let i = 0; i < starts.length; i++) {
  const text = full.slice(starts[i].afterIdx, starts[i + 1] ? starts[i + 1].idx : full.length).replace(/\n/g, '').trim();
  const num = starts[i].num;

  // 提取答案
  const ansMatch = text.match(/答案[：:]\s*([A-D√×对错])/);
  if (!ansMatch) continue;
  const answer = ansMatch[1];
  const body = text.slice(0, ansMatch.index).trim();

  // 是否含图片
  const hasImage = /\[有图片\]|如图|这种|这个标志|图中|红圈内|路面上的|路缘石|仪表板|灯光开关|缩写|踏板|符号/.test(body) && /\[有图片\]/.test(text);

  // 提取选项（A、 B、 C、 D、 或 A. B. 等格式）
  const optRe = /([A-D])[、.．]\s*/g;
  const optMarks = [];
  let om;
  while ((om = optRe.exec(body)) !== null) {
    optMarks.push({ key: om[1], start: om.index, contentStart: om.index + om[0].length });
  }

  let questionText, options = null, type;
  if (optMarks.length >= 2) {
    questionText = body.slice(0, optMarks[0].start).trim();
    options = {};
    for (let j = 0; j < optMarks.length; j++) {
      const end = j + 1 < optMarks.length ? optMarks[j + 1].start : body.length;
      options[optMarks[j].key] = body.slice(optMarks[j].contentStart, end).trim();
    }
    type = 'single';
    // 判断题 disguised：只有 A、正确 B、错误 两个选项
    const keys = Object.keys(options);
    if (keys.length === 2 && options.A === '正确' && options.B === '错误') {
      type = 'judge';
    }
  } else {
    questionText = body;
    type = 'judge';
  }

  // 规范判断题答案
  let normAnswer = answer;
  if (type === 'judge') {
    if (answer === '√' || answer === '对') normAnswer = '对';
    else if (answer === '×' || answer === '错') normAnswer = '错';
    else if (answer === 'A') normAnswer = '对';
    else if (answer === 'B') normAnswer = '错';
    else continue;
  } else {
    if (!options || !options[answer]) continue;
  }

  questions.push({
    num,
    type,
    question: questionText,
    options,
    answer: normAnswer,
    hasImage: /\[有图片\]/.test(text)
  });
}

console.log('解析成功题目数:', questions.length);
const typeCount = { single: 0, judge: 0 };
let imgCount = 0;
for (const q of questions) { typeCount[q.type]++; if (q.hasImage) imgCount++; }
console.log('题型:', JSON.stringify(typeCount), '图片题:', imgCount, '→ 纯文字题:', questions.length - imgCount);

// 检查题干长度异常
const tooShort = questions.filter(q => q.question.length < 8);
console.log('题干过短(<8字):', tooShort.length);

// 抽样输出
console.log('\n--- 样例 ---');
for (const idx of [0, 3, 100, 300, 600]) {
  const q = questions[idx];
  if (q) console.log(`#${q.num} [${q.type}${q.hasImage ? '图' : ''}] ${q.question.slice(0, 40)}... 答案:${q.answer}`);
}

fs.writeFileSync('D:/allprograms/科目一模拟/research/km1-parsed.json', JSON.stringify(questions, null, 1), 'utf8');
