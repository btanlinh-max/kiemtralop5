import React, { useMemo, useState } from 'react';
import { Home, Target, CloudOff } from 'lucide-react';
import type { Exam, Submission } from '../types';
import { QuestionView } from './QuestionView';
import { Btn, Bar, Card, copyText } from './ui';
import { fmtDur, pct, rank, topicStats, uid } from '../grading';
import { Practice } from './Practice';
import { Rich } from './Rich';
import { useStore } from '../store';
import { addAct } from '../api';
import { bankPractice } from '../reviewGen';
import { attemptComment } from '../analytics';
import type { Question } from '../types';
import { toast } from './ui';

export function ResultView({ exam, sub, status, onHome, onReview }: {
  exam: Exam; sub: Submission; status: 'sent' | 'queued' | 'practice'; onHome: () => void; onReview: () => void;
}) {
  const r = rank(sub.score);
  const stats = topicStats([sub], { [exam.id]: exam });
  const stars = sub.score >= 9 ? 3 : sub.score >= 7 ? 2 : sub.score >= 5 ? 1 : 0;
  const strong = stats.filter((t) => pct(t) >= 80).slice(-1)[0];
  const weak = stats.filter((t) => pct(t) < 70)[0];
  const msg = attemptComment({ name: sub.studentName, title: exam.title, percent: Math.round((sub.raw / (sub.rawMax || 1)) * 100), durationSec: sub.durationSec, total: exam.questions.length, strong: strong ? `${strong.topic} (${pct(strong)}%)` : undefined, weak: weak?.topic, kind: 'exam' });
  return (
    <div className="max-w-3xl mx-auto px-3 pb-16 space-y-4">
      <Card className="p-6 text-center overflow-hidden relative">
        <div className="text-5xl mb-1">{'⭐'.repeat(stars) || '🌱'}</div>
        <div className="text-slate-600 font-bold">{sub.studentName} • Lớp {sub.className}</div>
        <div className="font-black text-lg">{exam.title}</div>
        <div className="mt-3 text-6xl font-black text-orange-500 tabular-nums">{sub.score.toLocaleString('vi-VN')}<span className="text-2xl text-slate-400">/10</span></div>
        <div className="text-sm text-slate-500 font-bold">Đạt {sub.raw.toLocaleString('vi-VN')}/{sub.rawMax.toLocaleString('vi-VN')} điểm • Thời gian {fmtDur(sub.durationSec)}</div>
        {!sub.pending && <span className={`inline-block mt-2 rounded-full px-3 py-1 text-sm font-black ${r.cls}`}>{r.label}</span>}
        {sub.pending && <div className="mt-2 text-sky-700 font-bold text-sm">⏳ Bài có câu tự luận – điểm chính thức sẽ có sau khi cô chấm.</div>}
        {status === 'queued' && <div className="mt-3 rounded-xl bg-amber-100 text-amber-900 font-bold text-sm p-2 inline-flex items-center gap-2"><CloudOff className="w-4 h-4" /> Chưa có mạng – bài đã lưu trên máy và sẽ tự gửi cho cô khi có mạng.</div>}
        {status === 'sent' && <div className="mt-3 text-emerald-700 font-bold text-sm">✅ Bài làm đã gửi tới cô giáo.</div>}
        {status === 'practice' && <div className="mt-3 text-sky-700 font-bold text-sm">👀 Chế độ xem trước – bài này không được lưu.</div>}
      </Card>

      {stats.length > 0 && (
        <Card className="p-5">
          <div className="font-black text-emerald-800 mb-3 flex items-center gap-2"><Target className="w-5 h-5" /> Em làm tốt phần nào, cần ôn phần nào?</div>
          <div className="space-y-3">
            {stats.map((t) => (
              <div key={t.topic}>
                <div className="flex justify-between text-sm font-bold"><span>{pct(t) >= 70 ? '✅' : '🔸'} {t.topic}</span><span>{pct(t)}%</span></div>
                <Bar value={pct(t)} className="mt-1" />
              </div>
            ))}
          </div>
          {stats.some((t) => pct(t) < 70) && (
            <Btn variant="orange" className="w-full mt-4 py-3" onClick={onReview}><Target className="w-5 h-5" /> Vào "Góc ôn tập của em" để ôn phần còn yếu</Btn>
          )}
        </Card>
      )}

      {status !== 'practice' && (
        <Card className="p-4 bg-violet-50 border-violet-200">
          <div className="font-black text-violet-800 mb-1">📨 Lời nhắn gửi bố mẹ</div>
          <div className="text-[15px]">{msg}</div>
          <Btn small variant="violet" className="mt-2" onClick={() => copyText(msg, 'Đã chép – em gửi cho bố mẹ qua Zalo nhé!')}>Chép lời nhắn</Btn>
        </Card>
      )}

      {exam.showAnswers || status === 'practice' ? (
        <div className="space-y-3">
          <div className="font-black text-lg text-slate-700 px-1">📋 Xem lại bài làm</div>
          {exam.questions.map((q, i) => (
            <Card key={q.id} className="p-4">
              <QuestionView q={q} index={i + 1} value={sub.answers[q.id]} reveal readOnly result={sub.results.find((x) => x.qid === q.id)} />
              {['wrong', 'partial'].includes(sub.results.find((x) => x.qid === q.id)?.status || '') && <Rescue q={q} subject={exam.subject} sub={sub} />}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-center text-sm font-bold text-slate-500">Cô giáo chưa mở xem đáp án cho đề này.</Card>
      )}
      <Btn variant="ghost" className="w-full" onClick={onHome}><Home className="w-4 h-4" /> Về trang chính</Btn>
    </div>
  );
}

// "Giải cứu kiến thức": thẻ ghi nhớ + 1–2 câu tương tự để làm lại ngay
function Rescue({ q, subject, sub }: { q: Question; subject: string; sub: Submission }) {
  const { classExams } = useStore();
  const [open, setOpen] = useState(false);
  const similar = useMemo(() => (q.rescue?.similar?.length ? q.rescue.similar : bankPractice(classExams, subject, q.topic, [], 2)), [q.id]);
  const card = q.rescue?.card || q.explanation || '';
  if (!open) return <Btn small variant="orange" className="mt-3" onClick={() => setOpen(true)}>🛟 Giải cứu kiến thức</Btn>;
  return (
    <div className="mt-3 rounded-2xl border-2 border-orange-300 bg-orange-50/60 p-3">
      <div className="font-black text-orange-800 mb-2">🛟 Giải cứu kiến thức{q.topic ? ': ' + q.topic : ''}</div>
      {card && <div className="rounded-xl bg-white border-2 border-amber-200 p-3 text-[15px] mb-3"><b>📌 Ghi nhớ nhanh</b><div className="mt-1"><Rich text={card} /></div></div>}
      {similar.length ? (
        <Practice title="✏️ Làm lại câu tương tự" questions={similar}
          onFinish={(p, info) => sub.classCode !== 'PREVIEW' && addAct({ id: uid('a'), classCode: sub.classCode, studentName: sub.studentName, kind: 'rescue', subject, topic: q.topic, correct: info.correct, total: info.total, percent: p, durationSec: info.durationSec, at: new Date().toISOString() })} />
      ) : <div className="text-sm text-slate-600">Chưa có câu tương tự cho phần này – em vào Góc ôn tập để luyện thêm nhé.</div>}
    </div>
  );
}
