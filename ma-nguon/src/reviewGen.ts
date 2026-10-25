import type { Exam, Question, Review, Submission } from './types';
import { askJson, cleanQuestions, QUESTION_SCHEMA } from './ai';
import { gaps, pct, shuffleArr, topicStats, uid } from './grading';
import { plain } from './components/Rich';

export function examMap(exams: Exam[]) {
  return Object.fromEntries(exams.map((e) => [e.id, e])) as Record<string, Exam>;
}

// Câu luyện thêm lấy từ kho đề (không cần AI): cùng môn + cùng chủ đề, chấm tự động được
export function bankPractice(exams: Exam[], subject: string, topic: string, excludeKeys: string[] = [], n = 8): Question[] {
  const pool: Question[] = [];
  for (const e of exams) {
    if (e.subject !== subject) continue;
    for (const q of e.questions) {
      if (q.topic !== topic || q.type === 'essay') continue;
      if (q.type === 'mcq' && (q.answer ?? -1) < 0) continue;
      if (q.type === 'short' && !(q.accepted || []).length) continue;
      if (excludeKeys.includes(e.id + ':' + q.id)) continue;
      if (q.passageId) continue; // câu đọc hiểu cần bài đọc đi kèm
      pool.push({ ...q, id: uid('q') });
    }
  }
  return shuffleArr(pool).slice(0, n);
}

export function wrongQuestions(stat: { wrongQids: string[] }, byId: Record<string, Exam>) {
  return stat.wrongQids
    .map((k) => {
      const [eid, qid] = k.split(':');
      const ex = byId[eid];
      const q = ex?.questions.find((x) => x.id === qid);
      return q ? { q, passage: ex.passages.find((p) => p.id === q.passageId) } : null;
    })
    .filter(Boolean) as { q: Question; passage?: { title: string; content: string } }[];
}

function describeQ(q: Question) {
  let s = plain(q.prompt);
  if (q.type === 'mcq') s += ' | Các lựa chọn: ' + (q.options || []).map((o, i) => 'ABCD'[i] + '. ' + plain(o)).join('; ') + ' | Đáp án đúng: ' + 'ABCD'[q.answer ?? 0];
  if (q.type === 'fill') s += ' | Đáp án: ' + (q.blanks || []).join('; ');
  if (q.type === 'short') s += ' | Đáp án: ' + (q.accepted || []).join('; ');
  if (q.type === 'essay' && q.guide) s += ' | Hướng dẫn: ' + plain(q.guide);
  return s;
}

// AI soạn bài ôn RIÊNG cho 1 học sinh, dựa trên những câu em đã làm sai
export async function aiReview(opts: { subject: string; topic: string; wrong: { q: Question }[]; studentLabel?: string; percent?: number }): Promise<Pick<Review, 'summary' | 'example' | 'tips' | 'questions'>> {
  const wrongTxt = opts.wrong.slice(0, 6).map((w, i) => `${i + 1}) ${describeQ(w.q)}`).join('\n');
  const prompt = `Học sinh lớp 5 (bộ sách Kết nối tri thức) đang bị HỔNG kiến thức môn ${opts.subject}, phần "${opts.topic}"${opts.percent !== undefined ? ` (chỉ đạt ${opts.percent}% số điểm phần này)` : ''}.
Các câu em đã làm sai:
${wrongTxt || '(không có chi tiết)'}

Hãy soạn một BÀI ÔN TẬP RIÊNG ngắn gọn, dễ hiểu, giọng thân thiện (xưng "em"), gồm:
- "summary": Kiến thức cần nhớ (3–6 gạch đầu dòng, mỗi dòng bắt đầu bằng "• ", có quy tắc/công thức then chốt).
- "example": 1 ví dụ mẫu giải chi tiết từng bước, giống dạng bài em hay sai.
- "tips": 1–2 câu nhắc lỗi hay gặp và mẹo tránh.
- "questions": 6 câu luyện tập từ dễ đến khó (2 câu Mức 1, 3 câu Mức 2, 1 câu Mức 3), cùng dạng với các câu em sai nhưng KHÁC số liệu. Chỉ dùng các dạng chấm tự động được: mcq, tf, fill, short. Mỗi câu 1 điểm, topic = "${opts.topic}", có "explanation" giải thích ngắn.
${QUESTION_SCHEMA}
Trả về JSON: {"summary": "...", "example": "...", "tips": "...", "questions": [...]}`;
  const r = await askJson<any>(prompt);
  const questions = cleanQuestions(r.questions || [], opts.topic).filter((q) => q.type !== 'essay');
  return { summary: String(r.summary || ''), example: String(r.example || ''), tips: String(r.tips || ''), questions };
}

// Bài ôn tự động (không cần AI)
export function autoReview(exams: Exam[], subject: string, topic: string, exclude: string[]): Pick<Review, 'summary' | 'example' | 'tips' | 'questions'> {
  return {
    summary: '',
    example: '',
    tips: 'Em đọc kĩ đề, làm ra nháp, rồi kiểm tra lại kết quả trước khi chọn đáp án nhé!',
    questions: bankPractice(exams, subject, topic, exclude, 8),
  };
}

export function studentGaps(subs: Submission[], exams: Exam[]) {
  const byId = examMap(exams);
  const stats = topicStats(subs, byId);
  return { stats, gaps: gaps(stats), byId };
}

export function newReview(base: { classCode: string; ownerUid?: string; className: string; studentName: string; subject: string; topic: string; createdBy: string; source: Review['source'] }, content: Pick<Review, 'summary' | 'example' | 'tips' | 'questions'>): Review {
  return { id: uid('r'), ...base, ...content, createdAt: new Date().toISOString(), attempts: 0, best: 0, mastered: false };
}

export { pct };
