import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Sparkles, Save, Eye, ChevronDown, ChevronUp, AlertTriangle, BookOpenText } from 'lucide-react';
import type { Exam, ExamKind, Level, Passage, Question, QType, Teacher } from '../types';
import { KIND_LABEL, QTYPE_LABEL } from '../types';
import { Btn, Field, inputCls, Modal, Pill, toast } from './ui';
import { LEVEL_LABEL, LEVEL_SHORT, SUBJECT_NAMES, subjectInfo } from '../curriculum';
import { Rich, plain } from './Rich';
import { uid } from '../grading';
import { askJson, cleanQuestions, hasKey, QUESTION_SCHEMA } from '../ai';
import { useStore } from '../store';

export function blankQuestion(type: QType, topic = ''): Question {
  const base = { id: uid('q'), type, prompt: '', points: type === 'essay' ? 2 : type === 'mcq' ? 0.5 : 1, level: 1 as Level, topic, explanation: '' };
  switch (type) {
    case 'mcq': return { ...base, options: ['', '', '', ''], answer: -1 };
    case 'tf': return { ...base, statements: ['', ''], tfAnswers: [true, false] };
    case 'fill': return { ...base, prompt: '5 m 7 cm = [[0]] m', blanks: ['5,07'] };
    case 'match': return { ...base, pairs: [['', ''], ['', ''], ['', '']] };
    case 'order': return { ...base, items: ['', '', ''] };
    case 'short': return { ...base, accepted: [''] };
    case 'essay': return { ...base, guide: '' };
  }
}

// Ô trống: lưu dạng [[0]] + blanks[], giáo viên sửa dạng [[đáp án]]
const toAuthor = (q: Question) => q.prompt.replace(/\[\[(\d+)\]\]/g, (_, i) => `[[${q.blanks?.[+i] ?? ''}]]`);
function fromAuthor(text: string) {
  const blanks: string[] = [];
  const prompt = text.replace(/\[\[(.*?)\]\]/g, (_, a) => { blanks.push(a); return `[[${blanks.length - 1}]]`; });
  return { prompt, blanks };
}

export function missingAnswer(q: Question) {
  if (q.type === 'mcq') return (q.answer ?? -1) < 0;
  if (q.type === 'fill') return !(q.blanks || []).length || (q.blanks || []).some((b) => !b.trim());
  if (q.type === 'short') return !(q.accepted || []).some((a) => a.trim());
  return false;
}

export function ExamEditor({ exam, onClose, onSave, onPreview }: { exam: Exam; onClose: () => void; onSave: (e: Exam) => Promise<void>; onPreview: (e: Exam) => void }) {
  const { classes } = useStore();
  const [e, setE] = useState<Exam>(() => JSON.parse(JSON.stringify(exam)));
  const [openQ, setOpenQ] = useState<string | null>(exam.questions.length ? null : '');
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState('');
  const topics = subjectInfo(e.subject).topics;

  const upd = (patch: Partial<Exam>) => setE((x) => ({ ...x, ...patch }));
  const updQ = (id: string, patch: Partial<Question>) => setE((x) => ({ ...x, questions: x.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const moveQ = (i: number, d: number) => setE((x) => {
    const qs = [...x.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return x;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...x, questions: qs };
  });
  const addQ = (t: QType) => {
    const q = blankQuestion(t, topics[0] || '');
    setE((x) => ({ ...x, questions: [...x.questions, q] }));
    setOpenQ(q.id);
  };

  const stats = useMemo(() => {
    const total = e.questions.reduce((s, q) => s + (q.points || 0), 0);
    const byLevel = [1, 2, 3].map((l) => e.questions.filter((q) => q.level === l).reduce((s, q) => s + q.points, 0));
    const missing = e.questions.filter(missingAnswer).length;
    return { total, byLevel, missing };
  }, [e.questions]);

  const aiFill = async (only?: string) => {
    const targets = e.questions.filter((q) => (only ? q.id === only : missingAnswer(q) || !q.explanation || !q.topic));
    if (!targets.length) return toast('Tất cả câu đã có đáp án và giải thích.', 'info');
    setAiBusy(only || 'all');
    try {
      const batches: Question[][] = [];
      for (let i = 0; i < targets.length; i += 12) batches.push(targets.slice(i, i + 12));
      let done = 0;
      for (const b of batches) {
        const payload = b.map((q) => ({
          id: q.id, type: q.type, prompt: q.type === 'fill' ? toAuthor(q) : q.prompt, options: q.options, statements: q.statements,
          passage: q.passageId ? plain(e.passages.find((p) => p.id === q.passageId)?.content).slice(0, 2500) : undefined,
        }));
        const r = await askJson<any[]>(`Môn ${e.subject} lớp 5. Với mỗi câu hỏi dưới đây, hãy GIẢI và cho biết:
- "answer": (mcq) chỉ số đáp án đúng bắt đầu từ 0; (tf) "tfAnswers": [true/false...]; (fill) "blanks": [đáp án từng chỗ trống theo thứ tự]; (short) "accepted": [đáp án]; (essay) "guide": hướng dẫn chấm/đáp án mẫu ngắn gọn có biểu điểm.
- "explanation": giải thích ngắn gọn cho học sinh lớp 5 (1–3 câu, có phép tính nếu là Toán).
- "topic": chọn 1 chủ đề phù hợp nhất trong danh sách: ${JSON.stringify(topics)}
- "level": 1, 2 hoặc 3 theo TT27.
Trả về mảng JSON [{"id": "...", ...}] đúng thứ tự.
Câu hỏi: ${JSON.stringify(payload)}`);
        for (const a of r || []) {
          const q = b.find((x) => x.id === a.id);
          if (!q) continue;
          const patch: Partial<Question> = {};
          if (q.type === 'mcq' && Number.isInteger(+a.answer) && +a.answer >= 0 && (only || (q.answer ?? -1) < 0)) patch.answer = +a.answer;
          if (q.type === 'tf' && Array.isArray(a.tfAnswers)) patch.tfAnswers = a.tfAnswers.map((v: any) => v === true || v === 'true');
          if (q.type === 'fill' && Array.isArray(a.blanks) && (only || missingAnswer(q))) patch.blanks = a.blanks.map(String);
          if (q.type === 'short' && Array.isArray(a.accepted) && (only || missingAnswer(q))) patch.accepted = a.accepted.map(String);
          if (q.type === 'essay' && a.guide && (only || !q.guide)) patch.guide = String(a.guide);
          if (a.explanation && (only || !q.explanation)) patch.explanation = String(a.explanation);
          if (a.topic && (only || !q.topic)) patch.topic = String(a.topic);
          if ([1, 2, 3].includes(+a.level) && only) patch.level = +a.level as Level;
          updQ(q.id, patch);
          done++;
        }
      }
      toast(`AI đã gợi ý cho ${done} câu. Thầy cô kiểm tra lại trước khi lưu nhé!`);
    } catch (err: any) {
      toast(err.message, 'err');
    } finally {
      setAiBusy('');
    }
  };

  // Tạo sẵn thẻ ghi nhớ + 2 câu tương tự cho mỗi câu (chạy 1 lần bằng mã AI của giáo viên)
  const aiRescue = async () => {
    const targets = e.questions.filter((q) => q.type !== 'essay' && !q.rescue && !missingAnswer(q));
    if (!targets.length) return toast(e.questions.some(missingAnswer) ? 'Hãy điền đáp án cho các câu trước.' : 'Các câu đã có "Giải cứu kiến thức".', 'info');
    setAiBusy('rescue');
    try {
      let done = 0;
      for (let i = 0; i < targets.length; i += 6) {
        const b = targets.slice(i, i + 6);
        const payload = b.map((q) => ({ id: q.id, type: q.type, topic: q.topic, prompt: q.type === 'fill' ? toAuthor(q) : q.prompt, options: q.options, answer: q.answer, statements: q.statements, tfAnswers: q.tfAnswers, accepted: q.accepted }));
        const r = await askJson<any[]>(`Môn ${e.subject} lớp 5. Với mỗi câu hỏi dưới đây (học sinh vừa làm SAI), hãy tạo "Giải cứu kiến thức":
- "card": thẻ ghi nhớ ngắn đúng 3 dòng (mỗi dòng bắt đầu "• "): quy tắc/kiến thức trọng tâm + lỗi hay gặp + mẹo nhớ. Phân số viết {a/b}.
- "similar": 2 câu hỏi TƯƠNG TỰ cùng dạng, cùng mức độ nhưng ĐỔI số liệu/ngữ cảnh, có đáp án và "explanation". Chỉ dùng dạng mcq, tf, fill, short.
${QUESTION_SCHEMA}
Trả về mảng JSON [{"id": "...", "card": "...", "similar": [...]}].
Câu hỏi: ${JSON.stringify(payload)}`);
        for (const a of r || []) {
          const q = b.find((x) => x.id === a.id);
          if (!q || !a.card) continue;
          updQ(q.id, { rescue: { card: String(a.card), similar: cleanQuestions(a.similar || [], q.topic).filter((x) => x.type !== 'essay').slice(0, 2) } });
          done++;
        }
        setAiBusy('rescue');
      }
      toast(`Đã tạo "Giải cứu kiến thức" cho ${done} câu. Nhớ bấm Lưu đề!`);
    } catch (err: any) { toast(err.message, 'err'); } finally { setAiBusy(''); }
  };

  const save = async () => {
    if (!e.title.trim()) return toast('Đặt tên đề trước khi lưu.', 'err');
    if (!e.questions.length) return toast('Đề chưa có câu hỏi nào.', 'err');
    setSaving(true);
    try {
      await onSave({ ...e, updatedAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} full title={<span className="flex items-center gap-2">✏️ Soạn / chỉnh sửa đề</span>}
      footer={<>
        <span className="mr-auto text-xs font-bold text-slate-600 self-center">
          Tổng {stats.total.toLocaleString('vi-VN')} điểm • M1 {stats.byLevel[0]} • M2 {stats.byLevel[1]} • M3 {stats.byLevel[2]}
          {stats.missing > 0 && <span className="text-rose-600"> • {stats.missing} câu chưa có đáp án</span>}
        </span>
        <Btn variant="ghost" onClick={() => onPreview(e)}><Eye className="w-4 h-4" /> Làm thử</Btn>
        <Btn onClick={save} loading={saving}><Save className="w-4 h-4" /> Lưu đề</Btn>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><Field label="Tên đề"><input className={inputCls} value={e.title} onChange={(x) => upd({ title: x.target.value })} placeholder="VD: Đề ôn tập giữa học kì I – Đề số 1" /></Field></div>
        <Field label="Môn học">
          <select className={inputCls} value={e.subject} onChange={(x) => upd({ subject: x.target.value })}>
            {SUBJECT_NAMES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Loại đề">
          <select className={inputCls} value={e.kind} onChange={(x) => upd({ kind: x.target.value as ExamKind })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Thời gian (phút, 0 = không giới hạn)"><input type="number" min={0} className={inputCls} value={e.duration} onChange={(x) => upd({ duration: +x.target.value || 0 })} /></Field>
        <Field label="Hạn nộp (không bắt buộc)"><input type="date" className={inputCls} value={e.deadline ? e.deadline.slice(0, 10) : ''} onChange={(x) => upd({ deadline: x.target.value ? new Date(x.target.value + 'T23:59:00').toISOString() : undefined })} /></Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Giao cho lớp (học sinh lớp được chọn sẽ thấy đề)">
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const on = (e.classes || []).includes(c.id);
                return <button key={c.id} type="button" onClick={() => upd({ classes: on ? (e.classes || []).filter((x) => x !== c.id) : [...(e.classes || []), c.id] })} className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'}`}>{c.name}</button>;
              })}
              {!classes.length && <span className="text-xs text-slate-500">Chưa có lớp – tạo lớp ở tab "Lớp học & Ôn tập".</span>}
            </div>
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-sm font-bold">
        <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={e.open} onChange={(x) => upd({ open: x.target.checked })} /> Mở cho học sinh làm</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={e.shuffle} onChange={(x) => upd({ shuffle: x.target.checked })} /> Đảo thứ tự câu (chống chép bài)</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={e.showAnswers} onChange={(x) => upd({ showAnswers: x.target.checked })} /> Cho xem đáp án & giải thích sau khi nộp</label>
      </div>

      {/* Bài đọc */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-black text-emerald-800 flex items-center gap-1.5"><BookOpenText className="w-5 h-5" /> Bài đọc ({e.passages.length})</div>
          <Btn small variant="ghost" onClick={() => upd({ passages: [...e.passages, { id: uid('p'), title: '', content: '' }] })}><Plus className="w-3.5 h-3.5" /> Thêm bài đọc</Btn>
        </div>
        {e.passages.map((p, i) => (
          <PassageEditor key={p.id} p={p} onChange={(np) => upd({ passages: e.passages.map((x) => (x.id === p.id ? np : x)) })} onDelete={() => upd({ passages: e.passages.filter((x) => x.id !== p.id), questions: e.questions.map((q) => (q.passageId === p.id ? { ...q, passageId: undefined } : q)) })} index={i} />
        ))}
      </div>

      {/* Câu hỏi */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="font-black text-orange-700 text-lg">Câu hỏi ({e.questions.length})</div>
        <Btn small variant="violet" loading={aiBusy === 'all'} disabled={!hasKey()} title={hasKey() ? '' : 'Cần mã AI trong Cài đặt'} onClick={() => aiFill()}><Sparkles className="w-3.5 h-3.5" /> AI giải & điền đáp án, giải thích, chủ đề cho câu còn thiếu</Btn>
        <Btn small variant="orange" loading={aiBusy === 'rescue'} disabled={!hasKey()} title="Tạo sẵn thẻ ghi nhớ + câu tương tự cho từng câu, học sinh dùng khi làm sai (không tốn AI của học sinh)" onClick={aiRescue}>🛟 AI tạo "Giải cứu kiến thức" ({e.questions.filter((q) => q.type !== 'essay' && q.rescue).length}/{e.questions.filter((q) => q.type !== 'essay').length})</Btn>
      </div>
      <div className="mt-2 space-y-2">
        {e.questions.map((q, i) => (
          <div key={q.id} className={`rounded-2xl border-2 ${missingAnswer(q) ? 'border-rose-200' : 'border-slate-200'} bg-white`}>
            <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => setOpenQ(openQ === q.id ? null : q.id)}>
              <span className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white font-black flex items-center justify-center text-sm">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold line-clamp-2"><Rich text={q.type === 'fill' ? toAuthor(q) : q.prompt || '(chưa có nội dung)'} /></div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill className="bg-slate-100 border-slate-200 text-slate-700">{QTYPE_LABEL[q.type]}</Pill>
                  <Pill className="bg-amber-50 border-amber-200 text-amber-800">{LEVEL_SHORT[q.level]} • {q.points.toLocaleString("vi-VN")}đ</Pill>
                  {q.topic && <Pill className="bg-emerald-50 border-emerald-200 text-emerald-800">{q.topic}</Pill>}
                  {missingAnswer(q) && <Pill className="bg-rose-50 border-rose-200 text-rose-700"><AlertTriangle className="w-3 h-3" /> Chưa có đáp án</Pill>}
                  {q.type === 'mcq' && (q.answer ?? -1) >= 0 && <Pill className="bg-emerald-100 border-emerald-200 text-emerald-800">Đáp án {'ABCD'[q.answer!]}</Pill>}
                </div>
              </div>
              <div className="flex gap-1" onClick={(x) => x.stopPropagation()}>
                <button className="p-1.5 rounded-lg hover:bg-slate-100" onClick={() => moveQ(i, -1)} title="Lên"><ArrowUp className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-lg hover:bg-slate-100" onClick={() => moveQ(i, 1)} title="Xuống"><ArrowDown className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setE((x) => ({ ...x, questions: [...x.questions.slice(0, i + 1), { ...JSON.parse(JSON.stringify(q)), id: uid('q') }, ...x.questions.slice(i + 1)] }))} title="Nhân bản"><Copy className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" onClick={() => window.confirm('Xoá câu này?') && setE((x) => ({ ...x, questions: x.questions.filter((y) => y.id !== q.id) }))} title="Xoá"><Trash2 className="w-4 h-4" /></button>
                {openQ === q.id ? <ChevronUp className="w-5 h-5 mt-1 text-slate-400" /> : <ChevronDown className="w-5 h-5 mt-1 text-slate-400" />}
              </div>
            </div>
            {openQ === q.id && (
              <div className="border-t-2 border-dashed border-slate-200 p-3 sm:p-4">
                <QuestionEditor q={q} topics={topics} passages={e.passages} onChange={(p) => updQ(q.id, p)} />
                <div className="mt-3">
                  <Btn small variant="violet" loading={aiBusy === q.id} disabled={!hasKey()} onClick={() => aiFill(q.id)}><Sparkles className="w-3.5 h-3.5" /> AI giải câu này</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 p-3">
        <div className="text-xs font-black text-orange-800 mb-2">+ THÊM CÂU HỎI</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <Btn key={t} small variant="white" onClick={() => addQ(t)}><Plus className="w-3.5 h-3.5" /> {QTYPE_LABEL[t]}</Btn>)}
        </div>
      </div>
      <Field label="Ghi chú cho học sinh (hiện trước khi làm bài)"><textarea className={inputCls + ' mt-3'} rows={2} value={e.note || ''} onChange={(x) => upd({ note: x.target.value })} /></Field>
    </Modal>
  );
}

function PassageEditor({ p, onChange, onDelete, index }: { p: Passage; onChange: (p: Passage) => void; onDelete: () => void; index: number }) {
  const [open, setOpen] = useState(!p.content);
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3 mb-2">
      <div className="flex items-center gap-2">
        <button className="flex-1 text-left font-bold text-emerald-900" onClick={() => setOpen(!open)}>📖 Bài đọc {index + 1}: {p.title || '(chưa đặt tên)'} <span className="text-xs text-slate-500">({p.content.length} ký tự)</span></button>
        <button className="p-1.5 text-rose-500" onClick={() => window.confirm('Xoá bài đọc này?') && onDelete()}><Trash2 className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="grid gap-2 mt-2">
          <input className={inputCls} value={p.title} onChange={(e) => onChange({ ...p, title: e.target.value })} placeholder="Tên bài đọc" />
          <textarea className={inputCls} rows={8} value={p.content} onChange={(e) => onChange({ ...p, content: e.target.value })} placeholder="Nội dung bài đọc…" />
          <input className={inputCls} value={p.source || ''} onChange={(e) => onChange({ ...p, source: e.target.value })} placeholder="Nguồn (VD: Theo Đỗ Anh Khoa)" />
        </div>
      )}
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, render }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; render?: (i: number) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          {render?.(i)}
          <input className={inputCls} value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder + ' ' + (i + 1)} />
          <button className="p-2 text-rose-500" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <Btn small variant="ghost" onClick={() => onChange([...items, ''])}><Plus className="w-3.5 h-3.5" /> Thêm</Btn>
    </div>
  );
}

export function QuestionEditor({ q, topics, passages, onChange }: { q: Question; topics: string[]; passages: Passage[]; onChange: (p: Partial<Question>) => void }) {
  const [author, setAuthor] = useState(q.type === 'fill' ? toAuthor(q) : '');
  const changeType = (t: QType) => {
    const b = blankQuestion(t, q.topic);
    onChange({ ...b, id: q.id, prompt: t === 'fill' ? q.prompt || b.prompt : q.prompt, points: q.points, level: q.level, explanation: q.explanation, passageId: q.passageId });
    if (t === 'fill') setAuthor(q.prompt || '5 m 7 cm = [[5,07]] m');
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Dạng câu">
          <select className={inputCls} value={q.type} onChange={(e) => changeType(e.target.value as QType)}>
            {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Mức độ (TT27)">
          <select className={inputCls} value={q.level} onChange={(e) => onChange({ level: +e.target.value as Level })}>
            {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </Field>
        <Field label="Điểm"><input type="number" step={0.25} min={0} className={inputCls} value={q.points} onChange={(e) => onChange({ points: +e.target.value || 0 })} /></Field>
        <Field label="Thuộc bài đọc">
          <select className={inputCls} value={q.passageId || ''} onChange={(e) => onChange({ passageId: e.target.value || undefined })}>
            <option value="">— Không —</option>
            {passages.map((p, i) => <option key={p.id} value={p.id}>Bài đọc {i + 1}: {p.title}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Chủ đề / bài học (dùng để tìm phần học sinh bị hổng)">
        <input className={inputCls} list={'topics-' + q.id} value={q.topic} onChange={(e) => onChange({ topic: e.target.value })} placeholder="Chọn hoặc gõ chủ đề" />
        <datalist id={'topics-' + q.id}>{topics.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>

      {q.type === 'fill' ? (
        <Field label="Nội dung – viết đáp án trong [[ ]] tại chỗ trống, nhiều đáp án chấp nhận ngăn bởi |" hint="VD: 3 kg 45 g = [[3,045]] kg • Phân số viết {3/4}">
          <textarea className={inputCls} rows={3} value={author} onChange={(e) => { setAuthor(e.target.value); onChange(fromAuthor(e.target.value)); }} />
        </Field>
      ) : (
        <Field label="Nội dung câu hỏi" hint="Phân số viết {3/4}, hỗn số 2{1/2}, chữ đậm **chữ**">
          <textarea className={inputCls} rows={3} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
        </Field>
      )}
      {(q.prompt.includes('{') || q.prompt.includes('**')) && <div className="text-sm bg-slate-50 rounded-xl p-2 border">Xem trước: <Rich text={q.type === 'fill' ? author : q.prompt} /></div>}

      {q.type === 'mcq' && (
        <Field label="Các lựa chọn – bấm chữ cái để chọn đáp án đúng">
          <ListEditor items={q.options || []} onChange={(v) => onChange({ options: v, answer: (q.answer ?? -1) >= v.length ? -1 : q.answer })} placeholder="Lựa chọn"
            render={(i) => <button type="button" onClick={() => onChange({ answer: i })} className={`shrink-0 w-10 h-10 rounded-full font-black border-2 ${q.answer === i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>{'ABCDEFGH'[i]}</button>} />
        </Field>
      )}
      {q.type === 'tf' && (
        <Field label="Các nhận định – bấm Đ/S để đặt đáp án">
          <ListEditor items={q.statements || []} onChange={(v) => onChange({ statements: v, tfAnswers: v.map((_, i) => q.tfAnswers?.[i] ?? true) })} placeholder="Nhận định"
            render={(i) => <button type="button" onClick={() => onChange({ tfAnswers: (q.statements || []).map((_, j) => (j === i ? !(q.tfAnswers?.[j] ?? true) : q.tfAnswers?.[j] ?? true)) })} className={`shrink-0 w-10 h-10 rounded-xl font-black text-white ${(q.tfAnswers?.[i] ?? true) ? 'bg-emerald-500' : 'bg-rose-500'}`}>{(q.tfAnswers?.[i] ?? true) ? 'Đ' : 'S'}</button>} />
        </Field>
      )}
      {q.type === 'match' && (
        <Field label="Các cặp nối đúng (vế A – vế B). Học sinh sẽ thấy cột B bị xáo trộn.">
          <div className="space-y-2">
            {(q.pairs || []).map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className={inputCls} value={p[0]} placeholder={`A${i + 1}`} onChange={(e) => onChange({ pairs: (q.pairs || []).map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })} />
                <input className={inputCls} value={p[1]} placeholder={`B${i + 1}`} onChange={(e) => onChange({ pairs: (q.pairs || []).map((x, j) => (j === i ? [x[0], e.target.value] : x)) })} />
                <button className="p-2 text-rose-500" onClick={() => onChange({ pairs: (q.pairs || []).filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Btn small variant="ghost" onClick={() => onChange({ pairs: [...(q.pairs || []), ['', '']] })}><Plus className="w-3.5 h-3.5" /> Thêm cặp</Btn>
          </div>
        </Field>
      )}
      {q.type === 'order' && <Field label="Các bước theo ĐÚNG thứ tự (học sinh sẽ thấy bị xáo trộn)"><ListEditor items={q.items || []} onChange={(v) => onChange({ items: v })} placeholder="Bước" /></Field>}
      {q.type === 'short' && <Field label="Đáp án chấp nhận (mỗi dòng một cách viết)" hint="Hệ thống tự hiểu 5,07 = 5.07; 3 000 = 3000; không phân biệt hoa thường"><ListEditor items={q.accepted || []} onChange={(v) => onChange({ accepted: v })} placeholder="Đáp án" /></Field>}
      {q.type === 'essay' && <Field label="Hướng dẫn chấm / đáp án mẫu (AI dùng để gợi ý chấm)"><textarea className={inputCls} rows={3} value={q.guide || ''} onChange={(e) => onChange({ guide: e.target.value })} /></Field>}
      <Field label="Giải thích cho học sinh (hiện khi xem lại bài)"><textarea className={inputCls} rows={2} value={q.explanation || ''} onChange={(e) => onChange({ explanation: e.target.value })} /></Field>
    </div>
  );
}

export function newExam(t: Teacher | null, subject = 'Toán'): Exam {
  const now = new Date().toISOString();
  return {
    id: '', code: '', title: '', subject, grade: 5, kind: 'ontap', duration: 40, passages: [], questions: [],
    author: t?.name || '', authorEmail: t?.email || '', ownerUid: t?.uid, ownerSchool: t?.school, createdAt: now, updatedAt: now, open: true, shuffle: false, showAnswers: true, classes: [], public: false,
  };
}

export { QUESTION_SCHEMA, cleanQuestions };
