import type { Exam, Question, QResult, Submission } from './types';

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Chuẩn hoá câu trả lời để so sánh: bỏ dấu cách thừa, 5,07 = 5.07, 3 000 = 3000, không phân biệt hoa thường
export function norm(s: any): string {
  let t = String(s ?? '').toLowerCase().normalize('NFC').trim();
  t = t.replace(/\{(\d+)\/(\d+)\}/g, '$1/$2').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2');
  t = t.replace(/(\d)\s+(?=\d{3}(\D|$))/g, '$1').replace(/(\d)\s+(?=\d{3}(\D|$))/g, '$1'); // 3 000 000 -> 3000000
  t = t.replace(/(\d),(\d)/g, '$1.$2');
  t = t.replace(/[“”"'.!?;:]+$/g, '').replace(/\s+/g, ' ');
  t = t.replace(/\s*([+\-×x*:/=<>])\s*/g, '$1');
  return t.trim();
}

function numVal(s: string): number | null {
  const t = norm(s);
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const f = t.match(/^(\d+)\/(\d+)$/);
  if (f && +f[2] !== 0) return +f[1] / +f[2];
  return null;
}

export function sameAnswer(given: string, expected: string): boolean {
  const alts = String(expected).split('|').map((x) => x.trim()).filter(Boolean);
  const g = norm(given);
  if (!g) return false;
  return alts.some((a) => {
    if (norm(a) === g) return true;
    const x = numVal(a), y = numVal(given);
    return x !== null && y !== null && Math.abs(x - y) < 1e-9 && !/\//.test(a) === !/\//.test(given);
  });
}

export function gradeQuestion(q: Question, ans: any): QResult {
  const max = q.points || 0;
  const r = (earned: number, status: QResult['status']): QResult => ({ qid: q.id, earned: Math.round(earned * 100) / 100, max, status });
  switch (q.type) {
    case 'mcq': {
      if (ans === undefined || ans === null) return r(0, 'wrong');
      return q.answer === ans ? r(max, 'right') : r(0, 'wrong');
    }
    case 'tf': {
      const exp = q.tfAnswers || [];
      if (!exp.length) return r(0, 'wrong');
      const arr: (boolean | undefined)[] = ans || [];
      const ok = exp.filter((v, i) => arr[i] === v).length;
      return r((max * ok) / exp.length, ok === exp.length ? 'right' : ok ? 'partial' : 'wrong');
    }
    case 'fill': {
      const exp = q.blanks || [];
      if (!exp.length) return r(0, 'wrong');
      const arr: string[] = ans || [];
      const ok = exp.filter((e, i) => sameAnswer(arr[i] || '', e)).length;
      return r((max * ok) / exp.length, ok === exp.length ? 'right' : ok ? 'partial' : 'wrong');
    }
    case 'match': {
      const pairs = q.pairs || [];
      if (!pairs.length) return r(0, 'wrong');
      const arr: (number | undefined)[] = ans || []; // arr[i] = chỉ số vế phải nối với vế trái i
      const ok = pairs.filter((_, i) => arr[i] === i).length;
      return r((max * ok) / pairs.length, ok === pairs.length ? 'right' : ok ? 'partial' : 'wrong');
    }
    case 'order': {
      const items = q.items || [];
      const arr: string[] = ans || [];
      if (!items.length || arr.length !== items.length) return r(0, 'wrong');
      const ok = items.filter((it, i) => arr[i] === it).length;
      return ok === items.length ? r(max, 'right') : r(0, 'wrong');
    }
    case 'short': {
      const acc = q.accepted || [];
      if (!acc.length) return r(0, 'pending');
      return acc.some((a) => sameAnswer(ans || '', a)) ? r(max, 'right') : r(0, 'wrong');
    }
    case 'essay': {
      // Có đáp số → chấm ngay phần đáp số, phần trình bày chờ cô chấm
      const keys = (q.keys || []).filter((k) => k.trim());
      if (!keys.length) return { qid: q.id, earned: 0, max, status: 'pending' };
      const kp = Math.min(max, q.keyPoints ?? max / 2);
      const given: string[] = (ans && ans.keys) || [];
      const ok = keys.filter((k, i) => sameAnswer(given[i] || '', keyValue(k))).length;
      return { qid: q.id, earned: Math.round(((kp * ok) / keys.length) * 100) / 100, max, status: 'pending', auto: ok + '/' + keys.length } as QResult;
    }
  }
}

export function gradeAll(exam: Pick<Exam, 'questions'>, answers: Record<string, any>) {
  const results = exam.questions.map((q) => gradeQuestion(q, answers[q.id]));
  return summarize(results);
}

export function summarize(results: QResult[]) {
  const raw = results.reduce((s, x) => s + x.earned, 0);
  const rawMax = results.reduce((s, x) => s + x.max, 0) || 1;
  const score = Math.round((raw / rawMax) * 100) / 10; // thang 10, 1 chữ số thập phân
  const pending = results.some((x) => x.status === 'pending');
  return { results, raw: Math.round(raw * 100) / 100, rawMax, score, pending };
}

// Xếp loại theo TT27 cho bài kiểm tra định kỳ: điểm làm tròn
export function rank(score: number): { label: string; cls: string } {
  if (score >= 9) return { label: 'Hoàn thành tốt', cls: 'bg-emerald-100 text-emerald-800' };
  if (score >= 5) return { label: 'Hoàn thành', cls: 'bg-sky-100 text-sky-800' };
  return { label: 'Chưa hoàn thành', cls: 'bg-rose-100 text-rose-800' };
}

export interface TopicStat {
  subject: string;
  topic: string;
  earned: number;
  max: number;
  count: number;
  wrongQids: string[];
}

// Thống kê theo chủ đề cho 1 hoặc nhiều bài làm
export function topicStats(subs: Submission[], examsById: Record<string, Exam>): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const s of subs) {
    const ex = examsById[s.examId];
    if (!ex) continue;
    for (const r of s.results) {
      if (r.status === 'pending') continue;
      const q = ex.questions.find((x) => x.id === r.qid);
      if (!q) continue;
      const topic = q.topic || 'Chưa phân loại';
      const k = ex.subject + '¦' + topic;
      const t = map.get(k) || { subject: ex.subject, topic, earned: 0, max: 0, count: 0, wrongQids: [] };
      t.earned += r.earned;
      t.max += r.max;
      t.count++;
      if (r.status !== 'right') t.wrongQids.push(ex.id + ':' + q.id);
      map.set(k, t);
    }
  }
  return [...map.values()].sort((a, b) => pct(a) - pct(b));
}

export const pct = (t: { earned: number; max: number }) => (t.max ? Math.round((t.earned / t.max) * 100) : 0);

// Phần "hổng": tỉ lệ đúng dưới 70%
export const GAP_THRESHOLD = 70;
export function gaps(stats: TopicStat[]) {
  return stats.filter((t) => t.max > 0 && pct(t) < GAP_THRESHOLD);
}

export function shuffleArr<T>(a: T[], seed?: number): T[] {
  const arr = [...a];
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function fmtDur(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m} phút ${s.toString().padStart(2, '0')} giây`;
}

// Tên hiển thị: bỏ phần thừa, chuẩn hoá hoa đầu từ
export function cleanName(s: string) {
  return s.trim().replace(/\s+/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Đáp số tự luận có thể ghi kèm nhãn: "a) m²=15000" → nhãn "a) m²", giá trị "15000"
export function keyLabel(k: string, i: number, n: number) {
  const m = k.match(/^([^=]{1,20})=(.+)$/);
  if (m) return /^[a-h]$/i.test(m[1].trim()) ? m[1].trim() + ')' : m[1].trim();
  return n > 1 ? String.fromCharCode(97 + i) + ')' : '';
}
export function keyValue(k: string) {
  const m = k.match(/^([^=]{1,20})=(.+)$/);
  return m ? m[2].trim() : k;
}
