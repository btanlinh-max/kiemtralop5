// Gọi Gemini trực tiếp từ trình duyệt bằng MÃ RIÊNG của từng người dùng (lưu trên máy của họ).
// Không dùng chung mã của ai → không ai bị tốn lượt của người khác.
import type { Level, Question, QType } from './types';
import { uid } from './grading';

const KEY = 'kt5_gemini_key';
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];

export function getKey(): string {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setKey(k: string) {
  try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch {}
}
export const hasKey = () => !!getKey();

export class AiError extends Error {}

async function callModel(model: string, body: any, key: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Lỗi ${res.status}`;
    const err: any = new AiError(msg);
    err.status = res.status;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new AiError('AI không trả lời (có thể nội dung bị chặn). Thử lại với nội dung khác.');
  return text;
}

export async function ask(prompt: string, opts: { json?: boolean; files?: { mime: string; data: string }[]; system?: string } = {}): Promise<string> {
  const key = getKey();
  if (!key) throw new AiError('Chưa có mã AI. Vào ⚙️ Cài đặt → "Mã AI Gemini" để dán mã của bạn (miễn phí).');
  const parts: any[] = [];
  for (const f of opts.files || []) parts.push({ inline_data: { mime_type: f.mime, data: f.data } });
  parts.push({ text: prompt });
  const body: any = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  let last: any;
  for (const m of MODELS) {
    try {
      return await callModel(m, body, key);
    } catch (e: any) {
      last = e;
      if (e.status === 400 && /api key|API_KEY/i.test(e.message)) throw new AiError('Mã AI không đúng. Kiểm tra lại mã trong ⚙️ Cài đặt.');
      if (e.status === 401 || e.status === 403) throw new AiError('Mã AI không có quyền dùng (lỗi ' + e.status + '): ' + e.message);
      if (e.status === 404 || e.status === 429 || e.status >= 500) continue; // thử mô hình khác
      throw e;
    }
  }
  if (last?.status === 429) throw new AiError('Mã AI đã hết lượt dùng miễn phí trong phút/ngày này. Đợi một lát rồi thử lại.');
  throw last || new AiError('Không gọi được AI.');
}

export async function askJson<T = any>(prompt: string, opts: { files?: { mime: string; data: string }[] } = {}): Promise<T> {
  const txt = await ask(prompt, { ...opts, json: true, system: SYSTEM });
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new AiError('AI trả về dữ liệu không đúng định dạng, hãy thử lại.');
  }
}

const SYSTEM = `Bạn là chuyên gia giáo dục tiểu học Việt Nam, am hiểu Chương trình GDPT 2018, bộ sách "Kết nối tri thức với cuộc sống" lớp 5 và Thông tư 27/2020/TT-BGDĐT (3 mức: Mức 1 nhận biết, Mức 2 kết nối/hiểu, Mức 3 vận dụng).
Viết tiếng Việt chuẩn, phù hợp học sinh 10–11 tuổi. Phân số viết dạng {tử/mẫu} (ví dụ {3/4}, hỗn số 2{1/2}). Số thập phân dùng dấu phẩy (5,07). Đơn vị dùng m², cm³...
Chỉ trả về JSON hợp lệ, không thêm chữ nào khác.`;

export const QUESTION_SCHEMA = `Mỗi câu hỏi là object:
{"type": "mcq"|"tf"|"fill"|"match"|"order"|"short"|"essay",
 "prompt": "nội dung câu hỏi (với fill: viết chỗ trống là [[đáp án]] ngay trong câu, nhiều đáp án chấp nhận ngăn bởi |)",
 "options": ["...","...","...","..."] (mcq, không ghi A. B.),
 "answer": "A"|"B"|"C"|"D" – CHỮ CÁI của đáp án đúng (mcq), "answerText": "chép NGUYÊN VĂN nội dung lựa chọn đúng" (mcq, để đối chiếu),
 "statements": ["..."], "tfAnswers": [true,false,...] (tf),
 "pairs": [["vế trái","vế phải"],...] (match, đúng cặp),
 "items": ["bước 1","bước 2",...] (order, đúng thứ tự),
 "accepted": ["đáp án 1","cách viết khác"] (short),
 "guide": "hướng dẫn chấm/đáp án mẫu" (essay), "keys": ["đáp số ý a", "đáp số ý b"] (essay là bài tính/giải toán có đáp số ngắn; bài văn thì bỏ),
 "points": số điểm, "level": 1|2|3, "topic": "chủ đề/bài", "explanation": "giải thích ngắn vì sao đúng (để học sinh xem lại)"}`;

// Chuẩn hoá câu hỏi AI trả về
export function cleanQuestions(arr: any[], fallbackTopic = ''): Question[] {
  const okTypes: QType[] = ['mcq', 'tf', 'fill', 'match', 'order', 'short', 'essay'];
  return (Array.isArray(arr) ? arr : [])
    .map((x: any): Question | null => {
      if (!x || !x.prompt) return null;
      let type: QType = okTypes.includes(x.type) ? x.type : x.options ? 'mcq' : 'essay';
      const q: Question = {
        id: uid('q'),
        type,
        prompt: String(x.prompt).trim(),
        points: Number(x.points) > 0 ? Number(x.points) : 1,
        level: ([1, 2, 3].includes(Number(x.level)) ? Number(x.level) : 2) as Level,
        topic: String(x.topic || fallbackTopic || '').trim(),
        explanation: x.explanation ? String(x.explanation) : '',
        passageId: x.passageId,
      };
      if (type === 'mcq') {
        q.options = (x.options || []).map((o: any) => String(o).replace(/^[A-D]\s*[.)]\s*/, ''));
        q.answer = resolveMcqAnswer(q.options || [], x.answer, x.answerText);
        if ((q.options || []).length < 2) return null;
      }
      if (type === 'tf') {
        q.statements = (x.statements || []).map(String);
        q.tfAnswers = (x.tfAnswers || []).map((v: any) => v === true || v === 'true' || v === 'Đ');
        if (!q.statements!.length) return null;
      }
      if (type === 'fill') {
        const blanks: string[] = [];
        q.prompt = q.prompt.replace(/\[\[(.*?)\]\]/g, (_, a) => {
          blanks.push(a);
          return '[[' + (blanks.length - 1) + ']]';
        });
        q.blanks = blanks;
        if (!blanks.length) type = q.type = 'short';
      }
      if (type === 'match') {
        q.pairs = (x.pairs || []).filter((p: any) => Array.isArray(p) && p.length >= 2).map((p: any) => [String(p[0]), String(p[1])]);
        if ((q.pairs || []).length < 2) return null;
      }
      if (type === 'order') {
        q.items = (x.items || []).map(String);
        if ((q.items || []).length < 2) return null;
      }
      if (type === 'short') q.accepted = (x.accepted || (x.answer !== undefined ? [x.answer] : [])).map(String);
      if (type === 'essay') { q.guide = String(x.guide || x.answer || ''); if (Array.isArray(x.keys) && x.keys.length) q.keys = x.keys.map(String); }
      return q;
    })
    .filter(Boolean) as Question[];
}

// Xác định đáp án trắc nghiệm AI trả về một cách an toàn:
// ưu tiên đối chiếu NỘI DUNG đáp án, rồi đến chữ cái A/B/C/D, cuối cùng mới đến số thứ tự.
const normOpt = (t: any) => String(t ?? '').toLowerCase().normalize('NFC').replace(/^[a-d]\s*[.)]\s*/i, '').replace(/[{}\s.]/g, '').replace(/,/g, '.');
export function resolveMcqAnswer(options: string[], answer: any, answerText?: any): number {
  if (answerText !== undefined && answerText !== null && String(answerText).trim()) {
    const t = normOpt(answerText);
    const exact = options.findIndex((o) => normOpt(o) === t);
    if (exact >= 0) return exact;
  }
  if (typeof answer === 'string') {
    const a = answer.trim();
    const m = a.match(/^\(?([A-Ha-h])\)?([.):\s]|$)/);
    if (m) { const i = 'ABCDEFGH'.indexOf(m[1].toUpperCase()); if (i < options.length) return i; }
    const byText = options.findIndex((o) => normOpt(o) === normOpt(a));
    if (byText >= 0) return byText;
    if (/^\d+$/.test(a)) answer = +a; else return -1;
  }
  if (typeof answer === 'number' && Number.isInteger(answer)) {
    if (answer >= 0 && answer < options.length) return answer;
    if (answer === options.length) return answer - 1; // AI đếm từ 1
  }
  return -1;
}
