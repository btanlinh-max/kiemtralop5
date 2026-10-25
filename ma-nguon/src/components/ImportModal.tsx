import React, { useState } from 'react';
import { FileUp, Sparkles, Zap, CheckSquare, Square, Save, PencilLine } from 'lucide-react';
import type { Exam, ExamKind } from '../types';
import { KIND_LABEL } from '../types';
import { Btn, Field, inputCls, Modal, toast } from './ui';
import { SUBJECT_NAMES, subjectInfo } from '../curriculum';
import { detectSubject, parseExams, splitExamTexts, ParsedExam } from '../parser';
import { docxToText, fileToBase64, pdfToText } from '../docx';
import { askJson, cleanQuestions, hasKey, QUESTION_SCHEMA } from '../ai';
import { uid } from '../grading';
import { newExam, missingAnswer } from './ExamEditor';
import { useStore } from '../store';

export function ImportModal({ onClose, onSaveMany, onEdit, onSaveResource }: {
  onClose: () => void;
  onSaveMany: (exams: Exam[]) => Promise<void>;
  onEdit: (e: Exam) => void;
  onSaveResource?: (file: File, subject: string, kind: string) => Promise<void>;
}) {
  const { teacher } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('Toán');
  const [kind, setKind] = useState<ExamKind>('ontap');
  const [mode, setMode] = useState<'fast' | 'ai'>('fast');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<Exam[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keepFile, setKeepFile] = useState(true);

  const readFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setBusy('read');
    try {
      const buf = await f.arrayBuffer();
      let t = '';
      if (/\.docx$/i.test(f.name)) t = await docxToText(buf);
      else if (/\.pdf$/i.test(f.name)) t = await pdfToText(buf);
      else if (/\.(txt|md)$/i.test(f.name)) t = new TextDecoder().decode(buf);
      else if (/\.doc$/i.test(f.name)) throw new Error('File .doc (Word cũ) – thầy cô mở bằng Word rồi "Lưu thành" .docx giúp nhé.');
      else throw new Error('Chỉ nhận file Word (.docx), PDF hoặc .txt');
      setText(t);
      setSubject(detectSubject(t, subject));
      if (/\.pdf$/i.test(f.name) && t.replace(/\s/g, '').length < 100) {
        setMode('ai');
        toast('PDF này là ảnh chụp (không có chữ) – cần dùng AI để đọc.', 'info');
      }
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy('');
    }
  };

  const toExam = (p: ParsedExam, i: number): Exam => {
    const e = newExam(teacher, p.subject || subject);
    return { ...e, id: uid('tmp'), title: p.title, kind, passages: p.passages, questions: p.questions, duration: p.subject === 'Tiếng Việt' ? 60 : 40, updatedAt: new Date(Date.now() - i).toISOString() };
  };

  const analyze = async () => {
    setBusy('parse');
    try {
      if (mode === 'fast') {
        const base = file ? file.name.replace(/\.[^.]+$/, '') : 'Đề';
        const ps = parseExams(text, subject, base).filter((p) => p.questions.length);
        if (!ps.length) throw new Error('Không nhận ra câu hỏi nào. Thử chế độ "AI đọc đề".');
        const ex = ps.map(toExam);
        setResult(ex);
        setPicked(new Set(ex.map((x) => x.id)));
      } else {
        if (!hasKey()) throw new Error('Cần mã AI Gemini (⚙️ Cài đặt) để dùng chế độ AI.');
        const out: Exam[] = [];
        const isScan = file && /\.pdf$/i.test(file.name) && text.replace(/\s/g, '').length < 100;
        const chunks = isScan ? [{ title: file!.name, text: '' }] : splitExamTexts(text);
        for (let i = 0; i < chunks.length; i++) {
          setBusy(`ai ${i + 1}/${chunks.length}`);
          const c = chunks[i];
          const files = isScan ? [{ mime: 'application/pdf', data: await fileToBase64(file!) }] : undefined;
          const r = await askJson<any>(`Đây là ${isScan ? 'file PDF' : 'nội dung'} một đề ${KIND_LABEL[kind].toLowerCase()} môn ${subject} lớp 5. Hãy chuyển thành dữ liệu câu hỏi tương tác:
- Giữ nguyên nội dung câu hỏi, bỏ phần "(M1 – 0,5 điểm)" ra khỏi prompt nhưng điền vào level, points.
- Câu khoanh A/B/C/D → mcq; câu Đúng ghi Đ/Sai ghi S → tf; câu điền số/chữ vào chỗ chấm có 1 đáp án rõ ràng → fill (đáp án trong [[ ]]); câu tính toán/giải toán/viết câu/viết đoạn → essay (kèm guide là đáp án và biểu điểm).
- GIẢI từng câu để điền đáp án đúng và "explanation".
- Bài đọc (nếu có) đưa vào passages; câu hỏi thuộc bài đọc ghi "passageIndex": 0.
- "topic": chọn trong ${JSON.stringify(subjectInfo(subject).topics)}
${QUESTION_SCHEMA}
Trả về JSON: {"title": "tên đề", "passages": [{"title": "", "content": "", "source": ""}], "questions": [...]}
${isScan ? '' : '\nNỘI DUNG ĐỀ:\n' + c.text.slice(0, 30000)}`, { files });
          const passages = (r.passages || []).filter((p: any) => p && p.content).map((p: any) => ({ id: uid('p'), title: String(p.title || ''), content: String(p.content), source: p.source ? String(p.source) : undefined }));
          const qs = cleanQuestions((r.questions || []).map((q: any) => ({ ...q, passageId: Number.isInteger(q.passageIndex) ? passages[q.passageIndex]?.id : undefined })));
          out.push(toExam({ title: [r.title || (file?.name || 'Đề').replace(/\.[^.]+$/, ''), chunks.length > 1 ? c.title : ''].filter(Boolean).join(' – '), subject, passages, questions: qs }, i));
        }
        setResult(out);
        setPicked(new Set(out.map((x) => x.id)));
      }
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy('');
    }
  };

  const saveAll = async () => {
    if (!result) return;
    setBusy('save');
    try {
      const chosen = result.filter((x) => picked.has(x.id));
      await onSaveMany(chosen);
      if (keepFile && file && onSaveResource) await onSaveResource(file, subject, KIND_LABEL[kind]).catch(() => {});
      toast(`Đã lưu ${chosen.length} đề vào kho.`);
      onClose();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal open onClose={onClose} wide title="📤 Tải đề từ file Word / PDF"
      footer={result ? <>
        <Btn variant="ghost" onClick={() => setResult(null)}>← Làm lại</Btn>
        <Btn onClick={saveAll} loading={busy === 'save'} disabled={!picked.size}><Save className="w-4 h-4" /> Lưu {picked.size} đề vào kho</Btn>
      </> : <Btn onClick={analyze} loading={!!busy} disabled={!text.trim() && !(file && mode === 'ai')}>{busy.startsWith('ai') ? 'AI đang đọc ' + busy.slice(3) : 'Nhận diện đề'}</Btn>}>
      {!result ? (
        <div className="space-y-4">
          <label className="block rounded-3xl border-4 border-dashed border-orange-300 bg-orange-50/60 p-6 text-center cursor-pointer hover:bg-orange-50">
            <FileUp className="w-10 h-10 mx-auto text-orange-500" />
            <div className="font-black text-orange-800 mt-2">{file ? file.name : 'Bấm để chọn file đề (.docx, .pdf)'}</div>
            <div className="text-xs text-slate-500 mt-1">Một file có thể chứa nhiều đề (Đề số 1, Đề số 2…) – hệ thống tự tách. Phân số trong Word được giữ nguyên.</div>
            <input type="file" accept=".docx,.pdf,.txt,.doc" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          {busy === 'read' && <div className="text-center font-bold text-slate-500">Đang đọc file…</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Môn học"><select className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECT_NAMES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Loại đề"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as ExamKind)}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setMode('fast')} className={`text-left rounded-2xl border-2 p-3 ${mode === 'fast' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
              <div className="font-black flex items-center gap-1.5"><Zap className="w-4 h-4 text-emerald-600" /> Đọc nhanh (không cần AI)</div>
              <div className="text-xs text-slate-600 mt-1">Tách đề, câu trắc nghiệm A/B/C/D, Đúng/Sai, mức độ, điểm, bài đọc. Sau đó có thể bấm "AI giải & điền đáp án".</div>
            </button>
            <button onClick={() => setMode('ai')} className={`text-left rounded-2xl border-2 p-3 ${mode === 'ai' ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
              <div className="font-black flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-600" /> AI đọc đề {hasKey() ? '' : '(cần mã AI)'}</div>
              <div className="text-xs text-slate-600 mt-1">AI tự giải, điền đáp án, giải thích, phân loại chủ đề; đọc được cả PDF ảnh chụp. Chậm hơn (~20 giây/đề).</div>
            </button>
          </div>
          {onSaveResource && file && <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} /> Lưu luôn file gốc vào mục Tài liệu để đồng nghiệp tải về</label>}
          <details className="text-sm">
            <summary className="cursor-pointer font-bold text-slate-600">Hoặc dán nội dung đề vào đây {text && `(${text.length.toLocaleString('vi-VN')} ký tự đã đọc)`}</summary>
            <textarea className={inputCls + ' mt-2 font-mono text-xs'} rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Câu 1: (M1 – 0,5 điểm) ...\nA. ... B. ... C. ... D. ...'} />
          </details>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="font-black text-emerald-800 flex-1">Nhận diện được {result.length} đề</div>
            <Btn small variant="ghost" onClick={() => setPicked(picked.size === result.length ? new Set() : new Set(result.map((x) => x.id)))}>{picked.size === result.length ? 'Bỏ chọn hết' : 'Chọn hết'}</Btn>
          </div>
          {result.map((x) => {
            const miss = x.questions.filter(missingAnswer).length;
            const on = picked.has(x.id);
            return (
              <div key={x.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${on ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                <button onClick={() => { const n = new Set(picked); on ? n.delete(x.id) : n.add(x.id); setPicked(n); }}>{on ? <CheckSquare className="w-6 h-6 text-emerald-600" /> : <Square className="w-6 h-6 text-slate-400" />}</button>
                <div className="flex-1 min-w-0">
                  <input className="w-full font-black bg-transparent border-b border-dashed border-slate-300 focus:outline-none" value={x.title} onChange={(e) => setResult(result.map((y) => (y.id === x.id ? { ...y, title: e.target.value } : y)))} />
                  <div className="text-xs text-slate-600 font-bold mt-1">
                    {subjectInfo(x.subject).icon} {x.subject} • {x.questions.length} câu ({x.questions.filter((q) => q.type === 'mcq').length} trắc nghiệm, {x.questions.filter((q) => q.type === 'essay').length} tự luận{x.questions.some((q) => q.type === 'tf') ? ', có câu Đ/S' : ''}){x.passages.length ? ` • ${x.passages.length} bài đọc` : ''}
                    {miss > 0 && <span className="text-rose-600"> • {miss} câu chưa có đáp án</span>}
                  </div>
                </div>
                <Btn small variant="ghost" onClick={() => onEdit(x)}><PencilLine className="w-3.5 h-3.5" /> Xem & sửa</Btn>
              </div>
            );
          })}
          <div className="text-xs text-slate-500 font-bold pt-2">💡 Đề chưa có đáp án vẫn lưu được; mở "Sửa" rồi bấm "AI giải & điền đáp án" hoặc chạm chọn đáp án đúng.</div>
        </div>
      )}
    </Modal>
  );
}
