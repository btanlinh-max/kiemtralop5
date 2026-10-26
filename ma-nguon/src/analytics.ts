// Phân tích học tập: cây kỹ năng, chuỗi ngày học, huy hiệu, bảng vàng tuần, cảnh báo sớm, nhận xét cho phụ huynh.
// Tất cả tính trên máy, KHÔNG cần AI.
import type { Activity, Exam, Submission } from './types';
import { pct } from './grading';
import { subjectInfo } from './curriculum';

export interface TopicEvent { subject: string; topic: string; percent: number; at: string; source: 'exam' | Activity['kind'] }

export function topicEvents(subs: Submission[], acts: Activity[], byId: Record<string, Exam>): TopicEvent[] {
  const ev: TopicEvent[] = [];
  for (const s of subs) {
    const ex = byId[s.examId];
    if (!ex) continue;
    const m = new Map<string, { e: number; m: number }>();
    for (const r of s.results) {
      if (r.status === 'pending') continue;
      const q = ex.questions.find((x) => x.id === r.qid);
      if (!q) continue;
      const t = q.topic || 'Chưa phân loại';
      const v = m.get(t) || { e: 0, m: 0 };
      v.e += r.earned; v.m += r.max;
      m.set(t, v);
    }
    m.forEach((v, t) => v.m && ev.push({ subject: ex.subject, topic: t, percent: Math.round((v.e / v.m) * 100), at: s.submittedAt, source: 'exam' }));
  }
  for (const a of acts) if (a.topic && a.total) ev.push({ subject: a.subject, topic: a.topic, percent: a.percent, at: a.at, source: a.kind });
  return ev.sort((a, b) => a.at.localeCompare(b.at));
}

export type SkillStatus = 'green' | 'yellow' | 'red' | 'gray';
export interface Skill { subject: string; topic: string; status: SkillStatus; last: number | null; first: number | null; count: number; lastAt?: string }

export const STATUS_LABEL: Record<SkillStatus, string> = { green: 'Thành thạo', yellow: 'Cần rèn thêm', red: 'Vùng hổng', gray: 'Chưa làm' };

function statusOf(p: number): SkillStatus { return p >= 80 ? 'green' : p >= 50 ? 'yellow' : 'red'; }

// Trạng thái mỗi kỹ năng = trung bình 2 lần gần nhất (lần mới nhất đúng ≥80% thì coi là đã vững)
export function skillMap(events: TopicEvent[], withCurriculum = true): Skill[] {
  const by = new Map<string, TopicEvent[]>();
  for (const e of events) {
    const k = e.subject + '¦' + e.topic;
    by.set(k, [...(by.get(k) || []), e]);
  }
  const out: Skill[] = [];
  const subjects = new Set<string>();
  by.forEach((list, k) => {
    const [subject, topic] = k.split('¦');
    subjects.add(subject);
    const last = list[list.length - 1].percent;
    const prev = list.length > 1 ? list[list.length - 2].percent : last;
    const st = last >= 80 ? 'green' : statusOf(Math.round((last + prev) / 2));
    out.push({ subject, topic, status: st, last, first: list[0].percent, count: list.length, lastAt: list[list.length - 1].at });
  });
  if (withCurriculum) {
    for (const s of subjects) for (const t of subjectInfo(s).topics) if (!by.has(s + '¦' + t)) out.push({ subject: s, topic: t, status: 'gray', last: null, first: null, count: 0 });
  }
  return out;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('sv-SE'); // YYYY-MM-DD theo giờ máy

export function streak(dates: string[]): number {
  const days = new Set(dates.map(day));
  let n = 0;
  const d = new Date();
  if (!days.has(day(d.toISOString()))) d.setDate(d.getDate() - 1); // hôm nay chưa học vẫn giữ chuỗi
  while (days.has(day(d.toISOString()))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export interface Badge { icon: string; name: string; desc: string; got: boolean }

export function badges(skills: Skill[], subs: Submission[], acts: Activity[], streakDays: number): Badge[] {
  const green = skills.filter((s) => s.status === 'green');
  const greenMath = green.filter((s) => s.subject === 'Toán').length;
  const greenTV = green.filter((s) => s.subject === 'Tiếng Việt').length;
  const comeback = skills.some((s) => s.status === 'green' && s.first !== null && s.first < 50);
  const fast = subs.some((s) => s.score >= 9 && s.results.length && s.durationSec / s.results.length < 45);
  const subjects = new Set([...subs.map((s) => s.subject), ...acts.map((a) => a.subject)]);
  return [
    { icon: '🌱', name: 'Khởi đầu', desc: 'Hoàn thành bài đầu tiên', got: subs.length + acts.length >= 1 },
    { icon: '🔥', name: 'Chăm chỉ 3 ngày', desc: 'Học 3 ngày liên tiếp', got: streakDays >= 3 },
    { icon: '🏅', name: 'Bền bỉ 7 ngày', desc: 'Học 7 ngày liên tiếp', got: streakDays >= 7 },
    { icon: '🧮', name: 'Bậc thầy tính nhẩm', desc: 'Thành thạo 5 kỹ năng Toán', got: greenMath >= 5 },
    { icon: '📚', name: 'Nhà thám hiểm từ vựng', desc: 'Thành thạo 4 kỹ năng Tiếng Việt', got: greenTV >= 4 },
    { icon: '💪', name: 'Vượt khó', desc: 'Biến một vùng hổng thành thành thạo', got: comeback },
    { icon: '⚡', name: 'Tia chớp', desc: 'Đạt từ 9 điểm và làm nhanh', got: fast },
    { icon: '🎯', name: 'Xạ thủ', desc: 'Đạt 10 điểm một bài', got: subs.some((s) => s.score >= 10) },
    { icon: '🌈', name: 'Toàn diện', desc: 'Học từ 3 môn trở lên', got: subjects.size >= 3 },
    { icon: '🛟', name: 'Tự sửa sai', desc: 'Dùng "Giải cứu kiến thức" 5 lần', got: acts.filter((a) => a.kind === 'rescue').length >= 5 },
    { icon: '📅', name: 'Nhiệm vụ viên', desc: 'Hoàn thành 5 nhiệm vụ mỗi ngày', got: acts.filter((a) => a.kind === 'daily').length >= 5 },
    { icon: '🏆', name: 'Chiến binh ôn tập', desc: 'Hoàn thành 20 lượt luyện tập', got: acts.length >= 20 },
  ];
}

// Cây tri thức: lớn dần theo số kỹ năng thành thạo
export function treeStage(greenCount: number) {
  const stages = [
    { min: 0, icon: '🌰', name: 'Hạt mầm' },
    { min: 1, icon: '🌱', name: 'Mầm non' },
    { min: 3, icon: '🌿', name: 'Cây con' },
    { min: 6, icon: '🪴', name: 'Cây nhỏ' },
    { min: 10, icon: '🌳', name: 'Cây lớn' },
    { min: 15, icon: '🌸', name: 'Cây nở hoa' },
    { min: 20, icon: '🍎', name: 'Cây trĩu quả' },
  ];
  let i = 0;
  stages.forEach((s, k) => { if (greenCount >= s.min) i = k; });
  return { ...stages[i], next: stages[i + 1] || null, index: i, total: stages.length };
}

// Cảnh báo sớm: 1 kỹ năng sai (dưới 50%) liên tiếp 3 lần gần nhất
export function earlyWarnings(events: TopicEvent[]) {
  const by = new Map<string, TopicEvent[]>();
  for (const e of events) by.set(e.subject + '¦' + e.topic, [...(by.get(e.subject + '¦' + e.topic) || []), e]);
  const out: { subject: string; topic: string; times: number }[] = [];
  by.forEach((list, k) => {
    const last3 = list.slice(-3);
    if (last3.length === 3 && last3.every((e) => e.percent < 50)) {
      const [subject, topic] = k.split('¦');
      out.push({ subject, topic, times: list.filter((e) => e.percent < 50).length });
    }
  });
  return out;
}

// Bảng vàng tuần: điểm chuyên cần + tiến bộ (không xếp theo điểm số tuyệt đối)
export function weekStart(d = new Date()) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function weeklyBoard(subs: Submission[], acts: Activity[]) {
  const from = weekStart().toISOString();
  const by = new Map<string, { name: string; days: Set<string>; acts: number; subs: number; improve: number; mastered: number }>();
  const get = (n: string) => {
    const k = n.toLowerCase();
    if (!by.has(k)) by.set(k, { name: n, days: new Set(), acts: 0, subs: 0, improve: 0, mastered: 0 });
    return by.get(k)!;
  };
  for (const a of acts) if (a.at >= from) { const v = get(a.studentName); v.days.add(day(a.at)); v.acts++; if (a.percent >= 80) v.mastered++; }
  const sorted = [...subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const lastScore = new Map<string, number>();
  for (const s of sorted) {
    const k = s.studentName.toLowerCase() + '¦' + s.subject;
    if (s.submittedAt >= from) {
      const v = get(s.studentName);
      v.days.add(day(s.submittedAt));
      v.subs++;
      if (lastScore.has(k)) v.improve += Math.max(0, s.score - lastScore.get(k)!);
    }
    lastScore.set(k, s.score);
  }
  return [...by.values()]
    .map((v) => ({ name: v.name, days: v.days.size, points: v.days.size * 3 + v.acts + v.subs * 2 + v.mastered * 2 + Math.round(v.improve * 2) }))
    .sort((a, b) => b.points - a.points);
}

// Câu hỏi "bàn ăn tối" – gắn kiến thức với đời sống
const DINNER: [RegExp, string][] = [
  [/hình tròn|đường tròn/i, 'Đố con: muốn tính chu vi chiếc đĩa ăn cơm nhà mình thì con đo gì và tính thế nào?'],
  [/tỉ số phần trăm|phần trăm/i, 'Siêu thị giảm giá 20% chiếc áo 150 000 đồng. Con tính giúp bố mẹ xem còn phải trả bao nhiêu tiền nhé?'],
  [/vận tốc|chuyển động/i, 'Nhà mình đi xe máy 30 km/giờ thì đến nhà ông bà (cách 15 km) mất bao lâu, con tính thử xem?'],
  [/thể tích|hình hộp|lập phương/i, 'Đố con: cái hộp sữa nhà mình hình gì? Muốn biết nó đựng được bao nhiêu thì con làm thế nào?'],
  [/diện tích|ha\b|km²|đơn vị đo diện tích/i, 'Phòng khách nhà mình dài bao nhiêu, rộng bao nhiêu? Con ước lượng diện tích phòng giúp bố mẹ nhé!'],
  [/số đo đại lượng|kg|tấn/i, 'Bố mẹ mua 1 kg 250 g thịt. Con viết giúp số đó thành bao nhiêu ki-lô-gam (số thập phân) nhé?'],
  [/số thập phân|thập phân/i, 'Đố con: 2,5 kg táo và 2,05 kg cam – loại nào nặng hơn? Vì sao?'],
  [/phân số|hỗn số/i, 'Chiếc bánh chia 8 phần, cả nhà ăn 3 phần. Con nói xem đã ăn mấy phần của chiếc bánh và còn lại bao nhiêu?'],
  [/góc/i, 'Lúc 3 giờ đúng, kim giờ và kim phút tạo thành góc gì? Con chỉ trên đồng hồ nhà mình xem!'],
  [/thời gian|số đo thời gian/i, 'Con xem bộ phim dài 1 giờ 45 phút, bắt đầu lúc 19 giờ 30. Phim kết thúc lúc mấy giờ?'],
  [/tam giác|hình thang/i, 'Con tìm giúp bố mẹ 2 đồ vật trong nhà có dạng hình tam giác hoặc hình thang nhé!'],
  [/thống kê|xác suất/i, 'Gieo đồng xu 10 lần thì con nghĩ mặt sấp xuất hiện khoảng mấy lần? Cả nhà thử cùng con nhé!'],
  [/số tự nhiên|chữ số|triệu/i, 'Đố con đọc số dân của nước mình (khoảng 101 000 000 người) và cho biết chữ số 1 đầu tiên có giá trị bao nhiêu?'],
  [/giải toán|lời văn/i, 'Con kể cho bố mẹ nghe một bài toán có lời văn hôm nay con làm, và con giải thế nào nhé!'],
  [/đồng nghĩa/i, 'Đố con tìm 3 từ cùng nghĩa với "chăm chỉ". Bố mẹ cũng tìm, xem ai nhiều hơn!'],
  [/đa nghĩa/i, 'Từ "chân" trong "chân bàn" và "chân người" khác nhau thế nào? Con tìm thêm từ "chân" khác nhé!'],
  [/đại từ/i, 'Trong bữa ăn, con để ý xem cả nhà dùng những từ xưng hô nào (tôi, mình, nó, chúng ta…) nhé!'],
  [/kết từ/i, 'Con đặt một câu kể về bữa tối có dùng từ "nhưng" hoặc "vì… nên…" nhé!'],
  [/câu ghép|vế câu/i, 'Con nói một câu có hai vế kể về việc hôm nay của con, ví dụ: "Trời mưa nhưng con vẫn đi học đúng giờ."'],
  [/trạng ngữ|chủ ngữ|vị ngữ/i, 'Bố mẹ nói một câu, con thử tìm chủ ngữ và vị ngữ trong câu đó nhé!'],
  [/đọc hiểu/i, 'Con kể lại cho bố mẹ nghe câu chuyện con đọc gần đây và điều con thích nhất trong đó nhé!'],
  [/viết|tả|kể chuyện/i, 'Con tả thử món ăn ngon nhất trên mâm cơm hôm nay bằng 3 câu thật hay nhé!'],
];
export function dinnerQuestion(topic: string) {
  for (const [re, q] of DINNER) if (re.test(topic)) return q;
  return 'Hôm nay ở lớp con học điều gì thú vị nhất? Con giảng lại cho bố mẹ nghe như một thầy cô giáo nhé!';
}

// Lời nhận xét khích lệ (tư duy phát triển) – không so sánh với bạn khác
const firstName = (n: string) => n.trim().split(/\s+/).slice(-1)[0];
export function attemptComment(o: { name: string; title: string; percent: number; durationSec: number; total: number; strong?: string; weak?: string; kind: 'exam' | Activity['kind']; improved?: number }) {
  const n = firstName(o.name);
  const mins = Math.max(1, Math.round(o.durationSec / 60));
  const parts: string[] = [];
  if (o.kind === 'exam') parts.push(`Con ${n} đã hoàn thành "${o.title}" (${o.total} câu) trong ${mins} phút.`);
  else parts.push(`Hôm nay con ${n} đã tự ôn tập "${o.title}" (${o.total} câu, ${mins} phút).`);
  if (o.percent >= 90) parts.push(`Con làm đúng ${o.percent}% – rất chắc kiến thức!`);
  else if (o.percent >= 70) parts.push(`Con làm đúng ${o.percent}% – đang tiến bộ tốt.`);
  else if (o.percent >= 50) parts.push(`Con làm đúng ${o.percent}%, con đã nắm được phần cơ bản.`);
  else parts.push(`Con đã rất cố gắng hoàn thành bài; phần này còn mới với con nên cần luyện thêm một chút.`);
  if (o.improved && o.improved > 0) parts.push(`Tăng ${o.improved}% so với lần trước – sự kiên trì của con đang có kết quả!`);
  if (o.strong) parts.push(`Điểm sáng: ${o.strong}.`);
  if (o.weak && o.percent < 80) parts.push(`Cần đồng hành thêm: ${o.weak}.`);
  parts.push(o.percent >= 80 ? 'Bố mẹ khen con một câu để con giữ vững phong độ nhé!' : 'Bố mẹ động viên con mỗi ngày luyện 5–10 phút trong "Góc ôn tập" nhé!');
  return parts.join(' ');
}

export function pctOf(t: { earned: number; max: number }) { return pct(t); }
