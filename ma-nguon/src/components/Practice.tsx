import React, { useRef, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { Question } from '../types';
import { QuestionView } from './QuestionView';
import { Btn } from './ui';
import { gradeAll } from '../grading';
import { Rich } from './Rich';

// Bộ câu luyện tập (bài ôn) – làm trên 1 trang, chấm ngay, làm lại được
export function Practice({ title, summary, example, tips, questions, onFinish }: {
  title: string; summary?: string; example?: string; tips?: string; questions: Question[];
  onFinish?: (percent: number, info: { correct: number; total: number; durationSec: number }) => void;
}) {
  const started = useRef(Date.now());
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [checked, setChecked] = useState(false);
  const [round, setRound] = useState(0);
  const g = gradeAll({ questions }, answers);
  const percent = Math.round((g.raw / g.rawMax) * 100);

  return (
    <div className="space-y-4">
      <div className="text-xl font-black text-emerald-800">{title}</div>
      {summary && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-4">
          <div className="font-black text-amber-800 mb-1">📌 Kiến thức cần nhớ</div>
          <div className="text-[16px] leading-relaxed"><Rich text={summary} /></div>
        </div>
      )}
      {example && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4">
          <div className="font-black text-sky-800 mb-1">🧩 Ví dụ mẫu</div>
          <div className="text-[16px] leading-relaxed"><Rich text={example} /></div>
        </div>
      )}
      {tips && <div className="rounded-2xl bg-violet-50 border-2 border-violet-200 p-3 text-[15px]"><b>💡 Mẹo nhỏ: </b><Rich text={tips} /></div>}

      {questions.length === 0 ? (
        <div className="text-slate-500 font-bold">Chưa có câu luyện tập cho phần này.</div>
      ) : (
        <>
          <div className="font-black text-orange-700">✏️ Luyện tập ({questions.length} câu)</div>
          {questions.map((q, i) => (
            <div key={q.id + round} className="bg-white rounded-2xl border-2 border-amber-100 p-4">
              <QuestionView q={q} index={i + 1} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} reveal={checked} readOnly={checked} result={checked ? g.results[i] : undefined} />
            </div>
          ))}
          {!checked ? (
            <Btn className="w-full py-4 text-base" onClick={() => { setChecked(true); onFinish?.(percent, { correct: g.results.filter((r) => r.status === 'right').length, total: questions.length, durationSec: Math.round((Date.now() - started.current) / 1000) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><CheckCircle2 className="w-5 h-5" /> Chấm bài luyện tập</Btn>
          ) : (
            <div className={`sticky bottom-3 rounded-2xl p-4 border-2 shadow-xl ${percent >= 80 ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
              <div className="font-black text-lg">{percent >= 80 ? '🌟 Tuyệt vời! Em đã nắm vững phần này.' : '💪 Cố lên! Em xem lại giải thích rồi làm lại nhé.'}</div>
              <div className="text-sm font-bold text-slate-600">Đúng {percent}% • Cần từ 80% để được đánh dấu "Đã vững".</div>
              <Btn variant="orange" className="mt-2" onClick={() => { setAnswers({}); setChecked(false); setRound(round + 1); started.current = Date.now(); }}><RotateCcw className="w-4 h-4" /> Làm lại</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}
