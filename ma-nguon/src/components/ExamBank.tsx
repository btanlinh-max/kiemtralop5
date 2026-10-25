import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, Search, PencilLine, Share2, FileDown, Copy, Trash2, Eye, Lock, Unlock, BarChart3 } from 'lucide-react';
import type { Exam, ExamKind } from '../types';
import { KIND_LABEL } from '../types';
import { useStore } from '../store';
import { Btn, Card, Empty, Pill, toast } from './ui';
import { COLOR_CHIP, SUBJECT_NAMES, subjectInfo } from '../curriculum';
import { fmtDate, uid } from '../grading';
import { examToWord } from '../exporters';
import { missingAnswer } from './ExamEditor';
import { publicExams } from '../api';
import { SEED_EXAMS } from '../seed';
import { friendly } from '../store';

export function ExamBank({ onEdit, onShare, onPreview, onResults, saveExam, removeExam }: {
  onEdit: (e: Exam) => void; onShare: (e: Exam) => void; onPreview: (e: Exam) => void; onResults: (e: Exam) => void;
  saveExam: (e: Exam) => Promise<void>; removeExam: (e: Exam) => Promise<void>;
}) {
  const { exams: myExams, teacher, classes, loading } = useStore();
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<'' | ExamKind>('');
  const [scope, setScope] = useState<'mine' | 'public'>('mine');
  const [pub, setPub] = useState<Exam[]>([]);
  const [pubLoading, setPubLoading] = useState(false);
  const [q, setQ] = useState('');
  const exams = scope === 'mine' ? myExams : pub.filter((e) => e.ownerUid !== teacher?.uid);
  const className = (code: string) => classes.find((c) => c.id === code)?.name || code;

  useEffect(() => {
    if (scope !== 'public') return;
    setPubLoading(true);
    publicExams().then((x) => setPub(x.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))).catch((e) => toast(friendly(e), 'err')).finally(() => setPubLoading(false));
  }, [scope]);

  const list = useMemo(() => exams.filter((e) =>
    (!subject || e.subject === subject) && (!kind || e.kind === kind) &&
    (!q || (e.title + ' ' + e.code + ' ' + e.author + ' ' + (e.ownerSchool || '')).toLowerCase().includes(q.toLowerCase()))), [exams, subject, kind, q]);

  const counts = useMemo(() => Object.fromEntries(SUBJECT_NAMES.map((s) => [s, exams.filter((e) => e.subject === s).length])), [exams]);
  const copyToMine = (e: Exam) => onEdit({ ...JSON.parse(JSON.stringify(e)), id: '', code: '', title: e.title + (scope === 'mine' ? ' (bản sao)' : ''), author: teacher?.name || '', authorEmail: teacher?.email || '', ownerUid: teacher?.uid, ownerSchool: teacher?.school, public: false, classes: [], copiedFrom: e.id, createdAt: new Date().toISOString() });

  return (
    <div className="space-y-3">
      <div className="rounded-3xl overflow-hidden border-4 border-orange-300 shadow">
        <div className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-4 sm:px-6 py-4 text-white flex flex-wrap items-center gap-3">
          <div className="text-3xl bg-white/25 rounded-2xl w-14 h-14 flex items-center justify-center">📚</div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xl sm:text-2xl font-black">{scope === 'mine' ? 'NGÂN HÀNG ĐỀ CỦA TÔI' : 'KHO ĐỀ CHUNG TOÀN QUỐC'}</div>
            <div className="text-xs sm:text-sm font-bold text-orange-50">{scope === 'mine' ? `${exams.length} đề • ${exams.filter((e) => e.public).length} đề đã chia sẻ lên kho chung` : `${exams.length} đề do ${new Set(exams.map((e) => e.ownerUid)).size} thầy cô trên cả nước chia sẻ – bấm "Lấy về" để dùng cho lớp mình`}</div>
          </div>
          <div className="flex bg-white/25 rounded-2xl p-1">
            <button onClick={() => setScope('mine')} className={`px-3 py-2 rounded-xl text-sm font-black ${scope === 'mine' ? 'bg-white text-orange-700 shadow' : 'text-white'}`}>📁 Đề của tôi</button>
            <button onClick={() => setScope('public')} className={`px-3 py-2 rounded-xl text-sm font-black flex items-center gap-1 ${scope === 'public' ? 'bg-white text-orange-700 shadow' : 'text-white'}`}><Globe2 className="w-4 h-4" /> Kho đề chung</button>
          </div>
        </div>
        <div className="bg-white px-3 sm:px-5 py-3 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setSubject('')} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${!subject ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-200'}`}>Tất cả môn</button>
            {SUBJECT_NAMES.map((s) => (
              <button key={s} onClick={() => setSubject(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${subject === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-200'}`}>
                {subjectInfo(s).icon} {s} {counts[s] ? <span className="opacity-70">({counts[s]})</span> : ''}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 rounded-xl p-1">
              {([['', 'Tất cả'], ['kiemtra', 'Kiểm tra'], ['khaosat', 'Khảo sát'], ['ontap', 'Ôn tập']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setKind(k as any)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${kind === k ? 'bg-white shadow text-orange-700' : 'text-slate-600'}`}>{l}</button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên đề, mã đề, người soạn…" className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-slate-200 text-sm" /></div>
          </div>
        </div>
      </div>

      {loading || pubLoading ? <div className="text-center py-10 font-bold text-slate-500">Đang tải…</div> : list.length === 0 ? (
        <Card><Empty icon="🗂️" title={scope === 'mine' ? 'Chưa có đề nào' : 'Kho chung chưa có đề phù hợp'}>{scope === 'mine' ? 'Bấm "Tạo đề mới", "Tải đề Word/PDF" hoặc "AI soạn đề" ở thanh màu cam phía trên – hoặc mở "Kho đề chung" để lấy đề của đồng nghiệp.' : 'Thầy cô hãy là người đầu tiên chia sẻ đề: mở "Đề của tôi" → bấm 🌐 trên đề.'}
          {scope === 'mine' && !myExams.length && <div className="mt-3"><Btn variant="orange" onClick={async () => { for (const e of SEED_EXAMS) await saveExam({ ...e, id: '', code: '', classes: [], public: false, author: teacher?.name || '', authorEmail: teacher?.email || '', ownerUid: teacher?.uid }); toast('Đã thêm 3 đề mẫu (Toán, Tiếng Việt) có đáp án.'); }}>📥 Thêm 3 đề mẫu lớp 5 có sẵn đáp án</Btn></div>}</Empty></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => {
            const si = subjectInfo(e.subject);
            const miss = e.questions.filter(missingAnswer).length;
            const canEdit = scope === 'mine';
            return (
              <Card key={e.id} className="p-4 flex flex-col">
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Pill className={COLOR_CHIP[si.color]}>{si.icon} {e.subject}</Pill>
                  <Pill className="bg-white border-slate-200 text-slate-600">{KIND_LABEL[e.kind]}</Pill>
                  <Pill className={e.open ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-500'}>{e.open ? '● Đang mở' : 'Đã đóng'}</Pill>
                  {e.public && scope === 'mine' && <Pill className="bg-sky-50 border-sky-200 text-sky-700"><Globe2 className="w-3 h-3" /> Đã chia sẻ</Pill>}
                </div>
                <div className="font-black text-slate-800 leading-snug">{e.title}</div>
                <div className="text-xs text-slate-500 font-bold mt-1 flex-1">
                  {e.questions.length} câu • {e.questions.reduce((s, q) => s + q.points, 0).toLocaleString('vi-VN')} điểm • {e.duration ? e.duration + ' phút' : 'không giới hạn'}
                  {scope === 'mine' && (e.classes?.length ? ` • Giao lớp ${e.classes.map(className).join(', ')}` : ' • Chưa giao lớp nào')}
                  <br />👩‍🏫 {e.author || 'Không rõ'}{scope === 'public' && e.ownerSchool ? ` – ${e.ownerSchool}` : ''} • {fmtDate(e.updatedAt)}
                  {miss > 0 && <span className="text-rose-600"><br />⚠️ {miss} câu chưa có đáp án</span>}
                </div>
                {scope === 'mine' ? (
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    <Btn small variant="orange" onClick={() => onShare(e)}><Share2 className="w-3.5 h-3.5" /> Giao bài</Btn>
                    <Btn small variant="blue" onClick={() => onResults(e)}><BarChart3 className="w-3.5 h-3.5" /> Kết quả</Btn>
                  </div>
                ) : (
                  <Btn small variant="orange" className="mt-3" onClick={() => copyToMine(e)}><Copy className="w-3.5 h-3.5" /> Lấy về đề của tôi</Btn>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <Btn small variant="ghost" onClick={() => onPreview(e)} title="Làm thử"><Eye className="w-3.5 h-3.5" /></Btn>
                  {canEdit && <Btn small variant="ghost" onClick={() => onEdit(e)}><PencilLine className="w-3.5 h-3.5" /> Sửa</Btn>}
                  {canEdit && <Btn small variant="ghost" onClick={() => saveExam({ ...e, open: !e.open }).then(() => toast(e.open ? 'Đã đóng đề.' : 'Đã mở đề cho học sinh.'))} title={e.open ? 'Đóng đề' : 'Mở đề'}>{e.open ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</Btn>}
                  <Btn small variant="ghost" onClick={() => examToWord(e)} title="Tải file Word để in"><FileDown className="w-3.5 h-3.5" /> Word</Btn>
                  {canEdit && <Btn small variant="ghost" title="Nhân bản" onClick={() => copyToMine(e)}><Copy className="w-3.5 h-3.5" /></Btn>}
                  {canEdit && <Btn small variant={e.public ? 'blue' : 'ghost'} title={e.public ? 'Đang chia sẻ lên kho chung – bấm để thôi chia sẻ' : 'Chia sẻ lên kho đề chung toàn quốc'} onClick={() => saveExam({ ...e, public: !e.public }).then(() => toast(e.public ? 'Đã thôi chia sẻ.' : 'Đã chia sẻ lên kho đề chung – thầy cô cả nước có thể lấy về dùng. Cảm ơn thầy cô! 💐'))}><Globe2 className="w-3.5 h-3.5" /></Btn>}
                  {canEdit && <Btn small variant="danger" onClick={() => window.confirm(`Xoá đề "${e.title}"? Kết quả bài làm vẫn được giữ.`) && removeExam(e)}><Trash2 className="w-3.5 h-3.5" /></Btn>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
