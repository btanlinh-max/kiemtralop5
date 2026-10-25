import React, { useState } from 'react';
import { KeyRound, Link2, CheckCircle2, Sparkles, Download, Upload, ExternalLink } from 'lucide-react';
import { ask, getKey, setKey } from '../ai';
import { CONFIG } from '../config';
import { classReviews, classSubs, saveClass, saveExam, saveReview, saveSub, saveTeacher } from '../api';
import { Btn, Card, Field, inputCls, toast } from './ui';
import { useStore, friendly } from '../store';
import { PROVINCES } from '../provinces';

export function Settings() {
  const { refresh, teacher, exams, classes } = useStore();
  const [key, setK] = useState(getKey());
  const [busy, setBusy] = useState('');

  const testKey = async () => {
    setKey(key);
    setBusy('ai');
    try {
      const r = await ask('Trả lời đúng 1 câu: "Xin chào, tôi là trợ lý AI của lớp 5!"');
      toast('✅ Mã AI hoạt động: ' + r.slice(0, 80));
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); }
  };

  const backup = async () => {
    if (!teacher) return;
    setBusy('bk');
    try {
      const out: any = { app: 'kt5', v: 2, at: new Date().toISOString(), exams, classes, subs: [], reviews: [] };
      for (const c of classes) { out.subs.push(...(await classSubs(c.id))); out.reviews.push(...(await classReviews(c.id))); }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
      a.download = `sao-luu-de-lop5-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e: any) { toast(friendly(e), 'err'); } finally { setBusy(''); }
  };
  const restore = async (f: File) => {
    if (!teacher) return;
    setBusy('rs');
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== 'kt5' || d.v !== 2) throw new Error('File không đúng định dạng sao lưu.');
      let n = 0;
      for (const c of d.classes || []) { await saveClass({ ...c, ownerUid: teacher.uid }); n++; }
      for (const e of d.exams || []) { await saveExam({ ...e, ownerUid: teacher.uid }); n++; }
      for (const s of d.subs || []) { await saveSub(s); n++; }
      for (const r of d.reviews || []) { await saveReview(r); n++; }
      toast(`Đã khôi phục ${n} mục.`);
      refresh();
    } catch (e: any) { toast(friendly(e), 'err'); } finally { setBusy(''); }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <div className="font-black text-violet-800 text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> Mã AI Gemini của riêng thầy cô</div>
        <div className="text-sm text-slate-600 mt-1">Mỗi người dùng mã của mình – lưu trên máy này, không gửi cho ai, không tốn lượt của người khác. Gói miễn phí của Google đủ dùng hằng ngày.</div>
        <ol className="text-sm mt-3 space-y-1.5 list-decimal pl-5">
          <li>Mở <a className="text-blue-600 font-bold underline inline-flex items-center gap-0.5" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey <ExternalLink className="w-3 h-3" /></a> (đăng nhập Gmail).</li>
          <li>Bấm <b>Create API key</b> (Tạo khoá API) → chọn dự án bất kỳ.</li>
          <li>Bấm biểu tượng sao chép mã (bắt đầu bằng <code>AIza…</code> hoặc <code>AQ.…</code>).</li>
          <li>Dán vào ô dưới → bấm <b>Lưu & thử</b>.</li>
        </ol>
        <div className="flex gap-2 mt-3">
          <input className={inputCls} type="password" value={key} onChange={(e) => setK(e.target.value)} placeholder="Dán mã AI vào đây" />
          <Btn variant="violet" onClick={testKey} loading={busy === 'ai'} disabled={!key.trim()}><KeyRound className="w-4 h-4" /> Lưu & thử</Btn>
        </div>
        {getKey() && <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Máy này đã có mã AI.</div>}
        {getKey() && <button className="text-xs text-rose-600 underline mt-1" onClick={() => { setKey(''); setK(''); toast('Đã xoá mã AI khỏi máy này.'); }}>Xoá mã khỏi máy này</button>}
      </Card>

      <AccountCard />

      <Card className="p-4 sm:p-5">
        <div className="font-black text-slate-800 text-lg">💾 Sao lưu / khôi phục</div>
        <div className="text-sm text-slate-600 mt-1">Tải toàn bộ đề, lớp, kết quả của thầy cô về 1 file để cất giữ hoặc chuyển sang tài khoản khác.</div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Btn variant="ghost" onClick={backup} loading={busy === 'bk'}><Download className="w-4 h-4" /> Tải file sao lưu</Btn>
          <input type="file" accept=".json" className="hidden" id="restore" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          <Btn variant="ghost" onClick={() => document.getElementById('restore')?.click()} loading={busy === 'rs'}><Upload className="w-4 h-4" /> Khôi phục từ file</Btn>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="font-black text-slate-800 text-lg">🏫 Thông tin sản phẩm</div>
        <div className="text-sm mt-2 space-y-1">
          <div><b>Tác giả:</b> {CONFIG.owner} ({CONFIG.ownerEmail})</div>
          <div><b>Chức vụ:</b> {CONFIG.ownerRole}</div>
          <div><b>Đơn vị:</b> {CONFIG.school}, {CONFIG.address}</div>
          <div><b>Cài như ứng dụng:</b> trên điện thoại/iPad bấm "Chia sẻ" → "Thêm vào màn hình chính"; trên máy tính bấm biểu tượng cài đặt ở thanh địa chỉ.</div>
        </div>
      </Card>
    </div>
  );
}

export function AccountCard({ onDone }: { onDone?: () => void }) {
  const { teacher } = useStore();
  const [f, setF] = useState({ name: teacher?.name || '', school: teacher?.school || '', province: teacher?.province || '' });
  const [busy, setBusy] = useState(false);
  if (!teacher) return null;
  const save = async () => {
    if (!f.name.trim() || !f.school.trim() || !f.province) return toast('Điền đủ họ tên, trường, tỉnh/thành.', 'err');
    setBusy(true);
    try { await saveTeacher({ ...teacher, name: f.name.trim(), school: f.school.trim(), province: f.province }); toast('Đã lưu thông tin.'); onDone?.(); }
    catch (e: any) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="font-black text-emerald-800 text-lg">👩‍🏫 Thông tin giáo viên</div>
      <div className="text-sm text-slate-600 mt-1">Hiện trên phiếu kết quả, đề in và kho đề chung.{teacher.email ? ` Tài khoản: ${teacher.email}` : ''}</div>
      <div className="grid gap-2 mt-3">
        <Field label="Họ và tên (cách xưng hô)"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="VD: Cô giáo Phạm Hồng Hạnh" /></Field>
        <Field label="Trường"><input className={inputCls} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} placeholder="VD: Trường Tiểu học Vương Thừa Vũ" /></Field>
        <Field label="Tỉnh / thành phố">
          <select className={inputCls} value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}>
            <option value="">— Chọn —</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Btn className="mt-3" onClick={save} loading={busy}>Lưu thông tin</Btn>
    </Card>
  );
}
