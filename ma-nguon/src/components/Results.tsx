import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, FileSpreadsheet, Sparkles, Users, Target, ListChecks, PenLine, Trash2 } from 'lucide-react';
import type { Exam, QResult, Question, Submission } from '../types';
import { useStore } from '../store';
import { classSubs, deleteSub, saveSub as apiSaveSub, saveReview } from '../api';
import { friendly } from '../store';
import { Bar, Btn, Card, Empty, Field, inputCls, Modal, Pill, toast } from './ui';
import { fmtDate, fmtDur, GAP_THRESHOLD, pct, rank, summarize, topicStats } from '../grading';
import { subsToExcel } from '../exporters';
import { QuestionView } from './QuestionView';
import { askJson, hasKey } from '../ai';
import { Rich, plain } from './Rich';
import { aiReview, autoReview, examMap, newReview, wrongQuestions } from '../reviewGen';
import { subjectInfo } from '../curriculum';

export async function aiGradeEssay(q: Question, ans: any, passage?: string): Promise<{ points: number; comment: string }> {
  const text = typeof ans === 'object' ? ans?.text || '' : String(ans || '');
  const img = typeof ans === 'object' ? ans?.img : '';
  const files = img ? [{ mime: 'image/jpeg', data: img.split(',')[1] }] : undefined;
  const r = await askJson<any>(`Chấm câu tự luận của học sinh lớp 5 theo TT27 (thang tối đa ${q.points} điểm, cho điểm lẻ 0,25).
${passage ? 'Bài đọc liên quan: ' + passage.slice(0, 2000) + '\n' : ''}Đề: ${plain(q.prompt)}
Hướng dẫn chấm/đáp án: ${plain(q.guide || '(không có – tự xác định đáp án đúng)')}
Bài làm của học sinh: ${text || '(xem ảnh đính kèm)'}
Trả về JSON {"points": số, "comment": "nhận xét 1–3 câu: khen điểm làm được trước, rồi chỉ rõ lỗi/thiếu và cách sửa, giọng ân cần xưng cô – em"}`, { files });
  return { points: Math.max(0, Math.min(q.points, Math.round((Number(r.points) || 0) * 4) / 4)), comment: String(r.comment || '') };
}

export function regrade(sub: Submission, results: QResult[]): Submission {
  const s = summarize(results);
  return { ...sub, results: s.results, raw: s.raw, rawMax: s.rawMax, score: s.score, pending: s.pending };
}

export function Results({ examId, setExamId }: { examId: string; setExamId: (id: string) => void }) {
  const { exams, classes, teacher } = useStore();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [cls, setCls] = useState('');
  const [tab, setTab] = useState<'table' | 'items' | 'gaps' | 'essay'>('table');
  const [open, setOpen] = useState<Submission | null>(null);
  const [bulk, setBulk] = useState('');
  const exam = exams.find((e) => e.id === examId) || null;

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    const ex = exams.find((e) => e.id === examId);
    const codes = (ex?.classes || []).filter((c) => classes.some((k) => k.id === c));
    try { setSubs((await Promise.all(codes.map((c) => classSubs(c, { examId })))).flat().sort((a, b) => a.className.localeCompare(b.className) || a.studentName.split(' ').slice(-1)[0].localeCompare(b.studentName.split(' ').slice(-1)[0], 'vi'))); } catch (e: any) { toast(friendly(e), 'err'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [examId, classes.length]);

  // mỗi học sinh lấy bài làm mới nhất
  const latest = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of subs) {
      if (cls && s.classCode !== cls) continue;
      const k = s.classCode + '¦' + s.studentName.toLowerCase();
      const old = m.get(k);
      if (!old || old.submittedAt < s.submittedAt) m.set(k, s);
    }
    return [...m.values()];
  }, [subs, cls]);

  const saveSub = async (s: Submission) => {
    await apiSaveSub(s);
    setSubs((x) => x.map((y) => (y.id === s.id ? s : y)));
    if (open?.id === s.id) setOpen(s);
  };

  if (!exam) {
    return (
      <Card className="p-5">
        <Field label="Chọn đề để xem kết quả">
          <select className={inputCls} value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">— Chọn đề —</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{subjectInfo(e.subject).icon} {e.title} (#{e.code})</option>)}
          </select>
        </Field>
      </Card>
    );
  }

  const byId = { [exam.id]: exam };
  const avg = latest.length ? Math.round((latest.reduce((s, x) => s + x.score, 0) / latest.length) * 10) / 10 : 0;
  const dist = { tot: latest.filter((x) => x.score >= 9).length, ht: latest.filter((x) => x.score >= 5 && x.score < 9).length, cht: latest.filter((x) => x.score < 5).length };
  const pendingSubs = latest.filter((x) => x.pending);
  const classTopics = topicStats(latest, byId);

  const makeReviews = async (useAi: boolean) => {
    const targets: { s: Submission; t: ReturnType<typeof topicStats>[number] }[] = [];
    for (const s of latest) for (const t of topicStats([s], byId)) if (pct(t) < GAP_THRESHOLD) targets.push({ s, t });
    if (!targets.length) return toast('Không có học sinh nào bị hổng kiến thức trong đề này 🎉', 'info');
    if (!window.confirm(`Tạo ${targets.length} bài ôn riêng cho ${new Set(targets.map((x) => x.s.studentName)).size} học sinh${useAi ? ' bằng AI (mỗi bài ~10 giây)' : ' từ kho câu hỏi'}?`)) return;
    let ok = 0;
    const allEx = examMap(exams);
    for (let i = 0; i < targets.length; i++) {
      const { s, t } = targets[i];
      setBulk(`${i + 1}/${targets.length}`);
      try {
        const content = useAi ? await aiReview({ subject: t.subject, topic: t.topic, wrong: wrongQuestions(t, allEx), percent: pct(t) }) : autoReview(exams, t.subject, t.topic, t.wrongQids);
        if (!useAi) content.questions = [...wrongQuestions(t, allEx).map((w) => w.q).filter((q) => !q.passageId && q.type !== 'essay'), ...content.questions].slice(0, 10);
        if (!content.questions.length) continue;
        await saveReview(newReview({ classCode: s.classCode, ownerUid: teacher?.uid, className: s.className, studentName: s.studentName, subject: t.subject, topic: t.topic, createdBy: teacher?.name || '', source: useAi ? 'ai' : 'auto' }, content));
        ok++;
      } catch (e: any) {
        toast(e.message, 'err');
        if (/hết lượt|429/.test(e.message)) break;
      }
    }
    setBulk('');
    toast(`Đã giao ${ok} bài ôn riêng. Học sinh xem trong "Góc ôn tập của em".`);
  };

  const gradeAllAi = async () => {
    const list = pendingSubs;
    if (!list.length) return;
    for (let i = 0; i < list.length; i++) {
      setBulk(`chấm ${i + 1}/${list.length}`);
      const s = list[i];
      const results = [...s.results];
      for (let k = 0; k < results.length; k++) {
        if (results[k].status !== 'pending') continue;
        const q = exam.questions.find((x) => x.id === results[k].qid);
        if (!q) continue;
        try {
          const g = await aiGradeEssay(q, s.answers[q.id], exam.passages.find((p) => p.id === q.passageId)?.content);
          results[k] = { ...results[k], earned: g.points, comment: g.comment, status: 'pending' };
        } catch (e: any) { toast(e.message, 'err'); setBulk(''); return; }
      }
      // giữ trạng thái "chờ duyệt": giáo viên mở từng bài để bấm Duyệt
      await saveSub({ ...s, results, aiDraft: true } as any);
    }
    setBulk('');
    toast('AI đã gợi ý điểm và nhận xét. Thầy cô mở từng bài để duyệt.');
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <Field label="Đề">
              <select className={inputCls} value={examId} onChange={(e) => setExamId(e.target.value)}>
                {exams.map((e) => <option key={e.id} value={e.id}>{subjectInfo(e.subject).icon} {e.title} (#{e.code})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Lớp">
            <select className={inputCls} value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">Tất cả lớp</option>
              {classes.filter((c) => exam.classes?.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Btn variant="ghost" onClick={load} loading={loading}><RefreshCw className="w-4 h-4" /> Tải lại</Btn>
          <Btn variant="ghost" onClick={() => subsToExcel(exam, latest, 'Ket-qua-' + exam.title + (cls ? '-' + cls : ''))} disabled={!latest.length}><FileSpreadsheet className="w-4 h-4" /> Excel</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          ['Bài đã nộp', latest.length, 'text-slate-800'],
          ['Điểm trung bình', avg.toLocaleString('vi-VN'), 'text-orange-500'],
          ['Hoàn thành tốt', dist.tot, 'text-emerald-600'],
          ['Hoàn thành', dist.ht, 'text-sky-600'],
          ['Chưa hoàn thành', dist.cht, 'text-rose-600'],
        ].map(([l, v, c]) => (
          <Card key={l as string} className="p-3 text-center"><div className={`text-3xl font-black ${c}`}>{v}</div><div className="text-xs font-bold text-slate-500">{l}</div></Card>
        ))}
      </div>
      {pendingSubs.length > 0 && <div className="text-xs font-bold text-sky-700 px-1">⏳ {pendingSubs.length} bài còn câu tự luận chưa chấm – điểm đang tạm tính. Vào "Chấm tự luận" để hoàn tất.</div>}

      <div className="flex gap-1.5 overflow-x-auto">
        {([['table', 'Bảng điểm', <Users className="w-4 h-4" />], ['gaps', 'Bản đồ hổng kiến thức', <Target className="w-4 h-4" />], ['items', 'Phân tích từng câu', <ListChecks className="w-4 h-4" />], ['essay', `Chấm tự luận (${pendingSubs.length})`, <PenLine className="w-4 h-4" />]] as const).map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black border-2 ${tab === k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>{ic}{l}</button>
        ))}
      </div>

      {!latest.length ? <Card><Empty icon="⏳" title={loading ? 'Đang tải…' : !(exam.classes || []).length ? 'Đề chưa giao cho lớp nào' : 'Chưa có học sinh nộp bài'}>{!(exam.classes || []).length ? 'Bấm "Giao bài" ở kho đề và chọn lớp.' : 'Học sinh vào lớp bằng mã lớp/QR, đề sẽ hiện trong "Bài cần làm".'}</Empty></Card> : (
        <>
          {tab === 'table' && (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 text-left text-xs text-slate-600">
                  <tr><th className="p-2">#</th><th className="p-2">Học sinh</th><th className="p-2">Lớp</th><th className="p-2 text-center">Điểm</th><th className="p-2">Mức đạt</th><th className="p-2 hidden sm:table-cell">Phần còn hổng</th><th className="p-2 hidden md:table-cell">Thời gian</th><th className="p-2 hidden md:table-cell">Nộp lúc</th></tr>
                </thead>
                <tbody>
                  {latest.map((s, i) => {
                    const g = topicStats([s], byId).filter((t) => pct(t) < GAP_THRESHOLD);
                    const r = rank(s.score);
                    return (
                      <tr key={s.id} className="border-t hover:bg-orange-50/50 cursor-pointer" onClick={() => setOpen(s)}>
                        <td className="p-2 text-slate-400">{i + 1}</td>
                        <td className="p-2 font-bold">{s.studentName}</td>
                        <td className="p-2">{s.className}</td>
                        <td className="p-2 text-center font-black text-orange-600 text-base">{s.score.toLocaleString('vi-VN')}</td>
                        <td className="p-2">{s.pending ? <Pill className="bg-sky-50 border-sky-200 text-sky-700">Chờ chấm</Pill> : <Pill className={r.cls + ' border-transparent'}>{r.label}</Pill>}</td>
                        <td className="p-2 hidden sm:table-cell text-xs">{g.map((t) => t.topic).join('; ') || <span className="text-emerald-600 font-bold">—</span>}</td>
                        <td className="p-2 hidden md:table-cell text-xs">{Math.round(s.durationSec / 60)} phút</td>
                        <td className="p-2 hidden md:table-cell text-xs">{fmtDate(s.submittedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'gaps' && (
            <div className="space-y-3">
              <Card className="p-4">
                <div className="font-black text-emerald-800 mb-2">🎯 Cả lớp nắm từng phần thế nào?</div>
                <div className="space-y-2.5">
                  {classTopics.map((t) => {
                    const weak = latest.filter((s) => topicStats([s], byId).some((x) => x.topic === t.topic && pct(x) < GAP_THRESHOLD));
                    return (
                      <div key={t.topic}>
                        <div className="flex justify-between text-sm font-bold gap-2"><span>{t.topic}</span><span className={pct(t) < GAP_THRESHOLD ? 'text-rose-600' : 'text-emerald-700'}>{pct(t)}% • {weak.length} HS chưa vững</span></div>
                        <Bar value={pct(t)} className="mt-1" />
                        {weak.length > 0 && <div className="text-[11px] text-slate-500 mt-1"><b>Nhóm cần hỗ trợ:</b> {weak.map((s) => s.studentName).join(', ')}</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Card className="p-4">
                <div className="font-black text-violet-800 mb-1">📚 Giao bài ôn riêng cho từng học sinh</div>
                <div className="text-sm text-slate-600 mb-3">Mỗi học sinh nhận bài ôn đúng phần mình bị hổng (dưới {GAP_THRESHOLD}%), xem trong "Góc ôn tập của em". Làm đúng từ 80% → "Đã vững".</div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="violet" disabled={!hasKey() || !!bulk} loading={!!bulk && bulk.includes('/') && !bulk.startsWith('chấm')} onClick={() => makeReviews(true)}><Sparkles className="w-4 h-4" /> AI soạn bài ôn riêng {bulk && !bulk.startsWith('chấm') ? bulk : ''}</Btn>
                  <Btn variant="orange" disabled={!!bulk} onClick={() => makeReviews(false)}>⚡ Giao nhanh từ kho câu hỏi (không cần AI)</Btn>
                </div>
              </Card>
              <Card className="p-3 overflow-x-auto">
                <div className="font-black text-slate-700 mb-2 px-1">🗺️ Bản đồ nhiệt: học sinh × chủ đề</div>
                <table className="text-xs">
                  <thead><tr><th className="p-1.5 text-left sticky left-0 bg-white">Học sinh</th>{classTopics.map((t) => <th key={t.topic} className="p-1.5 font-bold text-slate-600 max-w-[110px] align-bottom"><div className="line-clamp-3">{t.topic}</div></th>)}</tr></thead>
                  <tbody>
                    {latest.map((s) => {
                      const st = topicStats([s], byId);
                      return (
                        <tr key={s.id}>
                          <td className="p-1.5 font-bold whitespace-nowrap sticky left-0 bg-white">{s.studentName}</td>
                          {classTopics.map((t) => {
                            const x = st.find((y) => y.topic === t.topic);
                            const v = x ? pct(x) : null;
                            const c = v === null ? 'bg-slate-50 text-slate-300' : v >= 80 ? 'bg-emerald-400 text-white' : v >= 70 ? 'bg-lime-300' : v >= 50 ? 'bg-amber-300' : 'bg-rose-400 text-white';
                            return <td key={t.topic} className="p-0.5"><div className={`rounded-md text-center font-black py-1.5 ${c}`}>{v === null ? '–' : v}</div></td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === 'items' && (
            <div className="space-y-2">
              {exam.questions.map((q, i) => {
                const rs = (latest.map((s) => s.results.find((r) => r.qid === q.id)).filter(Boolean) as QResult[]).filter((r) => r.status !== 'pending');
                const p = rs.length ? Math.round((rs.reduce((s, r) => s + r.earned, 0) / (rs.reduce((s, r) => s + r.max, 0) || 1)) * 100) : 0;
                return (
                  <Card key={q.id} className={`p-3 ${p < 50 ? 'border-rose-200' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white font-black flex items-center justify-center text-sm">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold line-clamp-2"><Rich text={q.type === 'fill' ? q.prompt.replace(/\[\[\d+\]\]/g, '……') : q.prompt} /></div>
                        <div className="flex items-center gap-2 mt-1"><Bar value={p} className="flex-1" /><span className="text-xs font-black w-24 text-right">{p}% đúng</span></div>
                        {q.type === 'mcq' && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {(q.options || []).map((o, k) => {
                              const n = latest.filter((s) => s.answers[q.id] === k).length;
                              return <span key={k} className={`text-[11px] font-bold rounded-full px-2 py-0.5 border ${q.answer === k ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : n > latest.length / 4 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200'}`}>{'ABCD'[k]}: {n} HS{q.answer === k ? ' ✓' : ''}</span>;
                            })}
                          </div>
                        )}
                        {p < 50 && <div className="text-[11px] text-rose-600 font-bold mt-1">⚠️ Câu nhiều em sai – nên giảng lại trên lớp.</div>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {tab === 'essay' && (
            <Card className="p-4">
              {pendingSubs.length === 0 ? <Empty icon="✅" title="Không còn bài tự luận nào chờ chấm" /> : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Btn variant="violet" disabled={!hasKey() || !!bulk} loading={bulk.startsWith('chấm')} onClick={gradeAllAi}><Sparkles className="w-4 h-4" /> AI gợi ý chấm tất cả {bulk.startsWith('chấm') ? bulk.slice(5) : ''}</Btn>
                    <span className="text-xs text-slate-500 self-center">AI chỉ gợi ý – thầy cô mở từng bài để duyệt/sửa điểm.</span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingSubs.map((s) => (
                      <button key={s.id} onClick={() => setOpen(s)} className="w-full flex items-center gap-2 rounded-xl border-2 border-slate-200 hover:border-orange-300 p-2.5 text-left">
                        <span className="font-bold flex-1">{s.studentName} – {s.className}</span>
                        {(s as any).aiDraft && <Pill className="bg-violet-50 border-violet-200 text-violet-700">AI đã gợi ý</Pill>}
                        <span className="text-xs font-bold text-orange-600">Chấm →</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}

      {open && <SubmissionDetail sub={open} exam={exam} onClose={() => setOpen(null)} onSave={saveSub} onDelete={async () => { await deleteSub(open); setSubs((x) => x.filter((y) => y.id !== open.id)); setOpen(null); toast('Đã xoá bài làm.'); }} />}
    </div>
  );
}

export function SubmissionDetail({ sub, exam, onClose, onSave, onDelete }: { sub: Submission; exam: Exam; onClose: () => void; onSave: (s: Submission) => Promise<void>; onDelete?: () => void }) {
  const { teacher, exams } = useStore();
  const [results, setResults] = useState<QResult[]>(sub.results);
  const [busy, setBusy] = useState('');
  useEffect(() => setResults(sub.results), [sub]);
  const essays = exam.questions.filter((q) => q.type === 'essay' || (q.type === 'short' && !(q.accepted || []).length));
  const setR = (qid: string, patch: Partial<QResult>) => setResults((rs) => rs.map((r) => (r.qid === qid ? { ...r, ...patch } : r)));
  const gaps = topicStats([{ ...sub, results }], { [exam.id]: exam }).filter((t) => pct(t) < GAP_THRESHOLD);

  const approve = async () => {
    setBusy('save');
    try {
      const fixed = results.map((r) => (r.status === 'pending' ? { ...r, status: (r.earned >= r.max ? 'right' : r.earned > 0 ? 'partial' : 'wrong') as QResult['status'] } : r));
      const ns = regrade(sub, fixed);
      delete (ns as any).aiDraft;
      await onSave(ns);
      toast('Đã lưu điểm: ' + ns.score.toLocaleString('vi-VN'));
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); }
  };

  const review = async (t: ReturnType<typeof topicStats>[number], useAi: boolean) => {
    setBusy(t.topic);
    try {
      const allEx = examMap(exams);
      const content = useAi ? await aiReview({ subject: t.subject, topic: t.topic, wrong: wrongQuestions(t, allEx), percent: pct(t) }) : autoReview(exams, t.subject, t.topic, t.wrongQids);
      if (!useAi) content.questions = [...wrongQuestions(t, allEx).map((w) => w.q).filter((q) => !q.passageId && q.type !== 'essay'), ...content.questions].slice(0, 10);
      if (!content.questions.length) throw new Error('Kho chưa có câu cùng chủ đề – hãy dùng AI soạn.');
      await saveReview(newReview({ classCode: sub.classCode, ownerUid: teacher?.uid, className: sub.className, studentName: sub.studentName, subject: t.subject, topic: t.topic, createdBy: teacher?.name || '', source: useAi ? 'ai' : 'auto' }, content));
      toast(`Đã giao bài ôn "${t.topic}" cho ${sub.studentName}.`);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); }
  };

  const total = summarize(results);
  return (
    <Modal open onClose={onClose} full title={`📄 ${sub.studentName} – Lớp ${sub.className}`}
      footer={<>
        {onDelete && <Btn variant="danger" className="mr-auto" onClick={() => window.confirm('Xoá bài làm này?') && onDelete()}><Trash2 className="w-4 h-4" /> Xoá bài</Btn>}
        <span className="self-center text-sm font-black text-orange-600">Điểm: {total.score.toLocaleString('vi-VN')}/10</span>
        <Btn onClick={approve} loading={busy === 'save'}>Lưu / Duyệt điểm</Btn>
      </>}>
      <div className="text-sm text-slate-600 font-bold mb-3">{exam.title} • Nộp {fmtDate(sub.submittedAt)} • {fmtDur(sub.durationSec)} • {sub.device}</div>
      {gaps.length > 0 && (
        <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-3 mb-4">
          <div className="font-black text-rose-800 mb-2">🔸 Phần em còn hổng – giao bài ôn riêng:</div>
          <div className="space-y-2">
            {gaps.map((t) => (
              <div key={t.topic} className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm flex-1 min-w-[160px]">{t.topic} ({pct(t)}%)</span>
                <Btn small variant="violet" disabled={!hasKey()} loading={busy === t.topic} onClick={() => review(t, true)}><Sparkles className="w-3.5 h-3.5" /> AI soạn bài ôn</Btn>
                <Btn small variant="orange" onClick={() => review(t, false)}>Lấy từ kho</Btn>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        {exam.questions.map((q, i) => {
          const r = results.find((x) => x.qid === q.id);
          const isEssay = essays.includes(q);
          return (
            <div key={q.id} className="rounded-2xl border-2 border-slate-100 p-3">
              <QuestionView q={q} index={i + 1} value={sub.answers[q.id]} reveal readOnly result={r} />
              {isEssay && r && (
                <div className="mt-3 rounded-2xl bg-violet-50 border-2 border-violet-200 p-3 grid gap-2 sm:grid-cols-[120px_1fr_auto] items-end">
                  <Field label={`Điểm (tối đa ${q.points})`}><input type="number" step={0.25} min={0} max={q.points} className={inputCls} value={r.earned} onChange={(e) => setR(q.id, { earned: Math.max(0, Math.min(q.points, +e.target.value || 0)) })} /></Field>
                  <Field label="Nhận xét cho học sinh"><textarea className={inputCls} rows={2} value={r.comment || ''} onChange={(e) => setR(q.id, { comment: e.target.value })} /></Field>
                  <Btn small variant="violet" disabled={!hasKey()} loading={busy === q.id} onClick={async () => {
                    setBusy(q.id);
                    try { const g = await aiGradeEssay(q, sub.answers[q.id], exam.passages.find((p) => p.id === q.passageId)?.content); setR(q.id, { earned: g.points, comment: g.comment }); }
                    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); }
                  }}><Sparkles className="w-3.5 h-3.5" /> AI gợi ý</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
