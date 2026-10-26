// Các thành phần dùng chung cho học sinh / phụ huynh / giáo viên: cây kỹ năng, cây tri thức, huy hiệu, bảng vàng, phiếu báo cáo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Volume2, Copy } from 'lucide-react';
import type { Activity, ClassRoom, Exam, Review, Submission } from '../types';
import { classActs, classReviews, classSubs, getExam } from '../api';
import { badges, dinnerQuestion, earlyWarnings, skillMap, STATUS_LABEL, streak, topicEvents, treeStage, weeklyBoard, type Skill } from '../analytics';
import { subjectInfo } from '../curriculum';
import { fmtDate, rank } from '../grading';
import { Btn, Card, toast, copyText } from './ui';
import { speak } from './QuestionView';
import { safeName } from '../exporters';

// Tải toàn bộ dữ liệu học tập của 1 học sinh
export function useStudentData(classCode: string, name: string, knownExams: Exam[] = []) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [byId, setById] = useState<Record<string, Exam>>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!classCode || !name) return;
    let off = false;
    (async () => {
      setLoading(true);
      try {
        const f = { studentName: name };
        const [s, a, r] = await Promise.all([classSubs(classCode, f), classActs(classCode, f), classReviews(classCode, f)]);
        const map: Record<string, Exam> = Object.fromEntries(knownExams.map((e) => [e.id, e]));
        for (const id of new Set(s.map((x) => x.examId))) if (!map[id]) { try { const e = await getExam(id); if (e) map[id] = e; } catch {} }
        if (off) return;
        setSubs(s.sort((x, y) => x.submittedAt.localeCompare(y.submittedAt)));
        setActs(a.sort((x, y) => x.at.localeCompare(y.at)));
        setReviews(r);
        setById(map);
      } catch {
        // mất mạng: dùng dữ liệu lưu trên máy
        try {
          setSubs(JSON.parse(localStorage.getItem('kt5_mysubs') || '[]').filter((x: Submission) => x.classCode === classCode && x.studentName === name));
          setActs(JSON.parse(localStorage.getItem('kt5_myacts') || '[]').filter((x: Activity) => x.classCode === classCode && x.studentName === name));
        } catch {}
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [classCode, name, tick, knownExams.length]);
  const events = useMemo(() => topicEvents(subs, acts, byId), [subs, acts, byId]);
  const skills = useMemo(() => skillMap(events), [events]);
  const days = useMemo(() => streak([...subs.map((s) => s.submittedAt), ...acts.map((a) => a.at)]), [subs, acts]);
  const warn = useMemo(() => earlyWarnings(events), [events]);
  return { subs, acts, reviews, byId, events, skills, streakDays: days, warnings: warn, loading, reload: () => setTick((t) => t + 1) };
}

const CHIP: Record<string, string> = {
  green: 'bg-emerald-500 text-white border-emerald-600',
  yellow: 'bg-amber-300 text-amber-950 border-amber-400',
  red: 'bg-rose-500 text-white border-rose-600',
  gray: 'bg-slate-100 text-slate-400 border-slate-200',
};

export function SkillTree({ skills, compact }: { skills: Skill[]; compact?: boolean }) {
  const subjects = [...new Set(skills.map((s) => s.subject))];
  if (!skills.length) return <div className="text-sm text-slate-500 font-bold">Chưa có dữ liệu – làm bài kiểm tra hoặc luyện tập để hiện bản đồ kỹ năng.</div>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        {(['green', 'yellow', 'red', 'gray'] as const).map((k) => <span key={k} className={`rounded-full border px-2 py-0.5 ${CHIP[k]}`}>{STATUS_LABEL[k]}</span>)}
      </div>
      {subjects.map((sub) => {
        const list = skills.filter((s) => s.subject === sub);
        const done = list.filter((s) => s.status === 'green').length;
        return (
          <div key={sub}>
            <div className="font-black text-slate-700 text-sm mb-1.5">{subjectInfo(sub).icon} {sub} <span className="text-emerald-700">– thành thạo {done}/{list.length}</span></div>
            <div className="flex flex-wrap gap-1.5">
              {list.sort((a, b) => ['red', 'yellow', 'green', 'gray'].indexOf(a.status) - ['red', 'yellow', 'green', 'gray'].indexOf(b.status)).map((s) => (
                <span key={s.topic} title={s.last !== null ? `Lần gần nhất: ${s.last}%` : 'Chưa làm'} className={`rounded-xl border-2 px-2.5 py-1 ${compact ? 'text-[11px]' : 'text-xs'} font-bold ${CHIP[s.status]}`}>
                  {s.topic}{s.last !== null && <span className="opacity-80"> · {s.last}%</span>}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TreeAndBadges({ skills, subs, acts, streakDays }: { skills: Skill[]; subs: Submission[]; acts: Activity[]; streakDays: number }) {
  const green = skills.filter((s) => s.status === 'green').length;
  const st = treeStage(green);
  const bs = badges(skills, subs, acts, streakDays);
  return (
    <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <div className="rounded-3xl bg-gradient-to-b from-sky-100 to-emerald-100 border-2 border-emerald-200 p-4 text-center">
        <div className="text-7xl leading-none drop-shadow">{st.icon}</div>
        <div className="font-black text-emerald-800 mt-1">Cây tri thức: {st.name}</div>
        <div className="text-xs font-bold text-slate-600">{green} kỹ năng thành thạo{st.next ? ` • còn ${st.next.min - green} để thành "${st.next.name}"` : ' • cây đã trĩu quả!'}</div>
        <div className="flex justify-center gap-1 mt-2">{Array.from({ length: st.total }).map((_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i <= st.index ? 'bg-emerald-500' : 'bg-white'}`} />)}</div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-black text-orange-600 border-2 border-orange-200">🔥 {streakDays} ngày học liên tiếp</div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {bs.map((b) => (
          <div key={b.name} title={b.desc} className={`rounded-2xl border-2 p-2 text-center ${b.got ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-50 grayscale'}`}>
            <div className="text-3xl">{b.icon}</div>
            <div className="text-[11px] font-black leading-tight mt-0.5">{b.name}</div>
            <div className="text-[10px] text-slate-500 leading-tight">{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeeklyBoard({ classCode, highlight }: { classCode: string; highlight?: string }) {
  const [rows, setRows] = useState<{ name: string; days: number; points: number }[] | null>(null);
  useEffect(() => {
    Promise.all([classSubs(classCode), classActs(classCode)]).then(([s, a]) => setRows(weeklyBoard(s, a).slice(0, 10))).catch(() => setRows([]));
  }, [classCode]);
  if (!rows) return <div className="text-sm text-slate-500">Đang tải…</div>;
  if (!rows.length) return <div className="text-sm text-slate-500 font-bold">Tuần này chưa có ai luyện tập – em hãy là người đầu tiên! 🚀</div>;
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-500 font-bold">Tính theo <b>chuyên cần</b> (số ngày học, số lượt luyện) và <b>tiến bộ</b> – không xếp theo điểm.</div>
      {rows.map((r, i) => (
        <div key={r.name} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${highlight && r.name.toLowerCase() === highlight.toLowerCase() ? 'border-orange-400 bg-orange-50' : 'border-slate-100 bg-white'}`}>
          <span className="w-7 text-center font-black">{medal[i] || i + 1}</span>
          <span className="flex-1 font-bold">{r.name}</span>
          <span className="text-xs text-slate-500 font-bold">{r.days} ngày</span>
          <span className="font-black text-orange-600">{r.points} ⭐</span>
        </div>
      ))}
    </div>
  );
}

// Phiếu báo cáo dạng ảnh (story) gửi phụ huynh qua Zalo
export function ReportCard({ name, cls, subs, acts, skills, streakDays, teacherNote }: { name: string; cls: ClassRoom | null; subs: Submission[]; acts: Activity[]; skills: Skill[]; streakDays: number; teacherNote?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const wSubs = subs.filter((s) => s.submittedAt >= week);
  const wActs = acts.filter((a) => a.at >= week);
  const minutes = Math.round((wSubs.reduce((a, s) => a + s.durationSec, 0) + wActs.reduce((a, x) => a + x.durationSec, 0)) / 60);
  const qCount = wSubs.reduce((a, s) => a + s.results.length, 0) + wActs.reduce((a, x) => a + x.total, 0);
  const secPerQ = qCount ? Math.round(((wSubs.reduce((a, s) => a + s.durationSec, 0) + wActs.reduce((a, x) => a + x.durationSec, 0)) / qCount)) : 0;
  const improved = skills.filter((s) => s.first !== null && s.last !== null && s.last - s.first >= 20 && s.count > 1).sort((a, b) => (b.last! - b.first!) - (a.last! - a.first!));
  const strong = skills.filter((s) => s.status === 'green').sort((a, b) => (b.last || 0) - (a.last || 0));
  const bright = improved[0] ? `${improved[0].topic}: tiến bộ từ ${improved[0].first}% lên ${improved[0].last}%` : strong[0] ? `${strong[0].topic}: đúng ${strong[0].last}%` : 'Con đã bắt đầu hành trình ôn luyện';
  const focus = skills.filter((s) => s.status === 'red' || s.status === 'yellow').sort((a, b) => (a.last || 0) - (b.last || 0))[0];
  const dinner = dinnerQuestion(focus?.topic || strong[0]?.topic || '');
  const fn = name.split(' ').slice(-1)[0];
  const bulletin = `Chào bố mẹ! Tuần này con ${fn} đã học ${minutes} phút, làm ${qCount} câu hỏi${streakDays > 1 ? `, học liên tục ${streakDays} ngày` : ''}. Điểm sáng: ${bright}. ${focus ? `Con cần bố mẹ đồng hành thêm ở phần ${focus.topic}.` : 'Con đang nắm chắc các phần đã học.'} Gợi ý cho bữa tối: ${dinner}`;

  const save = async () => {
    if (!ref.current) return;
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#fffbeb' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu-tuan-${safeName(name)}.png`;
      a.click();
    } catch (e: any) { toast('Không tạo được ảnh: ' + e.message, 'err'); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Btn small onClick={save}><Download className="w-3.5 h-3.5" /> Tải ảnh phiếu (gửi Zalo)</Btn>
        <Btn small variant="ghost" onClick={() => speak(bulletin)}><Volume2 className="w-3.5 h-3.5" /> Nghe bản tin 30 giây</Btn>
        <Btn small variant="ghost" onClick={() => copyText(bulletin, 'Đã chép bản tin')}><Copy className="w-3.5 h-3.5" /> Chép bản tin</Btn>
      </div>
      <div ref={ref} className="rounded-[28px] border-4 border-amber-300 bg-amber-50 p-4 max-w-[420px] mx-auto">
        <div className="rounded-2xl p-3 text-white text-center" style={{ background: 'linear-gradient(135deg,#059669,#0d9488 45%,#d97706)' }}>
          <div className="text-[10px] font-bold opacity-90 uppercase">{cls?.school || ''}</div>
          <div className="text-lg font-black">BẢN TIN HỌC TẬP TUẦN</div>
          <div className="text-sm font-bold">{name} – Lớp {cls?.name || ''}</div>
          <div className="text-[10px] opacity-90">{new Date(week).toLocaleDateString('vi-VN')} – {new Date().toLocaleDateString('vi-VN')}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 my-3 text-center">
          <div className="bg-white rounded-xl p-2"><div className="text-xl font-black text-orange-500">{minutes}′</div><div className="text-[10px] font-bold text-slate-500">Thời gian học</div></div>
          <div className="bg-white rounded-xl p-2"><div className="text-xl font-black text-sky-600">{qCount}</div><div className="text-[10px] font-bold text-slate-500">Câu đã làm</div></div>
          <div className="bg-white rounded-xl p-2"><div className="text-xl font-black text-emerald-600">🔥{streakDays}</div><div className="text-[10px] font-bold text-slate-500">Ngày liên tiếp</div></div>
        </div>
        {secPerQ > 0 && <div className="text-[11px] text-center font-bold text-slate-600 -mt-1 mb-2">⏱️ Trung bình {secPerQ} giây mỗi câu</div>}
        <div className="bg-white rounded-xl p-3 text-[13px] space-y-2">
          <div><b className="text-emerald-700">🌟 Điểm sáng:</b> {bright}</div>
          {focus && <div><b className="text-rose-700">🎯 Điểm cần đồng hành:</b> {focus.topic}{focus.last !== null ? ` (lần gần nhất ${focus.last}%)` : ''}</div>}
          <div><b className="text-violet-700">🍽️ Câu hỏi bàn ăn tối:</b> {dinner}</div>
          {wSubs.slice(-3).map((s) => <div key={s.id} className="flex justify-between gap-2 text-[12px] border-t pt-1"><span>{subjectInfo(s.subject).icon} {s.examTitle}</span><b>{s.score.toLocaleString('vi-VN')} – {rank(s.score).label}</b></div>)}
        </div>
        {teacherNote && <div className="mt-2 bg-white rounded-xl p-3 text-[13px] whitespace-pre-line"><b>💬 Lời nhắn của cô:</b> {teacherNote}</div>}
        <div className="text-center text-[10px] font-bold text-slate-500 mt-2">{cls?.ownerName} • {fmtDate(new Date().toISOString())}</div>
      </div>
    </div>
  );
}
