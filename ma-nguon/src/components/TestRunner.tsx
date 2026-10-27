import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Grid3x3, BookOpenText, Send, WifiOff, CheckCircle2, XCircle, Star } from 'lucide-react';
import type { Exam, Question, Submission } from '../types';
import { QuestionView } from './QuestionView';
import { Btn, Modal } from './ui';
import { Rich } from './Rich';
import { gradeAll, gradeQuestion, shuffleArr, uid } from '../grading';
import { Rescue } from './ResultView';
import { missingAnswer } from './ExamEditor';
import { submit } from '../api';

function answered(q: Question, v: any) {
  if (v === undefined || v === null || v === '') return false;
  if (q.type === 'essay') return !!(v.text?.trim() || v.img || (v.keys || []).some((k: string) => k && k.trim()));
  if (Array.isArray(v)) return v.some((x) => x !== undefined && x !== null && x !== '');
  return true;
}

export function TestRunner({ exam, studentName, className, classCode, onDone, onExit, practice }: {
  exam: Exam; studentName: string; className: string; classCode: string;
  onDone: (sub: Submission, sent: 'sent' | 'queued' | 'practice') => void; onExit: () => void;
  practice?: boolean; // làm thử (giáo viên xem trước) – không lưu
}) {
  const draftKey = `kt5_draft_${exam.id}_${classCode}_${studentName}`;
  const questions = useMemo(() => {
    if (!exam.shuffle) return exam.questions;
    const withP = exam.questions.filter((q) => q.passageId);
    const noP = exam.questions.filter((q) => !q.passageId && q.type !== 'essay');
    const essays = exam.questions.filter((q) => !q.passageId && q.type === 'essay');
    return [...withP, ...shuffleArr(noP), ...essays];
  }, [exam]);

  const draft = useMemo(() => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { return null; } }, [draftKey]);
  const [answers, setAnswers] = useState<Record<string, any>>(draft?.answers || {});
  const instant = exam.instant !== false;
  const [checked, setChecked] = useState<Record<string, boolean>>(draft?.checked || {});
  const [flash, setFlash] = useState<'' | 'right' | 'wrong'>('');
  const [idx, setIdx] = useState(0);
  const [startedAt] = useState<string>(draft?.startedAt || new Date().toISOString());
  const [now, setNow] = useState(Date.now());
  const [showGrid, setShowGrid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPassage, setShowPassage] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (practice) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ answers, startedAt, checked })); } catch {}
  }, [answers, checked, draftKey, startedAt, practice]);
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [idx]);

  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const remain = exam.duration ? exam.duration * 60 - elapsed : null;
  const doneCount = questions.filter((q) => answered(q, answers[q.id])).length;
  // Điểm tạm tính: các câu đã chấm ngay (trắc nghiệm…) + phần đáp số tự luận
  const rawMax = questions.reduce((a, x) => a + (x.points || 0), 0) || 1;
  const live = questions.reduce((a, x) => (checked[x.id] ? a + gradeQuestion(x, answers[x.id]).earned : a), 0);
  const liveScore = Math.round((live / rawMax) * 100) / 10;
  const autoGradable = (x: Question) => x.type !== 'essay' && !missingAnswer(x);
  const check = (x: Question, v = answers[x.id]) => {
    if (!instant || !autoGradable(x) || checked[x.id] || !answered(x, v)) return;
    setChecked((c) => ({ ...c, [x.id]: true }));
    const r = gradeQuestion(x, v);
    setFlash(r.status === 'right' ? 'right' : 'wrong');
    setTimeout(() => setFlash(''), 1200);
  };

  const doSubmit = async () => {
    if (sending) return;
    setSending(true);
    const g = gradeAll(exam, answers);
    const sub: Submission = {
      id: uid('s'), classCode, ownerUid: exam.ownerUid, examId: exam.id, examTitle: exam.title, subject: exam.subject, className, studentName,
      answers, results: g.results, score: g.score, raw: g.raw, rawMax: g.rawMax, pending: g.pending,
      startedAt, submittedAt: new Date().toISOString(), durationSec: elapsed,
      device: /iPad|Tablet/i.test(navigator.userAgent) ? 'Máy tính bảng' : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Điện thoại' : 'Máy tính',
    };
    if (practice) { onDone(sub, 'practice'); return; }
    const r = await submit(sub);
    try { localStorage.removeItem(draftKey); } catch {}
    onDone(sub, r);
  };

  useEffect(() => {
    if (remain !== null && remain <= 0 && !sending) doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remain]);

  const q = questions[idx];
  const passage = q?.passageId ? exam.passages.find((p) => p.id === q.passageId) : undefined;
  const mm = remain !== null ? Math.max(0, remain) : elapsed;
  const timeTxt = `${Math.floor(mm / 60).toString().padStart(2, '0')}:${(mm % 60).toString().padStart(2, '0')}`;

  return (
    <div className="max-w-[1280px] mx-auto px-2 sm:px-4 pb-28" ref={topRef}>
      <div className="sticky top-0 z-30 -mx-2 sm:mx-0 bg-amber-50/95 backdrop-blur border-b-2 border-amber-200 sm:rounded-b-2xl px-3 py-2 flex items-center gap-2">
        <button onClick={() => (practice || window.confirm('Em muốn thoát? Bài làm vẫn được lưu nháp trên máy.')) && onExit()} className="p-2 rounded-xl hover:bg-white" aria-label="Thoát"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="font-black text-sm sm:text-base truncate">{exam.title}</div>
          <div className="text-[11px] text-slate-600 truncate">{practice ? 'XEM TRƯỚC (không lưu)' : `${studentName} • Lớp ${className}`} • Đã làm {doneCount}/{questions.length}</div>
        </div>
        {instant && <div className="flex items-center gap-1 font-black tabular-nums rounded-xl px-2.5 py-1.5 bg-emerald-500 text-white" title="Điểm tạm tính (chưa gồm phần tự luận cô chấm)"><Star className="w-4 h-4" /> {liveScore.toLocaleString('vi-VN')}</div>}
        <div className={`flex items-center gap-1 font-black tabular-nums rounded-xl px-2.5 py-1.5 ${remain !== null && remain < 120 ? 'bg-rose-500 text-white animate-pulse' : 'bg-white border-2 border-amber-200 text-slate-800'}`}>
          <Clock className="w-4 h-4" /> {timeTxt}
        </div>
        <button onClick={() => setShowGrid(true)} className="p-2 rounded-xl bg-white border-2 border-amber-200" aria-label="Danh sách câu"><Grid3x3 className="w-5 h-5" /></button>
      </div>
      {!navigator.onLine && !practice && <div className="mt-2 rounded-xl bg-amber-100 text-amber-900 text-sm font-bold px-3 py-2 flex items-center gap-2"><WifiOff className="w-4 h-4" /> Đang mất mạng – em cứ làm tiếp, bài được lưu trên máy và tự gửi khi có mạng.</div>}

      {flash && <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"><div className={`text-8xl drop-shadow-xl animate-bounce ${flash === 'right' ? 'text-emerald-500' : 'text-rose-500'}`}>{flash === 'right' ? '✔' : '✘'}</div></div>}
      <div className="h-2 bg-amber-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-orange-400" style={{ width: (doneCount / Math.max(1, questions.length)) * 100 + '%' }} /></div>

      <div className={`mt-3 grid gap-3 ${passage ? 'lg:grid-cols-2' : ''}`}>
        {passage && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-4 lg:sticky lg:top-20 lg:max-h-[75vh] lg:overflow-y-auto">
            <button onClick={() => setShowPassage(!showPassage)} className="w-full flex items-center gap-2 font-black text-emerald-800">
              <BookOpenText className="w-5 h-5" /> Bài đọc: {passage.title || 'Đọc thầm văn bản'}
              <span className="ml-auto text-xs font-bold text-emerald-600 lg:hidden">{showPassage ? 'Thu gọn ▲' : 'Mở ra ▼'}</span>
            </button>
            {showPassage && (
              <div className="mt-2 text-[16px] leading-[1.8] text-slate-800 whitespace-pre-line">
                <Rich text={passage.content} />
                {passage.source && <div className="text-right italic text-sm text-slate-500 mt-2">({passage.source})</div>}
              </div>
            )}
          </div>
        )}
        <div className="bg-white rounded-2xl border-2 border-amber-100 shadow-sm p-4 sm:p-6">
          {q && (() => {
            const isChecked = !!checked[q.id];
            const res = isChecked ? gradeQuestion(q, answers[q.id]) : undefined;
            return (
              <>
                {isChecked && res && (
                  <div className={`mb-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 font-black text-lg ${res.status === 'right' ? 'bg-emerald-100 text-emerald-800' : res.status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                    {res.status === 'right' ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                    {res.status === 'right' ? `Chính xác! +${res.earned.toLocaleString('vi-VN')} điểm` : res.status === 'partial' ? `Đúng một phần: +${res.earned.toLocaleString('vi-VN')} điểm` : 'Chưa đúng rồi – xem đáp án và "Giải cứu kiến thức" bên dưới nhé'}
                  </div>
                )}
                <QuestionView key={q.id} q={q} index={idx + 1} value={answers[q.id]} reveal={isChecked} readOnly={isChecked} result={res}
                  onChange={(v) => { setAnswers((a) => ({ ...a, [q.id]: v })); if (q.type === 'mcq') check(q, v); }} />
                {instant && autoGradable(q) && q.type !== 'mcq' && !isChecked && (
                  <Btn className="mt-4 w-full sm:w-auto" disabled={!answered(q, answers[q.id])} onClick={() => check(q)}><CheckCircle2 className="w-4 h-4" /> Kiểm tra câu này</Btn>
                )}
                {isChecked && res && res.status !== 'right' && <Rescue key={'r' + q.id} autoOpen q={q} subject={exam.subject} classCode={practice ? 'PREVIEW' : classCode} studentName={studentName} />}
              </>
            );
          })()}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t-2 border-amber-200 px-3 py-3 no-print">
        <div className="max-w-[1280px] mx-auto flex items-center gap-2">
          <Btn variant="ghost" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}><ChevronLeft className="w-5 h-5" /> <span className="hidden sm:inline">Câu trước</span></Btn>
          <div className="flex-1 text-center text-sm font-bold text-slate-600">Câu {idx + 1}/{questions.length}</div>
          {idx < questions.length - 1 ? (
            <Btn variant="orange" onClick={() => setIdx(idx + 1)}><span>Câu tiếp</span> <ChevronRight className="w-5 h-5" /></Btn>
          ) : (
            <Btn onClick={() => setConfirm(true)}><Send className="w-4 h-4" /> Nộp bài</Btn>
          )}
        </div>
      </div>

      <Modal open={showGrid} onClose={() => setShowGrid(false)} title="Danh sách câu hỏi">
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
          {questions.map((qq, i) => (
            <button key={qq.id} onClick={() => { setIdx(i); setShowGrid(false); }}
              className={`h-12 rounded-xl font-black border-2 ${i === idx ? 'border-orange-500 ring-2 ring-orange-300' : 'border-transparent'} ${checked[qq.id] ? (gradeQuestion(qq, answers[qq.id]).status === 'right' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') : answered(qq, answers[qq.id]) ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-700'}`}>{checked[qq.id] ? (gradeQuestion(qq, answers[qq.id]).status === 'right' ? '✓' : '✗') : i + 1}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600 mt-3">{instant && <><span>🟩 ✓ Đúng</span><span>🟥 ✗ Sai</span></>}<span>🟦 Đã làm (chờ chấm)</span><span>⬜ Chưa làm</span></div>
        <Btn className="w-full mt-4" onClick={() => { setShowGrid(false); setConfirm(true); }}><Send className="w-4 h-4" /> Nộp bài</Btn>
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Nộp bài?"
        footer={<><Btn variant="ghost" onClick={() => setConfirm(false)}>Làm tiếp</Btn><Btn loading={sending} onClick={doSubmit}><Send className="w-4 h-4" /> Nộp bài</Btn></>}>
        <div className="text-center">
          <div className="text-5xl mb-2">{doneCount === questions.length ? '🎉' : '🤔'}</div>
          <div className="font-bold text-lg">Em đã làm {doneCount}/{questions.length} câu.</div>
          {doneCount < questions.length && <div className="text-rose-600 font-bold mt-1">Còn {questions.length - doneCount} câu chưa làm. Em kiểm tra lại nhé!</div>}
        </div>
      </Modal>
    </div>
  );
}
