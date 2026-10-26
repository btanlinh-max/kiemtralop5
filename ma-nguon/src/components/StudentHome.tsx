import React, { useEffect, useMemo, useState } from 'react';
import { Sprout, RefreshCw, KeyRound, PlayCircle, Target, History, Sparkles, ChevronLeft, CheckCircle2, Search } from 'lucide-react';
import type { ClassRoom, Exam, Review, Submission } from '../types';
import { useStore, friendly } from '../store';
import { addAct, classReviews, classSubs, getClass, reviewProgress } from '../api';
import { Journey } from './Journey';
import { uid } from '../grading';
import { Bar, Btn, Card, Empty, Field, inputCls, Pill, toast } from './ui';
import { COLOR_CHIP, subjectInfo, SUBJECT_NAMES } from '../curriculum';
import { fmtDate, pct, rank } from '../grading';
import { autoReview, studentGaps } from '../reviewGen';
import { Practice } from './Practice';
import { KIND_LABEL } from '../types';
import { hasKey } from '../ai';
import { aiReview, wrongQuestions } from '../reviewGen';

export function StudentLogin({ presetCode }: { presetCode?: string }) {
  const { profile, setProfile } = useStore();
  const [code, setCode] = useState(presetCode || profile.classCode || '');
  const [cls, setCls] = useState<ClassRoom | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const find = async (c = code) => {
    c = c.trim().toUpperCase();
    if (c.length < 4) return;
    setBusy(true);
    try {
      const k = await getClass(c);
      if (!k) toast('Không tìm thấy lớp có mã ' + c + '. Em hỏi lại cô mã lớp nhé!', 'err');
      setCls(k);
    } catch (e: any) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  useEffect(() => { if (presetCode) find(presetCode); }, [presetCode]);

  const ok = cls && name.trim().length >= 2;
  return (
    <Card className="p-5 max-w-xl mx-auto">
      <div className="text-center mb-4">
        <div className="text-5xl">🎒</div>
        <div className="font-black text-xl text-emerald-800">Chào em! Vào lớp của em nào</div>
        <div className="text-sm text-slate-500">Nhập mã lớp cô giáo gửi (hoặc quét mã QR), rồi chọn tên của em.</div>
      </div>
      <div className="space-y-3">
        <Field label="Mã lớp">
          <div className="flex gap-2">
            <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCls(null); }} onKeyDown={(e) => e.key === 'Enter' && find()} maxLength={8} placeholder="VD: AB12CD"
              className="flex-1 min-w-0 rounded-2xl border-2 border-orange-300 px-4 py-3 text-xl font-black tracking-[0.3em] uppercase text-center focus:outline-none focus:border-orange-500" />
            <Btn variant="orange" onClick={() => find()} loading={busy} disabled={code.trim().length < 4}>Tìm lớp</Btn>
          </div>
        </Field>
        {cls && (
          <>
            <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3 text-center">
              <div className="font-black text-emerald-800 text-lg">Lớp {cls.name}</div>
              <div className="text-xs text-slate-600 font-bold">{cls.school}{cls.province ? ' – ' + cls.province : ''} • GV: {cls.ownerName}</div>
            </div>
            <Field label="Họ và tên của em">
              {cls.students.length ? (
                <select className={inputCls} value={name} onChange={(e) => setName(e.target.value)}>
                  <option value="">— Chọn tên em —</option>
                  {cls.students.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Minh An" autoComplete="name" />
              )}
            </Field>
            <Btn className="w-full py-3 text-base" disabled={!ok} onClick={() => setProfile({ ...profile, role: 'student', classCode: cls.id, className: cls.name, teacherName: cls.ownerName, studentName: name.trim().replace(/\s+/g, ' ') })}>Bắt đầu học thôi! 🚀</Btn>
          </>
        )}
      </div>
    </Card>
  );
}

export type StudentTab = 'exams' | 'journey' | 'review' | 'history';
export function StudentHome({ onStart, initialTab }: { onStart: (exam: Exam) => void; initialTab?: StudentTab }) {
  const { classExams: allExams, profile, loading, refreshStudent, myClass } = useStore();
  const me = profile.classCode + '|' + profile.studentName;
  const exams = allExams.filter((e) => !(e.targets || []).some((t) => t.startsWith(profile.classCode + '|')) || (e.targets || []).some((t) => t.toLowerCase() === me.toLowerCase()));
  const [tab, setTab] = useState<StudentTab>(initialTab || 'exams');
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('');
  const [subs, setSubs] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const loadMine = async () => {
    try {
      const f = { studentName: profile.studentName };
      const [s, r] = await Promise.all([classSubs(profile.classCode, f), classReviews(profile.classCode, f)]);
      setSubs(s);
      setReviews(r);
    } catch {
      try { setSubs(JSON.parse(localStorage.getItem('kt5_mysubs') || '[]').filter((x: Submission) => x.studentName === profile.studentName)); } catch {}
    }
  };
  useEffect(() => { loadMine(); }, [profile.studentName, profile.classCode]);

  const open = exams;
  const shown = open.filter((e) => !subject || e.subject === subject).sort((a, b) => Number(subs.some((x) => x.examId === a.id)) - Number(subs.some((x) => x.examId === b.id)));
  const doneIds = new Set(subs.map((s) => s.examId));

  const go = () => {
    const c = code.trim().toUpperCase();
    const ex = exams.find((e) => e.id === c || e.code === c);
    if (!ex) return toast('Không tìm thấy đề có mã ' + c + ' trong lớp em. Em kiểm tra lại nhé!', 'err');
    onStart(ex);
  };

  const tabs = [
    { k: 'exams', label: 'Bài cần làm', icon: <PlayCircle className="w-5 h-5" /> },
    { k: 'journey', label: 'Hành trình của em', icon: <Sprout className="w-5 h-5" /> },
    { k: 'review', label: 'Góc ôn tập', icon: <Target className="w-5 h-5" /> },
    { k: 'history', label: 'Kết quả của em', icon: <History className="w-5 h-5" /> },
  ] as const;

  return (
    <div className="max-w-[1280px] mx-auto px-2 sm:px-4 space-y-4">
      {myClass?.notice && <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 px-4 py-3 text-[15px] font-bold text-sky-900">📢 {myClass.notice}</div>}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-2xl px-1 sm:px-2 py-3 font-black text-[11px] sm:text-base leading-tight flex flex-col sm:flex-row items-center justify-center gap-1.5 border-2 transition ${tab === t.k ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-white border-amber-200 text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'exams' && (
        <>
          <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-3">
            <div className="text-4xl">🏫</div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-orange-800">Lớp {profile.className} <span className="text-xs font-bold text-slate-500">(mã {profile.classCode})</span></div>
              <div className="text-xs text-slate-600 font-bold">GV: {profile.teacherName} • Đề cô giao cho lớp hiện ở dưới</div>
            </div>
            <Btn small variant="ghost" onClick={() => { refreshStudent(); loadMine(); }} loading={loading}><RefreshCw className="w-4 h-4" /></Btn>
          </Card>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setSubject('')} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${!subject ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}>Tất cả</button>
            {SUBJECT_NAMES.filter((s) => open.some((e) => e.subject === s)).map((s) => (
              <button key={s} onClick={() => setSubject(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${subject === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}>{subjectInfo(s).icon} {s}</button>
            ))}
          </div>

          {loading ? <div className="text-center py-10 font-bold text-slate-500">Đang tải đề…</div> : shown.length === 0 ? (
            <Card><Empty icon="🎈" title="Chưa có bài nào đang mở">Khi cô giao bài, đề sẽ hiện ở đây. Em cũng có thể nhập mã đề ở trên.</Empty></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => {
                const si = subjectInfo(e.subject);
                const done = doneIds.has(e.id);
                return (
                  <Card key={e.id} className="p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Pill className={COLOR_CHIP[si.color]}>{si.icon} {e.subject}</Pill>
                      <Pill className="bg-white border-slate-200 text-slate-600">{KIND_LABEL[e.kind]}</Pill>
                      {done && <Pill className="bg-emerald-100 text-emerald-800 border-emerald-200">✓ Đã làm</Pill>}
                      {e.deadline && !done && <Pill className={new Date(e.deadline) < new Date() ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>⏰ Hạn {new Date(e.deadline).toLocaleDateString('vi-VN')}</Pill>}
                      {e.group && <Pill className="bg-violet-100 text-violet-800 border-violet-200">{e.group}</Pill>}
                    </div>
                    <div className="font-black text-slate-800 flex-1">{e.title}</div>
                    <div className="text-xs text-slate-500 font-bold mt-1">{e.questions.length} câu • {e.duration ? e.duration + ' phút' : 'Không giới hạn giờ'}</div>
                    <Btn variant={done ? 'ghost' : 'orange'} className="mt-3" onClick={() => onStart(e)}><PlayCircle className="w-4 h-4" /> {done ? 'Làm lại' : 'Bắt đầu làm bài'}</Btn>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'journey' && <Journey exams={allExams} onGoReview={() => setTab('review')} />}
      {tab === 'review' && <ReviewCorner subs={subs} reviews={reviews} exams={allExams} reload={loadMine} />}

      {tab === 'history' && (
        subs.length === 0 ? <Card><Empty icon="📝" title="Em chưa làm bài nào">Làm bài xong, kết quả sẽ hiện ở đây.</Empty></Card> : (
          <div className="space-y-2">
            {subs.map((s) => {
              const r = rank(s.score);
              return (
                <Card key={s.id} className="p-4 flex items-center gap-3">
                  <div className="text-3xl">{subjectInfo(s.subject).icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black truncate">{s.examTitle}</div>
                    <div className="text-xs text-slate-500 font-bold">{fmtDate(s.submittedAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-orange-500">{s.score.toLocaleString('vi-VN')}</div>
                    {s.pending ? <span className="text-[11px] font-bold text-sky-700">Chờ chấm tự luận</span> : <span className={`text-[11px] font-black rounded-full px-2 py-0.5 ${r.cls}`}>{r.label}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function getAutoProg(): Record<string, number> { try { return JSON.parse(localStorage.getItem('kt5_autoprog') || '{}'); } catch { return {}; } }

function ReviewCorner({ subs, reviews, exams, reload }: { subs: Submission[]; reviews: Review[]; exams: Exam[]; reload: () => void }) {
  const { profile, myClass } = useStore();
  const { stats, gaps, byId } = useMemo(() => studentGaps(subs, exams), [subs, exams]);
  const [open, setOpen] = useState<{ title: string; review?: Review; content: Pick<Review, 'summary' | 'example' | 'tips' | 'questions'>; key: string } | null>(null);
  const [auto, setAuto] = useState(getAutoProg);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');

  if (open) {
    return (
      <div className="space-y-3">
        <Btn variant="ghost" onClick={() => { setOpen(null); reload(); }}><ChevronLeft className="w-4 h-4" /> Quay lại Góc ôn tập</Btn>
        <Card className="p-4 sm:p-6">
          <Practice title={open.title} {...open.content} onFinish={async (p, info) => {
            const [subject, topic] = open.review ? [open.review.subject, open.review.topic] : open.key.split('¦');
            addAct({ id: uid('a'), classCode: profile.classCode, studentName: profile.studentName, kind: open.review ? 'review' : 'practice', subject, topic, correct: info.correct, total: info.total, percent: p, durationSec: info.durationSec, at: new Date().toISOString() });
            if (open.review) {
              try { await reviewProgress(open.review, p); } catch {}
            } else {
              const n = { ...auto, [open.key]: Math.max(auto[open.key] || 0, p) };
              setAuto(n);
              try { localStorage.setItem('kt5_autoprog', JSON.stringify(n)); } catch {}
            }
          }} />
        </Card>
      </div>
    );
  }

  const assigned = reviews.filter((r) => !q || r.topic.toLowerCase().includes(q.toLowerCase()));
  const strong = stats.filter((t) => pct(t) >= 70);

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="font-black text-emerald-800 text-lg">🎯 Góc ôn tập của {profile.studentName.split(' ').slice(-1)[0]}</div>
        <div className="text-sm text-slate-600">Hệ thống tự tìm những phần em còn hổng qua các bài đã làm, và cô giáo soạn bài ôn riêng cho em. Làm đúng từ 80% là phần đó <b>"Đã vững" ✅</b>.</div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white rounded-xl p-2 border"><div className="text-2xl font-black text-rose-500">{gaps.length}</div><div className="text-[11px] font-bold text-slate-500">Phần cần ôn</div></div>
          <div className="bg-white rounded-xl p-2 border"><div className="text-2xl font-black text-violet-600">{reviews.length}</div><div className="text-[11px] font-bold text-slate-500">Bài ôn cô giao</div></div>
          <div className="bg-white rounded-xl p-2 border"><div className="text-2xl font-black text-emerald-600">{strong.length + reviews.filter((r) => r.mastered).length}</div><div className="text-[11px] font-bold text-slate-500">Phần đã vững</div></div>
        </div>
      </Card>

      {reviews.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="font-black text-violet-800 flex-1">📚 Bài ôn cô soạn riêng cho em</div>
            {reviews.length > 4 && <div className="relative"><Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…" className="pl-7 pr-2 py-1.5 rounded-xl border text-sm w-32" /></div>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {assigned.map((r) => (
              <Card key={r.id} className={`p-4 ${r.mastered ? 'border-emerald-300' : 'border-violet-200'}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Pill className={COLOR_CHIP[subjectInfo(r.subject).color]}>{subjectInfo(r.subject).icon} {r.subject}</Pill>
                  {r.mastered ? <Pill className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Đã vững</Pill> : <Pill className="bg-violet-100 text-violet-800 border-violet-200">Cần ôn</Pill>}
                </div>
                <div className="font-black">{r.topic}</div>
                <div className="text-xs text-slate-500 font-bold">{r.questions.length} câu luyện • {r.attempts ? `Đã luyện ${r.attempts} lần, cao nhất ${r.best}%` : 'Chưa luyện'}</div>
                <Btn variant="violet" className="mt-2 w-full" onClick={() => setOpen({ title: `Ôn tập: ${r.topic}`, review: r, content: r, key: r.id })}><Sparkles className="w-4 h-4" /> Vào ôn tập</Btn>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="font-black text-rose-700 mb-2">🔸 Những phần em cần ôn thêm (tự động phát hiện)</div>
        {gaps.length === 0 ? (
          <Card><Empty icon="🌟" title={subs.length ? 'Em chưa có phần nào bị hổng. Giỏi lắm!' : 'Em làm bài kiểm tra/khảo sát trước nhé'}>{subs.length ? 'Tiếp tục làm các đề ôn để giữ phong độ nhé.' : 'Sau khi làm bài, hệ thống sẽ chỉ ra phần em cần ôn.'}</Empty></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {gaps.map((t) => {
              const key = t.subject + '¦' + t.topic;
              const best = auto[key] || 0;
              const mastered = best >= 80 || reviews.some((r) => r.topic === t.topic && r.mastered);
              return (
                <Card key={key} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Pill className={COLOR_CHIP[subjectInfo(t.subject).color]}>{subjectInfo(t.subject).icon} {t.subject}</Pill>
                    {mastered && <Pill className="bg-emerald-100 text-emerald-800 border-emerald-200">✅ Đã vững</Pill>}
                  </div>
                  <div className="font-black">{t.topic}</div>
                  <div className="flex items-center gap-2 mt-1"><Bar value={pct(t)} className="flex-1" /><span className="text-xs font-black">{pct(t)}%</span></div>
                  <div className="text-xs text-slate-500 font-bold mt-1">Sai {t.wrongQids.length} câu{best ? ` • Luyện cao nhất ${best}%` : ''}</div>
                  {myClass?.videos?.[t.topic] && <a href={myClass.videos[t.topic]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs font-black text-rose-600 underline">▶️ Xem video bài giảng của cô</a>}
                  <div className="flex gap-2 mt-2">
                    <Btn variant="orange" small className="flex-1" onClick={() => {
                      const c = autoReview(exams, t.subject, t.topic, t.wrongQids);
                      const wrong = wrongQuestions(t, byId).map((w) => ({ ...w.q, id: w.q.id + '_again' }));
                      c.questions = [...wrong.filter((x) => !x.passageId && x.type !== 'essay'), ...c.questions].slice(0, 10);
                      if (!c.questions.length) return toast('Kho đề chưa có câu luyện cho phần này. Em nhờ cô soạn bài ôn nhé!', 'info');
                      setOpen({ title: `Luyện tập: ${t.topic}`, content: c, key });
                    }}>✏️ Luyện ngay</Btn>
                    {hasKey() && (
                      <Btn variant="violet" small className="flex-1" loading={busy === key} onClick={async () => {
                        setBusy(key);
                        try {
                          const c = await aiReview({ subject: t.subject, topic: t.topic, wrong: wrongQuestions(t, byId), percent: pct(t) });
                          setOpen({ title: `AI giảng lại: ${t.topic}`, content: c, key });
                        } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); }
                      }}><Sparkles className="w-4 h-4" /> AI giảng lại</Btn>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
