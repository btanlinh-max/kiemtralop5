import React, { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import type { Exam, ExamKind, QType } from '../types';
import { KIND_LABEL, QTYPE_LABEL } from '../types';
import { Btn, Field, inputCls, Modal, toast } from './ui';
import { SUBJECT_NAMES, subjectInfo } from '../curriculum';
import { askJson, cleanQuestions, hasKey, QUESTION_SCHEMA } from '../ai';
import { uid } from '../grading';
import { newExam } from './ExamEditor';
import { useStore } from '../store';

export function AiCreateModal({ onClose, onCreated, preset }: { onClose: () => void; onCreated: (e: Exam) => void; preset?: { subject?: string; topics?: string[]; kind?: ExamKind; title?: string } }) {
  const { teacher } = useStore();
  const [subject, setSubject] = useState(preset?.subject || 'Toán');
  const [kind, setKind] = useState<ExamKind>(preset?.kind || 'ontap');
  const [title, setTitle] = useState(preset?.title || '');
  const [topics, setTopics] = useState<string[]>(preset?.topics || []);
  const [custom, setCustom] = useState('');
  const [m, setM] = useState([4, 4, 2]);
  const [types, setTypes] = useState<QType[]>(['mcq', 'tf', 'fill', 'essay']);
  const [reading, setReading] = useState(false);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const info = subjectInfo(subject);
  const total = m[0] + m[1] + m[2];

  const run = async () => {
    const tp = [...topics, ...custom.split(/[\n;]/).map((x) => x.trim()).filter(Boolean)];
    if (!tp.length) return toast('Chọn ít nhất 1 chủ đề / bài học.', 'err');
    if (!types.length) return toast('Chọn ít nhất 1 dạng câu hỏi.', 'err');
    setBusy(true);
    try {
      const r = await askJson<any>(`Soạn ${KIND_LABEL[kind].toLowerCase()} môn ${subject} lớp 5 (sách Kết nối tri thức với cuộc sống), đúng ma trận Thông tư 27:
- Chủ đề/bài: ${tp.join('; ')}
- Số câu: Mức 1: ${m[0]} câu, Mức 2: ${m[1]} câu, Mức 3: ${m[2]} câu (tổng ${total} câu). Tổng điểm đúng 10 điểm (phân bổ điểm hợp lí, câu khó điểm cao hơn).
- Chỉ dùng các dạng câu: ${types.map((t) => t + ' (' + QTYPE_LABEL[t] + ')').join(', ')}. Đa dạng dạng câu.
${reading ? '- Có 1 bài đọc (văn bản 180–300 chữ, phù hợp chủ điểm lớp 5, văn bản tự viết hoặc trích có ghi nguồn) và phần lớn câu hỏi đọc hiểu gắn với bài đọc ("passageIndex": 0).' : ''}
- Ngữ liệu, số liệu gần gũi với học sinh Việt Nam; không lặp ý; mỗi câu có "explanation".
${extra ? '- Yêu cầu thêm của giáo viên: ' + extra : ''}
${QUESTION_SCHEMA}
Trả về JSON: {"title": "tên đề", "passages": [{"title": "", "content": "", "source": ""}], "questions": [...]}`);
      const passages = (r.passages || []).filter((p: any) => p?.content).map((p: any) => ({ id: uid('p'), title: String(p.title || ''), content: String(p.content), source: p.source ? String(p.source) : undefined }));
      const qs = cleanQuestions((r.questions || []).map((q: any) => ({ ...q, passageId: Number.isInteger(q.passageIndex) ? passages[q.passageIndex]?.id : undefined })), tp[0]);
      if (!qs.length) throw new Error('AI chưa tạo được câu hỏi, thử lại nhé.');
      const e = newExam(teacher, subject);
      onCreated({ ...e, title: title || r.title || `${KIND_LABEL[kind]} ${subject} – ${tp[0]}`, kind, passages, questions: qs, duration: subject === 'Tiếng Việt' ? 60 : 40 });
    } catch (err: any) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} wide title="✨ AI soạn đề theo ma trận TT27"
      footer={<Btn variant="violet" onClick={run} loading={busy} disabled={!hasKey()}><Wand2 className="w-4 h-4" /> {busy ? 'AI đang soạn đề (20–40 giây)…' : 'Soạn đề'}</Btn>}>
      {!hasKey() && <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-3 text-sm font-bold text-rose-700 mb-3">Cần mã AI Gemini của thầy cô. Vào tab ⚙️ Cài đặt → "Mã AI Gemini" (miễn phí, 2 phút).</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Môn học"><select className={inputCls} value={subject} onChange={(e) => { setSubject(e.target.value); setTopics([]); setReading(e.target.value === 'Tiếng Việt' || e.target.value === 'Tiếng Anh'); }}>{SUBJECT_NAMES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Loại đề"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as ExamKind)}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Tên đề (không bắt buộc)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AI tự đặt" /></Field>
      </div>
      <div className="mt-4">
        <div className="text-xs font-bold text-slate-600 mb-1">Chủ đề / bài học (chọn nhiều)</div>
        <div className="flex flex-wrap gap-1.5">
          {info.topics.map((t) => {
            const on = topics.includes(t);
            return <button key={t} onClick={() => setTopics(on ? topics.filter((x) => x !== t) : [...topics, t])} className={`px-2.5 py-1.5 rounded-xl text-[13px] font-bold border-2 text-left ${on ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200'}`}>{t}</button>;
          })}
        </div>
        <input className={inputCls + ' mt-2'} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Hoặc gõ tên bài cụ thể, VD: Bài 15. Luyện tập chung (ngăn bởi dấu ;)" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['Mức 1 – Nhận biết', 'Mức 2 – Kết nối', 'Mức 3 – Vận dụng'].map((l, i) => (
          <Field key={i} label={l}><input type="number" min={0} max={30} className={inputCls} value={m[i]} onChange={(e) => setM(m.map((x, j) => (j === i ? Math.max(0, +e.target.value || 0) : x)))} /></Field>
        ))}
      </div>
      <div className="text-xs font-bold text-slate-500 mt-1">Tổng {total} câu • tỉ lệ M1/M2/M3 ≈ {total ? Math.round((m[0] / total) * 100) : 0}% / {total ? Math.round((m[1] / total) * 100) : 0}% / {total ? Math.round((m[2] / total) * 100) : 0}%</div>
      <div className="mt-4">
        <div className="text-xs font-bold text-slate-600 mb-1">Dạng câu hỏi</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => {
            const on = types.includes(t);
            return <button key={t} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])} className={`px-2.5 py-1.5 rounded-xl text-[13px] font-bold border-2 ${on ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200'}`}>{QTYPE_LABEL[t]}</button>;
          })}
        </div>
      </div>
      <label className="flex items-center gap-2 mt-4 text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={reading} onChange={(e) => setReading(e.target.checked)} /> Có bài đọc hiểu (Tiếng Việt / Tiếng Anh / Lịch sử…)</label>
      <Field label="Yêu cầu thêm (không bắt buộc)"><textarea className={inputCls} rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="VD: dành cho học sinh cần hỗ trợ, số liệu nhỏ; có 1 câu toán thực tế về đi chợ…" /></Field>
      <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5"><Sparkles className="w-4 h-4 text-violet-500 shrink-0" /> AI chỉ gợi ý – đề mở ra trong trình soạn thảo để thầy cô kiểm tra, sửa rồi mới lưu.</div>
    </Modal>
  );
}
