import React, { useEffect, useState } from 'react';
import { FileUp, Download, Trash2, ExternalLink, FileText } from 'lucide-react';
import type { Resource } from '../types';
import { useStore } from '../store';
import { deleteResource, isCloud, myResources, publicResources, saveResource } from '../api';
import type { Teacher } from '../types';
import { friendly } from '../store';
import { Btn, Card, Empty, Field, inputCls, Modal, Pill, toast } from './ui';
import { COLOR_CHIP, SUBJECT_NAMES, subjectInfo } from '../curriculum';
import { fmtDate, uid } from '../grading';
import { fileToBase64 } from '../docx';

const KINDS = ['Đề kiểm tra', 'Đề ôn tập', 'Đề khảo sát', 'Phiếu bài tập', 'Ma trận / Đặc tả', 'Tài liệu tham khảo', 'Bài giảng'];

const MAX_INLINE = 700 * 1024;
export async function saveResourceFile(file: File | null, subject: string, kind: string, t: Teacher | null, title?: string, note?: string, isPublic = true, url = '') {
  if (!file && !url) throw new Error('Chọn file hoặc dán đường link tài liệu.');
  if (file && file.size > MAX_INLINE && !url) throw new Error('File lớn hơn 700 KB: thầy cô tải file lên Google Drive, bật chia sẻ "Bất kỳ ai có đường liên kết", rồi dán link vào ô "Link tài liệu".');
  const r: Resource = { id: uid('f'), title: title || file?.name.replace(/\.[^.]+$/, '') || 'Tài liệu', subject, kind, fileName: file?.name || 'link', size: file?.size || 0, author: t?.name || '', ownerUid: t?.uid, public: isPublic, createdAt: new Date().toISOString(), note };
  if (url) r.url = url;
  else if (file) r.dataUrl = `data:${file.type || 'application/octet-stream'};base64,${await fileToBase64(file)}`;
  await saveResource(r);
  return r;
}

export function Resources() {
  const { teacher } = useStore();
  const [list, setList] = useState<Resource[]>([]);
  const [url, setUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [subject, setSubject] = useState('');
  const [up, setUp] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ title: '', subject: 'Toán', kind: 'Đề ôn tập', note: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([myResources(teacher?.uid || ''), publicResources()]);
      const m = new Map<string, Resource>();
      [...a, ...b].forEach((r) => m.set(r.id, r));
      setList([...m.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
    } catch (e: any) { toast(friendly(e), 'err'); }
  };
  useEffect(() => { load(); }, []);

  const shown = list.filter((r) => !subject || r.subject === subject);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl overflow-hidden border-4 border-sky-300 shadow">
        <div className="bg-gradient-to-r from-sky-600 to-cyan-500 px-4 sm:px-6 py-4 text-white flex flex-wrap items-center gap-3">
          <div className="text-3xl bg-white/25 rounded-2xl w-14 h-14 flex items-center justify-center">🗄️</div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xl sm:text-2xl font-black">KHO TÀI LIỆU DÙNG CHUNG</div>
            <div className="text-xs sm:text-sm font-bold text-sky-50">Thầy cô trên cả nước cùng đóng góp đề, phiếu bài tập, ma trận (Word, PDF…) – ai cũng tải về được.</div>
          </div>
          <Btn variant="white" onClick={() => setUp(true)}><FileUp className="w-4 h-4" /> Tải tài liệu lên</Btn>
        </div>
        <div className="bg-white px-3 py-2 flex gap-1.5 overflow-x-auto">
          <button onClick={() => setSubject('')} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${!subject ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200'}`}>Tất cả ({list.length})</button>
          {SUBJECT_NAMES.filter((s) => list.some((r) => r.subject === s)).map((s) => <button key={s} onClick={() => setSubject(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold border-2 ${subject === s ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200'}`}>{subjectInfo(s).icon} {s}</button>)}
        </div>
      </div>

      {shown.length === 0 ? <Card><Empty icon="📂" title="Chưa có tài liệu">Bấm "Tải tài liệu lên" để chia sẻ với đồng nghiệp trong khối.</Empty></Card> : (
        <div className="grid gap-2 md:grid-cols-2">
          {shown.map((r) => (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs text-white ${/\.pdf$/i.test(r.fileName) ? 'bg-rose-500' : /\.docx?$/i.test(r.fileName) ? 'bg-blue-600' : /\.xlsx?$/i.test(r.fileName) ? 'bg-emerald-600' : 'bg-slate-500'}`}>{(r.fileName.split('.').pop() || 'FILE').toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="font-black truncate">{r.title}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <Pill className={COLOR_CHIP[subjectInfo(r.subject).color]}>{subjectInfo(r.subject).icon} {r.subject}</Pill>
                  <Pill className="bg-white border-slate-200 text-slate-600">{r.kind}</Pill>
                </div>
                <div className="text-[11px] text-slate-500 font-bold mt-0.5">{r.author} • {fmtDate(r.createdAt)} • {(r.size / 1024).toFixed(0)} KB</div>
                {r.note && <div className="text-xs text-slate-600 mt-0.5">{r.note}</div>}
              </div>
              <div className="flex flex-col gap-1">
                {r.url ? <a href={r.url} target="_blank" rel="noreferrer"><Btn small variant="blue"><ExternalLink className="w-3.5 h-3.5" /> Mở</Btn></a>
                  : r.dataUrl ? <a href={r.dataUrl} download={r.fileName}><Btn small variant="blue"><Download className="w-3.5 h-3.5" /> Tải</Btn></a> : null}
                {r.ownerUid === teacher?.uid && <Btn small variant="danger" onClick={async () => { if (window.confirm('Xoá tài liệu này?')) { await deleteResource(r.id); load(); } }}><Trash2 className="w-3.5 h-3.5" /></Btn>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={up} onClose={() => setUp(false)} title="📤 Tải tài liệu lên kho chung"
        footer={<Btn loading={busy} disabled={!file && !url.trim()} onClick={async () => {
          setBusy(true);
          try { await saveResourceFile(file, meta.subject, meta.kind, teacher, meta.title, meta.note, isPublic, url.trim()); toast('Đã lưu tài liệu!'); setUp(false); setFile(null); setUrl(''); load(); }
          catch (e: any) { toast(friendly(e), 'err'); } finally { setBusy(false); }
        }}><FileUp className="w-4 h-4" /> Tải lên</Btn>}>
        <div className="space-y-3">
          <label className="block rounded-2xl border-4 border-dashed border-sky-300 bg-sky-50 p-5 text-center cursor-pointer">
            <FileText className="w-8 h-8 mx-auto text-sky-600" />
            <div className="font-bold mt-1">{file ? file.name : 'Chọn file (Word, PDF, Excel, PowerPoint, ảnh…)'}</div>
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setMeta((m) => ({ ...m, title: m.title || f.name.replace(/\.[^.]+$/, '') })); } }} />
          </label>
          <Field label="Hoặc link tài liệu (Google Drive, OneDrive… – dùng cho file lớn hơn 700 KB)"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" /></Field>
          <Field label="Tên tài liệu"><input className={inputCls} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Môn"><select className={inputCls} value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })}>{SUBJECT_NAMES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Loại"><select className={inputCls} value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value })}>{KINDS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-sky-600" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Chia sẻ cho thầy cô cả nước (kho tài liệu chung)</label>
          <Field label="Ghi chú (không bắt buộc)"><input className={inputCls} value={meta.note} onChange={(e) => setMeta({ ...meta, note: e.target.value })} placeholder="VD: Có đáp án ở trang cuối" /></Field>
          <div className="text-xs text-slate-500">💡 Muốn học sinh làm trực tuyến? Dùng nút "Tải đề Word/PDF" trên thanh cam để chuyển file thành đề tương tác.</div>
        </div>
      </Modal>
    </div>
  );
}
