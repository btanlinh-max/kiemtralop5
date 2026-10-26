import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Printer, Check } from 'lucide-react';
import type { Exam } from '../types';
import { Btn, Modal, toast, copyText } from './ui';
import { useStore } from '../store';
import { subjectInfo } from '../curriculum';

export function examLink(classCode: string, e: Exam) {
  return location.href.split('#')[0].split('?')[0] + `#/lop/${classCode}/de/${e.id}`;
}

export function ShareModal({ exam, onClose, saveExam }: { exam: Exam; onClose: () => void; saveExam: (e: Exam) => Promise<void> }) {
  const { classes } = useStore();
  const [e, setE] = useState(exam);
  const [cls, setCls] = useState(exam.classes?.find((c) => classes.some((k) => k.id === c)) || '');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const c = classes.find((k) => k.id === cls);
  const link = c ? examLink(c.id, e) : '';
  useEffect(() => { if (link) QRCode.toDataURL(link, { width: 640, margin: 1, errorCorrectionLevel: 'M' }).then(setQr); }, [link]);

  const toggle = async (code: string) => {
    const on = (e.classes || []).includes(code);
    const n = { ...e, classes: on ? (e.classes || []).filter((x) => x !== code) : [...(e.classes || []), code], open: on ? e.open : true };
    setBusy(true);
    try {
      await saveExam(n);
      setE(n);
      if (!on) setCls(code);
      toast(on ? 'Đã bỏ giao đề cho lớp.' : 'Đã giao đề – học sinh lớp sẽ thấy trong "Bài cần làm".');
    } catch {} finally { setBusy(false); }
  };
  const copy = (t: string) => copyText(t);
  const msg = c ? `📝 ${e.title} (${e.subject})\nCác con lớp ${c.name} vào làm bài theo link: ${link}\n(hoặc vào web → Học sinh → mã lớp ${c.id}, chọn tên, bài ở mục "Bài cần làm")` : '';

  const print = () => {
    const w = window.open('', '_blank');
    if (!w || !c) return;
    w.document.write(`<html><head><meta charset="utf-8"><title>${e.title}</title><style>body{font-family:Arial;text-align:center;padding:30px} .c{border:4px dashed #f59e0b;border-radius:24px;padding:24px;max-width:520px;margin:auto} .code{font-size:52px;letter-spacing:10px;font-weight:900;color:#ea580c}</style></head><body><div class="c"><div>${subjectInfo(e.subject).icon} ${e.subject} – Lớp ${c.name}</div><h1>${e.title}</h1><img src="${qr}" width="320"><div>Quét mã QR để làm bài – hoặc nhập mã lớp:</div><div class="code">${c.id}</div><div style="font-size:12px;color:#666">${c.school} – ${c.ownerName}</div></div><script>setTimeout(()=>print(),400)</script></body></html>`);
    w.document.close();
  };

  return (
    <Modal open onClose={onClose} title="📲 Giao bài cho học sinh">
      <div className="font-black text-lg text-center">{e.title}</div>
      <div className="mt-3">
        <div className="text-xs font-black text-slate-600 mb-1">1. CHỌN LỚP ĐƯỢC LÀM ĐỀ NÀY</div>
        {!classes.length ? <div className="text-sm text-rose-600 font-bold">Thầy cô chưa có lớp – vào tab "Lớp học & Ôn tập" → "Tạo lớp mới".</div> : (
          <div className="flex flex-wrap gap-2">
            {classes.map((k) => {
              const on = (e.classes || []).includes(k.id);
              return <button key={k.id} disabled={busy} onClick={() => toggle(k.id)} className={`px-3 py-2 rounded-xl font-black border-2 inline-flex items-center gap-1 ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'}`}>{on && <Check className="w-4 h-4" />}{k.name}</button>;
            })}
          </div>
        )}
        {!e.open && <div className="text-rose-600 font-bold text-sm mt-2">⚠️ Đề đang ĐÓNG – bật "Mở" (biểu tượng ổ khoá) ở kho đề để học sinh làm được.</div>}
      </div>
      {(e.classes || []).length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-600 mb-1">2. GỬI CHO HỌC SINH {classes.filter((k) => e.classes?.includes(k.id)).length > 1 && '– LỚP:'}</div>
          {classes.filter((k) => e.classes?.includes(k.id)).length > 1 && (
            <div className="flex gap-1.5 mb-2">{classes.filter((k) => e.classes?.includes(k.id)).map((k) => <button key={k.id} onClick={() => setCls(k.id)} className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${cls === k.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'}`}>{k.name}</button>)}</div>
          )}
          {c && (
            <>
              <div className="text-center">
                {qr && <img src={qr} alt="Mã QR" className="mx-auto w-56 h-56 rounded-2xl border-4 border-amber-200" />}
                <div className="text-sm font-bold text-slate-500 mt-1">Mã lớp {c.name}</div>
                <div className="text-4xl font-black tracking-[0.25em] text-orange-500">{c.id}</div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 border p-2 text-xs break-all font-mono">{link}</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Btn variant="ghost" onClick={() => copy(link)}><Copy className="w-4 h-4" /> Chép link</Btn>
                <Btn variant="ghost" onClick={print}><Printer className="w-4 h-4" /> In mã QR</Btn>
                <Btn className="col-span-2" onClick={() => copy(msg)}><Copy className="w-4 h-4" /> Chép tin nhắn gửi nhóm Zalo phụ huynh</Btn>
              </div>
            </>
          )}
        </div>
      )}
      <div className="text-xs text-slate-500 mt-3">Học sinh làm được trên điện thoại, iPad, máy tính – không cần tài khoản. Có thể chiếu mã QR lên màn hình lớp để cả lớp quét.</div>
    </Modal>
  );
}
