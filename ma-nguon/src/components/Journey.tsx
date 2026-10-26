import React, { useMemo, useState } from 'react';
import { ChevronLeft, Rocket } from 'lucide-react';
import type { Exam, Question } from '../types';
import { useStore } from '../store';
import { addAct } from '../api';
import { Btn, Card } from './ui';
import { Practice } from './Practice';
import { SkillTree, TreeAndBadges, useStudentData, WeeklyBoard } from './Learner';
import { shuffleArr, uid } from '../grading';
import { bankPractice } from '../reviewGen';

const todayKey = () => new Date().toLocaleDateString('sv-SE');
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// Nhiệm vụ mỗi ngày: 5 câu đúng vùng yếu, 5–10 phút
function buildDaily(exams: Exam[], weak: { subject: string; topic: string }[], seed: number): { questions: Question[]; topics: string[] } {
  const qs: Question[] = [];
  const topics: string[] = [];
  for (const w of weak) {
    const got = bankPractice(exams, w.subject, w.topic, [], 2);
    if (got.length) topics.push(w.topic);
    qs.push(...got);
    if (qs.length >= 5) break;
  }
  if (qs.length < 5) {
    const pool: Question[] = [];
    for (const e of exams) for (const q of e.questions) {
      if (q.type === 'essay' || q.passageId) continue;
      if (q.type === 'mcq' && (q.answer ?? -1) < 0) continue;
      if (q.type === 'fill' && (q.blanks || []).some((b) => !b)) continue;
      pool.push({ ...q, id: uid('q'), topic: q.topic });
    }
    qs.push(...shuffleArr(pool, seed).slice(0, 5 - qs.length));
  }
  return { questions: shuffleArr(qs, seed).slice(0, 5), topics };
}

export function Journey({ exams, onGoReview }: { exams: Exam[]; onGoReview: () => void }) {
  const { profile } = useStore();
  const d = useStudentData(profile.classCode, profile.studentName, exams);
  const [doing, setDoing] = useState(false);
  const weak = useMemo(() => d.skills.filter((s) => s.status === 'red' || s.status === 'yellow').sort((a, b) => (a.last || 0) - (b.last || 0)), [d.skills]);
  const daily = useMemo(() => buildDaily(exams, weak, hash(todayKey() + profile.studentName)), [exams, weak.length, profile.studentName]);
  const doneToday = d.acts.some((a) => a.kind === 'daily' && new Date(a.at).toLocaleDateString('sv-SE') === todayKey());

  if (doing) {
    return (
      <div className="space-y-3">
        <Btn variant="ghost" onClick={() => { setDoing(false); d.reload(); }}><ChevronLeft className="w-4 h-4" /> Quay lại Hành trình</Btn>
        <Card className="p-4 sm:p-6">
          <Practice title="🚀 Nhiệm vụ hôm nay" tips="5 câu chọn riêng cho em, đúng những phần em cần rèn. Làm trong 5–10 phút thôi!" questions={daily.questions}
            onFinish={(p, info) => addAct({ id: uid('a'), classCode: profile.classCode, studentName: profile.studentName, kind: 'daily', subject: weak[0]?.subject || '', topic: '', correct: info.correct, total: info.total, percent: p, durationSec: info.durationSec, at: new Date().toISOString() })} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className={`p-4 sm:p-5 ${doneToday ? 'bg-emerald-50 border-emerald-200' : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-4xl">{doneToday ? '✅' : '🚀'}</div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-black text-lg text-orange-800">Nhiệm vụ hôm nay {doneToday && '– đã hoàn thành!'}</div>
            <div className="text-sm text-slate-600">{daily.questions.length ? <>5 câu (~5–10 phút){daily.topics.length ? <> tập trung vào: <b>{daily.topics.slice(0, 3).join(', ')}</b></> : ''}</> : 'Cô chưa giao đề nào cho lớp nên chưa có câu luyện.'}</div>
          </div>
          {daily.questions.length > 0 && <Btn variant={doneToday ? 'ghost' : 'orange'} onClick={() => setDoing(true)}><Rocket className="w-4 h-4" /> {doneToday ? 'Làm thêm lần nữa' : 'Làm ngay'}</Btn>}
        </div>
      </Card>

      {d.warnings.length > 0 && (
        <Card className="p-4 border-rose-200 bg-rose-50">
          <div className="font-black text-rose-800">🧭 Phần em đang bị vướng</div>
          <div className="text-sm mt-1">{d.warnings.map((w) => w.topic).join('; ')} – em vào <button className="underline font-bold" onClick={onGoReview}>Góc ôn tập</button> để luyện lại, hoặc hỏi cô nhé!</div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="font-black text-emerald-800 text-lg mb-3">🌳 Cây tri thức & huy hiệu</div>
        <TreeAndBadges skills={d.skills} subs={d.subs} acts={d.acts} streakDays={d.streakDays} />
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="font-black text-emerald-800 text-lg mb-1">🗺️ Bản đồ kỹ năng của em</div>
        <div className="text-sm text-slate-600 mb-3">Màu đỏ là phần cần "cày" để lên màu xanh nhé!</div>
        {d.loading ? <div className="text-sm text-slate-500">Đang tải…</div> : <SkillTree skills={d.skills} />}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="font-black text-amber-700 text-lg mb-2">🏆 Bảng vàng chăm chỉ tuần này – lớp {profile.className}</div>
        <WeeklyBoard classCode={profile.classCode} highlight={profile.studentName} />
      </Card>
    </div>
  );
}
