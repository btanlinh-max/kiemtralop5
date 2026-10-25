import type { Exam, Level, Passage, Question } from './types';
import { makeCode, uid } from './grading';

// Bộ đọc đề tiếng Việt KHÔNG cần AI: nhận diện nhiều đề trong 1 file, câu trắc nghiệm A/B/C/D,
// câu Đúng/Sai, mức độ (M1/M2/M3), điểm, bài đọc, phần viết, bảng đáp án (nếu có).

export interface ParsedExam {
  title: string;
  subject: string;
  passages: Passage[];
  questions: Question[];
}

const SUBJECT_PATTERNS: [RegExp, string][] = [
  [/tiếng\s*việt/i, 'Tiếng Việt'],
  [/tiếng\s*anh|english/i, 'Tiếng Anh'],
  [/lịch\s*sử|địa\s*lí|địa\s*lý/i, 'Lịch sử và Địa lí'],
  [/khoa\s*học/i, 'Khoa học'],
  [/tin\s*học/i, 'Tin học'],
  [/công\s*nghệ/i, 'Công nghệ'],
  [/đạo\s*đức/i, 'Đạo đức'],
  [/toán/i, 'Toán'],
];

export function detectSubject(text: string, fallback = 'Toán') {
  const head = text.slice(0, 1500);
  for (const [re, s] of SUBJECT_PATTERNS) if (re.test(head)) return s;
  return fallback;
}

// Gợi ý chủ đề theo từ khoá (giáo viên/AI có thể sửa lại)
const TOPIC_KEYS: Record<string, [RegExp, string][]> = {
  Toán: [
    [/số thập phân thích hợp|viết (các )?số đo/i, 'Viết số đo đại lượng dưới dạng số thập phân'],
    [/hỏi .*(bao nhiêu|mấy)|thu hoạch|bài giải|người ta/i, 'Giải toán có lời văn'],
    [/vận tốc|quãng đường|km\/giờ|chuyển động/i, 'Vận tốc, quãng đường, thời gian (chuyển động đều)'],
    [/thể tích|cm³|dm³|m³|hình hộp|hình lập phương/i, 'Diện tích, thể tích hình hộp chữ nhật, hình lập phương'],
    [/tỉ số phần trăm|%|phần trăm/i, 'Tỉ số và tỉ số phần trăm'],
    [/tỉ lệ bản đồ/i, 'Tỉ lệ bản đồ'],
    [/hình tròn|đường tròn|bán kính|đường kính|chu vi hình tròn/i, 'Hình tròn, đường tròn'],
    [/tam giác|hình thang/i, 'Hình tam giác, hình thang'],
    [/góc|độ\b|°/i, 'Góc và đo góc'],
    [/ha\b|km²|héc-ta|hécta|m²|dm²|diện tích/i, 'Đơn vị đo diện tích (km², ha)'],
    [/làm tròn|lớn nhất|bé nhất|so sánh|từ bé đến lớn|từ lớn đến bé|[<>]\s*$|dấu thích hợp/i, 'So sánh, làm tròn số thập phân'],
    [/(kg|tấn|tạ|yến|g|m|cm|dm|mm|km)\s*\d+\s*(kg|g|cm|dm|mm|m)\s*=|=\s*…+\s*(m|kg|tấn|km)/i, 'Viết số đo đại lượng dưới dạng số thập phân'],
    [/thuận tiện|giá trị (của )?biểu thức/i, 'Tính giá trị biểu thức, tính thuận tiện'],
    [/phân số thập phân/i, 'Phân số thập phân'],
    [/hỗn số|phân số|\{\d+\/\d+\}/i, 'Ôn tập phân số, hỗn số'],
    [/số thập phân|hàng phần (mười|trăm|nghìn)|\d+,\d+/i, 'Số thập phân (đọc, viết, cấu tạo)'],
    [/chữ số|triệu|số tự nhiên|giá trị của chữ số/i, 'Ôn tập số tự nhiên'],
    [/thu hoạch|hỏi|bao nhiêu|mỗi|cứ/i, 'Giải toán có lời văn'],
  ],
  'Tiếng Việt': [
    [/đồng nghĩa/i, 'Từ đồng nghĩa'],
    [/đa nghĩa|nghĩa gốc|nghĩa chuyển/i, 'Từ đa nghĩa'],
    [/đại từ/i, 'Đại từ'],
    [/kết từ/i, 'Kết từ'],
    [/câu ghép|vế câu/i, 'Câu ghép, cách nối các vế câu ghép'],
    [/trạng ngữ|chủ ngữ|vị ngữ/i, 'Trạng ngữ, chủ ngữ, vị ngữ'],
    [/gạch ngang|dấu câu|dấu phẩy|dấu chấm/i, 'Dấu gạch ngang, dấu câu'],
    [/điệp từ|điệp ngữ/i, 'Biện pháp điệp từ, điệp ngữ'],
    [/bài học|ý nghĩa|nội dung chính|theo em|vì sao|điều quý giá|em rút ra/i, 'Đọc hiểu – ý nghĩa, bài học'],
    [/.*/, 'Đọc hiểu – nội dung, chi tiết'],
  ],
};

export function guessTopic(subject: string, text: string): string {
  const keys = TOPIC_KEYS[subject];
  if (!keys) return '';
  for (const [re, t] of keys) if (re.test(text)) return t;
  return '';
}

function pretty(t: string) {
  t = t.trim();
  if (!t) return '';
  if (t === t.toUpperCase()) {
    t = t.toLowerCase().replace(/\b(i{1,3}|iv|v)\b/g, (m) => m.toUpperCase());
    t = t.replace(/(môn|lớp)\s+([^\s–-]+(?:\s[^\s–-]+)?)/g, (_, a, b) => a + ' ' + b.replace(/(^|\s)\S/g, (x: string) => x.toUpperCase()));
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

function stripMeta(s: string): { text: string; level?: Level; points?: number } {
  let level: Level | undefined;
  let points: number | undefined;
  const meta = s.match(/\(([^()]*?(?:điểm|M\s*[123])[^()]*?)\)/i);
  if (meta) {
    const m = meta[1];
    const lv = m.match(/M\s*([123])/i) || m.match(/mức\s*([123])/i);
    if (lv) level = +lv[1] as Level;
    const p = m.match(/(\d+(?:[.,]\d+)?)\s*điểm/i);
    if (p) points = num(p[1]);
    s = s.replace(meta[0], ' ');
  }
  return { text: s.replace(/\s+/g, ' ').replace(/^[\s:.\-–]+/, '').trim(), level, points };
}

const OPT_SPLIT = /(?:^|\s)([A-D])\s*[.)]\s+/g;

function splitOptions(line: string): string[] | null {
  const t = line.trim();
  if (!/^[A-D]\s*[.)]\s+/.test(t)) return null;
  const parts: { k: string; i: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  OPT_SPLIT.lastIndex = 0;
  while ((m = OPT_SPLIT.exec(t))) parts.push({ k: m[1], i: m.index, len: m[0].length });
  // chỉ nhận các chữ cái theo đúng thứ tự A,B,C,D (dòng có thể bắt đầu bằng C. D.)
  const good: typeof parts = [];
  const startK = 'ABCD'.indexOf(parts[0]?.k ?? 'A');
  for (const p of parts) if (p.k === 'ABCD'[startK + good.length]) good.push(p);
  if (!good.length) return null;
  return good.map((p, idx) => t.slice(p.i + p.len, idx + 1 < good.length ? good[idx + 1].i : undefined).trim());
}

const isJunk = (l: string) => /^[\s\-–—_.…|\t]*$/.test(l) || /^(TRƯỜNG\b|Trường (TH|Tiểu học)\s*[.…]|Họ (và )?tên\s*:|Lớp\s*:|Điểm\s*(\t|$)|Điểm\s+Nhận xét|Nhận xét của giáo viên|Năm học\b|Thời gian\s*:|Môn\s*:|Bài giải\s*$|\[hình\]\s*$)/i.test(l.trim());
const QSTART = /^(Câu|Bài)\s*(\d+)\s*[.:)]?\s*(.*)$/i;
const EXAM_BOUNDARY = /(^|[\s|–\-])ĐỀ\s+(SỐ\s+)?\d+\s*$|^ĐỀ\s+(SỐ\s+)?\d+\b|–\s*ĐỀ\s+SỐ\s+\d+/i;
const SECTION = /^(PHẦN\s+[IVX\d]+|[IVX]+\s*\.\s+|A\s*\.\s*(ĐỌC|PHẦN)|B\s*\.\s*(VIẾT|PHẦN))/i;

export function parseExams(text: string, fallbackSubject = 'Toán', baseTitle = 'Đề'): ParsedExam[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  // 1) Tách thành nhiều đề
  const chunks: { title: string; lines: string[]; head?: string }[] = [];
  let cur: { title: string; lines: string[]; head?: string } = { title: '', lines: [] };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.length < 160 && EXAM_BOUNDARY.test(l) && !QSTART.test(l)) {
      if (cur.lines.some((x) => QSTART.test(x.trim()))) chunks.push(cur);
      else if (cur.lines.length && chunks.length === 0) {
        // phần đầu file (trang bìa) – bỏ
      }
      const m = l.match(/ĐỀ\s+(SỐ\s+)?(\d+)/i);
      cur = { title: m ? `Đề số ${m[2]}` : l, lines: [], head: /^ĐỀ (KIỂM TRA|ÔN TẬP|KHẢO SÁT|THI|LUYỆN)/.test(l) ? l : '' };
      continue;
    }
    cur.lines.push(raw);
  }
  if (cur.lines.some((x) => QSTART.test(x.trim()))) chunks.push(cur);
  if (!chunks.length) chunks.push({ title: '', lines });

  const docSubject = detectSubject(text, fallbackSubject);
  const docHeading = (lines.map((l) => l.trim()).find((l) => /^\d*\s*ĐỀ (KIỂM TRA|ÔN TẬP|KHẢO SÁT|THI|LUYỆN)/.test(l) && l.length < 120) || '').replace(/^\d+\s*/, '');
  const answerKey = parseAnswerKey(text);

  return chunks.map((c, ci) => {
    const subject = detectSubject(c.lines.join('\n'), docSubject);
    const heading = c.lines.map((l) => l.trim()).find((l) => /^ĐỀ (KIỂM TRA|ÔN TẬP|KHẢO SÁT|THI|LUYỆN)/.test(l) && l.length < 120) || c.head || docHeading;
    const title = [pretty(heading.replace(/\s*[–-]\s*ĐỀ SỐ.*$/i, '')) || baseTitle, c.title].filter(Boolean).join(' – ');
    const pe = parseChunk(c.lines, subject);
    // gắn đáp án từ bảng đáp án (chỉ khi file có 1 đề)
    if (chunks.length === 1 && answerKey.size) {
      let i = 0;
      for (const q of pe.questions) {
        i++;
        if (q.type === 'mcq' && answerKey.has(i)) q.answer = answerKey.get(i)!;
      }
    }
    return { title: title || `${baseTitle} ${ci + 1}`, subject, passages: pe.passages, questions: pe.questions };
  });
}

function parseAnswerKey(text: string): Map<number, number> {
  const out = new Map<number, number>();
  const idx = text.search(/(ĐÁP ÁN|HƯỚNG DẪN CHẤM)/i);
  if (idx < 0) return out;
  const tail = text.slice(idx);
  const re = /(?:Câu\s*)?(\d{1,2})\s*[:.\-–)]\s*([A-D])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail))) if (!out.has(+m[1])) out.set(+m[1], 'ABCD'.indexOf(m[2]));
  return out;
}

function parseChunk(lines: string[], subject: string) {
  const passages: Passage[] = [];
  const questions: Question[] = [];
  let mode: 'none' | 'passage' | 'writing' = 'none';
  let passage: Passage | null = null;
  let q: { head: string; body: string[]; level?: Level; points?: number; passageId?: string } | null = null;
  let writing: string[] = [];

  const flushQ = () => {
    if (!q) return;
    questions.push(buildQuestion(q, subject));
    q = null;
  };

  for (const raw of lines) {
    const l = raw.trim();
    if (!l || isJunk(l)) continue;

    if (/đọc\s+(thầm|hiểu)?\s*(văn bản|bài|đoạn)/i.test(l) && l.length < 120 && !QSTART.test(l)) {
      flushQ();
      passage = { id: uid('p'), title: '', content: '' };
      passages.push(passage);
      mode = 'passage';
      continue;
    }
    if (/^PHẦN\s+[IVX\d]+.*VIẾT|^B\s*\.\s*VIẾT|^(II|2)\s*\.\s*VIẾT|^Viết\s*\(/i.test(l)) {
      flushQ();
      mode = 'writing';
      writing = [];
      continue;
    }
    const qs = l.match(QSTART);
    if (qs && mode !== 'writing') {
      flushQ();
      if (mode === 'passage') mode = 'none';
      q = { head: qs[3], body: [], passageId: passages.length ? passages[passages.length - 1].id : undefined };
      continue;
    }
    if (mode === 'passage' && passage) {
      if (/^(II|III)\s*\.\s*/.test(l) || /khoanh|dựa vào (nội dung )?bài đọc/i.test(l)) {
        mode = 'none';
        continue;
      }
      if (!passage.title && l === l.toUpperCase() && l.length < 80) passage.title = l;
      else if (/^\(.*(theo|trích|lược).*\)$/i.test(l)) passage.source = l.replace(/^\(|\)$/g, '');
      else passage.content += (passage.content ? '\n' : '') + l;
      continue;
    }
    if (mode === 'writing') {
      writing.push(l);
      continue;
    }
    if (SECTION.test(l) && !q) continue;
    if (SECTION.test(l)) {
      flushQ();
      continue;
    }
    if (q) (q as any).body.push(l);
  }
  flushQ();

  if (writing.length) {
    const t = writing.join('\n').replace(/^Đề bài\s*:\s*/i, '');
    const m = stripMeta(t);
    questions.push({
      id: uid('q'), type: 'essay', prompt: m.text.replace(/ (?=Em hãy)/, '\n'), points: m.points || 10,
      level: 3, topic: guessWritingTopic(t), guide: '',
    });
  }
  // nếu chỉ có bài đọc rỗng thì bỏ
  return { passages: passages.filter((p) => p.content.trim()), questions };
}

function guessWritingTopic(t: string) {
  if (/kể (lại )?(một )?câu chuyện|sáng tạo/i.test(t)) return 'Viết – kể chuyện sáng tạo';
  if (/tả (một )?(cảnh|phong cảnh)/i.test(t)) return 'Viết – tả phong cảnh';
  if (/tả (một )?người/i.test(t)) return 'Viết – tả người';
  if (/ý kiến|tình cảm|cảm xúc/i.test(t)) return 'Viết – đoạn văn nêu ý kiến, tình cảm';
  return 'Viết – kể chuyện sáng tạo';
}

function buildQuestion(q: { head: string; body: string[]; passageId?: string }, subject: string): Question {
  const meta = stripMeta(q.head);
  const opts: string[] = [];
  const rest: string[] = [];
  for (const b of q.body) {
    const o = splitOptions(b);
    if (o && (opts.length + o.length <= 4)) opts.push(...o);
    else rest.push(b);
  }
  const prompt = [meta.text, ...rest].join('\n').trim();
  const level = (meta.level || 2) as Level;
  const base = { id: uid('q'), prompt, level, topic: guessTopic(subject, prompt + ' ' + opts.join(' ')), passageId: q.passageId, explanation: '' };

  // Đúng/Sai
  if (/đúng ghi đ|ghi đ|đúng\s*\/\s*sai|đúng hay sai/i.test(meta.text)) {
    const statements = rest.join('  ').replace(/\[hình\]/g, ' ').split(/(?:^|\s)[a-h]\)\s*/).map((x) => x.replace(/[\s.…☐□]+$/g, '').trim()).filter(Boolean);
    if (statements.length >= 2) {
      return { ...base, type: 'tf', prompt: meta.text, statements, tfAnswers: statements.map(() => true), points: meta.points || 1 };
    }
  }
  if (opts.length >= 2) {
    return { ...base, type: 'mcq', options: opts.map((o) => o.replace(/\s*\[hình\]\s*/g, ' ').trim()), answer: -1, points: meta.points || 0.5 };
  }
  // Bài có các ý a) b) c)… điền vào chỗ chấm hoặc "Tính:" → chuyển thành câu điền đáp án (chấm tự động)
  const items = rest.join('\t').split(/(?:^|\s)([a-h])\)\s*/).filter((x) => x !== undefined);
  const subs: string[] = [];
  for (let i = 1; i < items.length; i += 2) subs.push(items[i] + ') ' + (items[i + 1] || '').replace(/\s+/g, ' ').trim());
  const dotty = /…{2,}|\.{4,}/;
  if (subs.length >= 2 && /chỗ chấm|số thích hợp|điền/i.test(meta.text) && subs.every((x) => dotty.test(x))) {
    let k = 0;
    const p = subs.map((x) => x.replace(/(…{2,}|\.{4,})/g, () => `[[${k++}]]`)).join('\n');
    return { ...base, type: 'fill', prompt: meta.text + '\n' + p, blanks: Array(k).fill(''), points: meta.points || 1 };
  }
  if (subs.length >= 2 && /^(Tính|Thực hiện phép tính|Tính nhẩm)\s*:?\s*$/i.test(meta.text) && subs.every((x) => !dotty.test(x) && !/=/.test(x))) {
    const p = subs.map((x, i) => `${x} = [[${i}]]`).join('\n');
    return { ...base, type: 'fill', prompt: meta.text + '\n' + p, blanks: Array(subs.length).fill(''), points: meta.points || 1, explanation: 'Phân số viết dạng a/b, ví dụ 3/4. Rút gọn kết quả nếu được.' };
  }
  const joined = rest.join('\t');
  const firstSub = joined.search(/(^|\s)[a-h]\)\s/);
  const preface = firstSub > 0 ? joined.slice(0, firstSub).trim() : '';
  const essayPrompt = subs.length >= 2 ? [meta.text, preface, ...subs].filter(Boolean).join('\n') : prompt;
  return { ...base, type: 'essay', prompt: essayPrompt.replace(/\t+/g, '   '), points: meta.points || 1, guide: '' };
}

// Tách văn bản thành từng đề (dùng cho chế độ AI đọc từng đề một)
export function splitExamTexts(text: string): { title: string; text: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { title: string; text: string[] }[] = [];
  let cur = { title: '', text: [] as string[] };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.length < 160 && EXAM_BOUNDARY.test(l) && !QSTART.test(l)) {
      if (cur.text.some((x) => QSTART.test(x.trim()))) out.push(cur);
      const m = l.match(/ĐỀ\s+(SỐ\s+)?(\d+)/i);
      cur = { title: m ? `Đề số ${m[2]}` : l, text: [] };
      continue;
    }
    cur.text.push(raw);
  }
  if (cur.text.some((x) => QSTART.test(x.trim())) || !out.length) out.push(cur);
  return out.map((c) => ({ title: c.title, text: c.text.join('\n') }));
}
