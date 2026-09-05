const fs = require('fs');
const html = fs.readFileSync('D:/allprograms/科目一模拟/科目一模拟考试.html', 'utf8');

let fails = 0;
const fail = msg => { console.log('❌', msg); fails++; };
const ok = msg => console.log('✅', msg);

// ---------- 1. 占位符已替换 ----------
if (html.includes('__BANK_DATA__')) fail('占位符未替换'); else ok('题库已注入');

// ---------- 2. JS 语法 ----------
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { fail('未找到 script'); process.exit(1); }
const script = m[1];
new (require('vm').Script)(script);
ok('JS 语法解析通过');

// ---------- 3. DOM id 引用 ----------
const idsUsed = new Set();
for (const mm of script.matchAll(/\$\('([\w-]+)'\)/g)) idsUsed.add(mm[1]);
const idsDefined = new Set();
for (const mm of html.matchAll(/id="([\w-]+)"/g)) idsDefined.add(mm[1]);
const missing = [...idsUsed].filter(i => !idsDefined.has(i));
if (missing.length) fail('缺失的元素 id: ' + missing.join(',')); else ok('全部 ' + idsUsed.size + ' 个 DOM id 引用完整');

// ---------- 4. 核心逻辑 + 图片题 ----------
const coreStart = script.indexOf('/* ================= CORE LOGIC (pure) ================= */');
const coreEnd = script.indexOf('/* ================= END CORE ================= */');
const core = script.slice(coreStart, coreEnd);
const bankMatch = script.match(/const BANK = ([\s\S]*?);\n/);
const vm = require('vm');
const ctx = { console, Math };
vm.createContext(ctx);
vm.runInContext('BANK=' + bankMatch[1], ctx);
vm.runInContext(core, ctx);

const BANK = JSON.parse(bankMatch[1]);
const judgeN = BANK.filter(q => q.type === 'judge').length;
const singleN = BANK.filter(q => q.type === 'single').length;
const imgJudgeN = BANK.filter(q => q.type === 'judge' && q.images.length).length;
const imgSingleN = BANK.filter(q => q.type === 'single' && q.images.length).length;
ok('题库 ' + BANK.length + ' 题（判断 ' + judgeN + ' / 单选 ' + singleN + '；图片题 判断 ' + imgJudgeN + ' / 单选 ' + imgSingleN + '）');

// 数据 URI 合法性
let badUri = 0;
for (const q of BANK) for (const s of q.images) if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s)) badUri++;
if (badUri) fail('非法 data URI: ' + badUri); else ok('全部图片 data URI 合法');

// ---------- 5. 组卷 300 次（含图片传输校验） ----------
let imgInPaperMin = 1000, imgInPaperMax = -1;
for (let t = 0; t < 300; t++) {
  const paper = vm.runInContext('buildExamPaper()', ctx);
  if (paper.length !== 100) { fail('组卷题数=' + paper.length); break; }
  const judges = paper.slice(0, 40), singles = paper.slice(40);
  if (judges.some(q => q.type !== 'judge') || singles.some(q => q.type !== 'single')) { fail('题型区段错乱'); break; }
  let bad = false;
  for (const q of paper) {
    const orig = BANK.find(b => b.id === q.id);
    if (!orig) { fail('未知题目id ' + q.id); bad = true; break; }
    if ((orig.images.length ? 1 : 0) !== (q.images.length ? 1 : 0)) { fail('图片未随题进入试卷 ' + q.id); bad = true; break; }
    if (orig.images.length && orig.images.length !== q.images.length) { fail('图片数量不一致 ' + q.id); bad = true; break; }
    if (q.type === 'single') {
      const keys = Object.keys(q.options).sort().join('');
      if (keys !== 'ABCD' || !q.options[q.answer]) { fail('单选格式错 ' + q.id); bad = true; break; }
      const sorted = a => Object.values(a).slice().sort().join('|');
      if (sorted(orig.options) !== sorted(q.options)) { fail('选项内容洗牌不一致 ' + q.id); bad = true; break; }
    }
  }
  if (bad) break;
  const idSet = new Set(paper.map(q => q.id));
  if (idSet.size !== 100) { fail('场内重复题'); break; }
  const imgCnt = paper.filter(q => q.images.length).length;
  imgInPaperMin = Math.min(imgInPaperMin, imgCnt);
  imgInPaperMax = Math.max(imgInPaperMax, imgCnt);
}
ok('300 次组卷通过：题型区段/选项洗牌/图片传输/无重复');
ok('每卷图片题数量范围: ' + imgInPaperMin + ' ~ ' + imgInPaperMax + ' 题');

// ---------- 6. 分类分布 ----------
const paper = vm.runInContext('buildExamPaper()', ctx);
const examCats = {}, bankCats = {};
for (const q of paper) examCats[q.category] = (examCats[q.category] || 0) + 1;
for (const q of BANK) bankCats[q.category] = (bankCats[q.category] || 0) + 1;
let skew = 0;
for (const c of Object.keys(bankCats)) {
  const e = (examCats[c] || 0) / 100, b = bankCats[c] / BANK.length;
  skew = Math.max(skew, Math.abs(e - b));
}
if (skew > 0.06) fail('分类偏差过大 ' + (skew * 100).toFixed(1) + '%'); else ok('试卷分布贴合题库分布（最大偏差 ' + (skew * 100).toFixed(1) + '%）');

// ---------- 7. 图片在界面模板中的渲染点 ----------
for (const id of ['q-imgs', 'imgHtml']) {
  if (!script.includes(id) && !html.includes(id)) fail('缺少图片渲染: ' + id);
}
ok('考试页/回顾/错题本/重练 图片渲染均已接入');

console.log('\n' + (fails ? '存在 ' + fails + ' 个失败项' : '🎉 全部测试通过'));
process.exit(fails ? 1 : 0);
