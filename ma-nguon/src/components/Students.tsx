import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Upload, Save, Download, Sparkles, RefreshCw, Trash2, Plus, QrCode, Copy, PencilLine, Printer } from 'lucide-react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import type { ClassRoom, Review, Submission } from '../types';
import { useStore, friendly } from '../store';
import { classReviews, classSubs, deleteClass, deleteReview, freshCode, saveClass } from '../api';
import { Bar, Btn, Card, Empty, Field, inputCls, Modal, Pill, toast } from './ui';
import { cleanName, fmtDate, GAP_THRESHOLD, makeCode, pct, rank, topicStats } from '../grading';
import { examMap } from '../reviewGen';
import { subjectInfo } from '../curriculum';
import { ask, hasKey } from '../ai';
import { CONFIG } from '../config';
import { safeName } from '../exporters';

export function classLink(code: string) {
  return location.href.split('#')[0].split('?')[0] + '#/lop/' + code;
}

export function ClassShare({ c, onClose }: { c: ClassRoom; onClose: () => void }) {
  const [qr, setQr] = useState('');
  const link = classLink(c.id);
  useEffect(() => { QRCode.toDataURL(link, { width: 640, margin: 1 }).then(setQr); }, [link]);
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Đã sao chép!'); } catch { toast('Không sao chép được.', 'err'); } };
  const msg = `🎒 Lớp ${c.name} – ${c.school}\nCác con vào web làm bài, ôn tập theo link: ${link}\n(hoặc vào web → Học sinh → nhập mã lớp ${c.id}), rồi chọn đúng tên mình.`;
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><meta charset="utf-8"><title>Mã lớp ${c.id}</title><style>body{font-family:Arial;text-align:center;padding:30px}.c{border:4px dashed #f59e0b;border-radius:24px;padding:24px;max-width:520px;margin:auto}.code{font-size:60px;letter-spacing:10px;font-weight:900;color:#ea580c}</style></head><body><div class="c"><h2>LỚP ${c.name}</h2><div>${c.school}</div><img src="${qr}" width="320"><div>Quét mã QR hoặc vào web, chọn "Học sinh" và nhập mã lớp:</div><div class="code">${c.id}</div><div style="font-size:12px;color:#666">${c.ownerName}</div></div><script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  };
  return (
    <Modal open onClose={onClose} title={`📲 Mã vào lớp ${c.name}`}>
      <div className="text-center">
        {qr && <img src={qr} alt="QR" className="mx-auto w-60 h-60 rounded-2xl border-4 border-amber-200" />}
        <div className="text-sm font-bold text-slate-500 mt-2">Mã lớp</div>
        <div className="text-5xl font-black tracking-[0.25em] text-orange-500">{c.id}</div>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 border p-2 text-xs break-all font-mono">{link}</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Btn variant="ghost" onClick={() => copy(link)}><Copy className="w-4 h-4" /> Chép link</Btn>
        <Btn variant="ghost" onClick={print}><Printer className="w-4 h-4" /> In mã QR</Btn>
        <Btn className="col-span-2" onClick={() => copy(msg)}><Copy className="w-4 h-4" /> Chép tin nhắn gửi nhóm Zalo phụ huynh</Btn>
      </div>
      <div className="text-xs text-slate-500 mt-3">Học sinh chỉ cần vào lớp 1 lần trên mỗi máy. Đề nào thầy cô giao cho lớp sẽ tự hiện ra.</div>
    </Modal>
  );
}

export function Students() {
  const { classes, setClasses, teacher, exams } = useStore();
  const [code, setCode] = useState(classes[0]?.id || '');
  const [subs, setSubs] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editRoster, setEditRoster] = useState(false);
  const [rosterText, setRosterText] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ name: '', school: teacher?.school || '' });
  const [sharing, setSharing] = useState<ClassRoom | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cls = classes.find((c) => c.id === code) || null;
  const byId = useMemo(() => examMap(exams), [exams]);

  useEffect(() => { if (!cls && classes.length) setCode(classes[0].id); }, [classes, cls]);

  const load = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([classSubs(code), classReviews(code)]);
      setSubs(s);
      setReviews(r);
    } catch (e: any) { toast(friendly(e), 'err'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [code]);

  const names = useMemo(() => {
    const set = new Map<string, string>();
    (cls?.students || []).forEach((n) => set.set(n.toLowerCase(), n));
    subs.forEach((s) => !set.has(s.studentName.toLowerCase()) && set.set(s.studentName.toLowerCase(), s.studentName));
    return [...set.values()];
  }, [cls, subs]);

  const createClass = async () => {
    if (!teacher || !form.name.trim()) return toast('Nhập tên lớp, ví dụ 5A3.', 'err');
    try {
      const id = await freshCode('classes', makeCode);
      const c: ClassRoom = { id, name: form.name.trim().toUpperCase(), ownerUid: teacher.uid, ownerName: teacher.name, school: form.school.trim() || teacher.school, province: teacher.province, students: [], createdAt: new Date().toISOString() };
      await saveClass(c);
      setClasses((x) => [...x, c].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })));
      setCode(id);
      setNewOpen(false);
      setForm({ name: '', school: teacher.school });
      toast(`Đã tạo lớp ${c.name} – mã lớp ${id}. Thêm danh sách học sinh nhé!`);
      setRosterText('');
      setEditRoster(true);
    } catch (e: any) { toast(friendly(e), 'err'); }
  };

  const saveRoster = async () => {
    if (!cls) return;
    const list = rosterText.split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)\t ]+/, '').split('\t')[0].trim()).filter((l) => l.length > 1 && !/^(họ|stt|tên)/i.test(l)).map(cleanName);
    const c = { ...cls, students: [...new Set(list)] };
    try {
      await saveClass(c);
      setClasses((x) => x.map((y) => (y.id === c.id ? c : y)));
      setEditRoster(false);
      toast(`Đã lưu danh sách lớp ${c.name}: ${c.students.length} học sinh.`);
    } catch (e: any) { toast(friendly(e), 'err'); }
  };

  const importExcel = async (f: File) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await f.arrayBuffer());
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    let col = -1, colHo = -1, colTen = -1, start = 0;
    rows.slice(0, 10).forEach((r, i) => r.forEach((c, j) => {
      const t = String(c ?? '').trim().toLowerCase();
      if (/họ\s*(và)?\s*tên/.test(t) && col < 0) { col = j; start = i + 1; }
      else if (/^họ( và tên)? ?đệm$|^họ$/.test(t)) { colHo = j; start = i + 1; }
      else if (/^tên$/.test(t)) colTen = j;
    }));
    const out: string[] = [];
    for (const r of rows.slice(start)) {
      let n = '';
      if (col >= 0) n = String(r[col] ?? '');
      else if (colHo >= 0 && colTen >= 0) n = `${r[colHo] ?? ''} ${r[colTen] ?? ''}`;
      else n = String(r.find((c) => typeof c === 'string' && /\S+\s+\S+/.test(c)) ?? '');
      n = n.trim().replace(/\s+/g, ' ');
      if (n.length > 3 && /\s/.test(n)) out.push(cleanName(n));
    }
    setRosterText(out.join('\n'));
    toast(`Đọc được ${out.length} tên. Kiểm tra lại rồi bấm Lưu.`, 'info');
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-black text-emerald-800 flex items-center gap-1.5"><Users className="w-5 h-5" /> Lớp của tôi:</div>
          {classes.map((c) => <button key={c.id} onClick={() => setCode(c.id)} className={`px-3 py-1.5 rounded-xl font-black border-2 text-sm ${code === c.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'}`}>{c.name}</button>)}
          <Btn small variant="orange" onClick={() => setNewOpen(true)}><Plus className="w-3.5 h-3.5" /> Tạo lớp mới</Btn>
          {cls && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Btn small variant="ghost" onClick={load} loading={loading}><RefreshCw className="w-3.5 h-3.5" /></Btn>
              <Btn small variant="blue" onClick={() => setSharing(cls)}><QrCode className="w-3.5 h-3.5" /> Mã lớp: {cls.id}</Btn>
              <Btn small onClick={() => { setRosterText(cls.students.join('\n')); setEditRoster(true); }}><Upload className="w-3.5 h-3.5" /> Danh sách học sinh ({cls.students.length})</Btn>
              <Btn small variant="danger" onClick={async () => {
                if (!window.confirm(`Xoá lớp ${cls.name}? Học sinh sẽ không vào lớp bằng mã ${cls.id} được nữa.`)) return;
                try { await deleteClass(cls.id); setClasses((x) => x.filter((y) => y.id !== cls.id)); setCode(''); toast('Đã xoá lớp.'); } catch (e: any) { toast(friendly(e), 'err'); }
              }}><Trash2 className="w-3.5 h-3.5" /></Btn>
            </div>
          )}
        </div>
        {cls && <div className="text-xs text-slate-500 mt-2">🏫 {cls.school}{cls.province ? ' – ' + cls.province : ''} • Học sinh vào lớp bằng mã <b className="text-orange-600">{cls.id}</b> hoặc quét QR, rồi chọn đúng tên mình.</div>}
      </Card>

      {!classes.length ? (
        <Card><Empty icon="🏫" title="Thầy cô chưa có lớp nào">Bấm "Tạo lớp mới" (ví dụ 5A3), thêm danh sách học sinh, rồi gửi mã lớp cho học sinh.</Empty></Card>
      ) : names.length === 0 ? (
        <Card><Empty icon="👧" title={`Lớp ${cls?.name || ''} chưa có học sinh`}>Bấm "Danh sách học sinh" để dán hoặc nhập từ Excel – học sinh sẽ chọn tên mình khi vào lớp (không gõ sai tên).</Empty></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {names.map((n) => {
            const ss = subs.filter((s) => s.studentName.toLowerCase() === n.toLowerCase());
            const avg = ss.length ? Math.round((ss.reduce((a, s) => a + s.score, 0) / ss.length) * 10) / 10 : null;
            const g = topicStats(ss, byId).filter((t) => pct(t) < GAP_THRESHOLD);
            const rv = reviews.filter((r) => r.studentName.toLowerCase() === n.toLowerCase());
            return (
              <button key={n} onClick={() => setStudent(n)} className="text-left">
                <Card className="p-3 hover:border-orange-300 transition">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-amber-400 text-white font-black flex items-center justify-center">{n.split(' ').slice(-1)[0][0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black truncate"><span className="text-slate-500 font-semibold text-sm">{n.split(' ').slice(0, -1).join(' ')} </span>{n.split(' ').slice(-1)[0]}</div>
                      <div className="text-[11px] font-bold text-slate-500">{ss.length} bài • {g.length ? <span className="text-rose-600">{g.length} phần hổng</span> : 'chưa có phần hổng'} • {rv.filter((r) => r.mastered).length}/{rv.length} bài ôn đã vững</div>
                    </div>
                    <div className="text-xl font-black text-orange-500">{avg === null ? '–' : avg.toLocaleString('vi-VN')}</div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="🏫 Tạo lớp mới" footer={<Btn onClick={createClass}><Plus className="w-4 h-4" /> Tạo lớp</Btn>}>
        <div className="space-y-3">
          <Field label="Tên lớp"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: 5A3" autoFocus /></Field>
          <Field label="Trường"><input className={inputCls} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="VD: Trường Tiểu học Vương Thừa Vũ" /></Field>
          <div className="text-xs text-slate-500">Hệ thống tự cấp <b>mã lớp</b> 6 ký tự. Học sinh dùng mã này để vào lớp.</div>
        </div>
      </Modal>

      <Modal open={editRoster} onClose={() => setEditRoster(false)} wide title={`📋 Danh sách học sinh lớp ${cls?.name || ''}`}
        footer={<Btn onClick={saveRoster}><Save className="w-4 h-4" /> Lưu danh sách</Btn>}>
        <label className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 font-bold text-sm cursor-pointer">
          <Upload className="w-4 h-4" /> Nhập từ file Excel (cột "Họ và tên")
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importExcel(e.target.files[0])} />
        </label>
        <Field label="Hoặc dán danh sách – mỗi dòng 1 học sinh" hint={`${rosterText.split('\n').filter((x) => x.trim()).length} học sinh`}>
          <textarea className={inputCls + ' mt-2'} rows={14} value={rosterText} onChange={(e) => setRosterText(e.target.value)} placeholder={'Nguyễn Minh An\nTrần Bảo Anh\n…'} />
        </Field>
      </Modal>

      {sharing && <ClassShare c={sharing} onClose={() => setSharing(null)} />}
      {student && cls && <StudentProfile name={student} cls={cls} subs={subs.filter((s) => s.studentName.toLowerCase() === student.toLowerCase())} reviews={reviews.filter((r) => r.studentName.toLowerCase() === student.toLowerCase())} onClose={() => setStudent(null)} onChanged={load} />}
    </div>
  );
}

function StudentProfile({ name, cls, subs, reviews, onClose, onChanged }: { name: string; cls: ClassRoom; subs: Submission[]; reviews: Review[]; onClose: () => void; onChanged: () => void }) {
  const { exams, teacher } = useStore();
  const className = cls.name;
  const byId = useMemo(() => examMap(exams), [exams]);
  const stats = topicStats(subs, byId);
  const sorted = [...subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const strong = stats.filter((t) => pct(t) >= 80).slice(-4).reverse();
  const weak = stats.filter((t) => pct(t) < GAP_THRESHOLD).slice(0, 4);

  const aiComment = async () => {
    setBusy(true);
    try {
      const t = await ask(`Viết nhận xét gửi phụ huynh (4–6 câu, giọng cô giáo chủ nhiệm ân cần, xưng "cô", gọi "con", không nêu tên đầy đủ) cho một học sinh lớp 5 dựa trên số liệu:
- Các bài đã làm: ${sorted.map((s) => `${s.subject} – ${s.examTitle}: ${s.score}/10`).join('; ') || 'chưa có'}
- Phần làm tốt: ${strong.map((x) => `${x.topic} (${pct(x)}%)`).join('; ') || 'chưa rõ'}
- Phần cần cố gắng: ${weak.map((x) => `${x.topic} (${pct(x)}%)`).join('; ') || 'không có'}
- Bài ôn tập riêng: ${reviews.length} bài, đã vững ${reviews.filter((r) => r.mastered).length}.
Nội dung: khen điểm mạnh cụ thể → nêu phần cần cố gắng → gợi ý 1–2 việc bố mẹ có thể cùng con làm ở nhà (cụ thể, 10–15 phút/ngày). Chỉ trả về đoạn nhận xét.`);
      setComment(t.trim());
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const savePng = async () => {
    if (!card.current) return;
    try {
      const url = await toPng(card.current, { pixelRatio: 2, backgroundColor: '#fffbeb' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu-ket-qua-${safeName(name)}.png`;
      a.click();
    } catch (e: any) { toast('Không tạo được ảnh: ' + e.message, 'err'); }
  };

  return (
    <Modal open onClose={onClose} full title={`🧒 Hồ sơ học tập – ${name} (${className})`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="font-black text-slate-700 mb-2">📈 Điểm các bài đã làm</div>
            {sorted.length === 0 ? <div className="text-sm text-slate-500">Chưa làm bài nào.</div> : (
              <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
                {sorted.map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-1 min-w-[38px]" title={`${s.examTitle} – ${fmtDate(s.submittedAt)}`}>
                    <span className="text-[11px] font-black">{s.score.toLocaleString('vi-VN')}</span>
                    <div className={`w-7 rounded-t-lg ${s.score >= 9 ? 'bg-emerald-500' : s.score >= 5 ? 'bg-sky-400' : 'bg-rose-400'}`} style={{ height: Math.max(6, s.score * 9) + 'px' }} />
                    <span className="text-sm">{subjectInfo(s.subject).icon}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <div className="font-black text-slate-700 mb-2">🎯 Mức nắm kiến thức theo chủ đề</div>
            <div className="space-y-2">
              {stats.map((t) => (
                <div key={t.subject + t.topic}>
                  <div className="flex justify-between text-xs font-bold gap-2"><span>{subjectInfo(t.subject).icon} {t.topic}</span><span>{pct(t)}%</span></div>
                  <Bar value={pct(t)} className="mt-0.5" />
                </div>
              ))}
              {!stats.length && <div className="text-sm text-slate-500">Chưa có dữ liệu.</div>}
            </div>
          </Card>
          <Card className="p-4">
            <div className="font-black text-violet-800 mb-2">📚 Bài ôn riêng đã giao ({reviews.length})</div>
            {reviews.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                <span className="flex-1"><b>{r.topic}</b> <span className="text-xs text-slate-500">• {r.source === 'ai' ? 'AI soạn' : 'từ kho'} • {fmtDate(r.createdAt)}</span></span>
                {r.mastered ? <Pill className="bg-emerald-100 border-emerald-200 text-emerald-800">Đã vững ({r.best}%)</Pill> : r.attempts ? <Pill className="bg-amber-100 border-amber-200 text-amber-800">Đang luyện ({r.best}%)</Pill> : <Pill className="bg-slate-100 border-slate-200">Chưa làm</Pill>}
                {<button className="text-rose-500 p-1" onClick={async () => { if (window.confirm('Xoá bài ôn này?')) { await deleteReview(r); onChanged(); } }}><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
            {!reviews.length && <div className="text-sm text-slate-500">Chưa có. Mở một bài làm trong tab Kết quả để giao bài ôn.</div>}
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Btn variant="violet" disabled={!hasKey()} loading={busy} onClick={aiComment}><Sparkles className="w-4 h-4" /> AI viết nhận xét gửi phụ huynh</Btn>
            <Btn onClick={savePng}><Download className="w-4 h-4" /> Tải phiếu (ảnh gửi Zalo)</Btn>
          </div>
          <textarea className={inputCls} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét của cô giáo (gõ hoặc để AI viết)…" />
          <div ref={card} className="rounded-3xl border-4 border-amber-300 bg-amber-50 p-5" style={{ width: '100%', maxWidth: 560 }}>
            <div className="rounded-2xl p-3 text-white text-center" style={{ background: 'linear-gradient(135deg,#059669,#0d9488 45%,#d97706)' }}>
              <div className="text-[11px] font-bold opacity-90">{(cls.school || CONFIG.school).toUpperCase()}</div>
              <div className="text-lg font-black">PHIẾU KẾT QUẢ HỌC TẬP</div>
              <div className="text-sm font-bold">{name} – Lớp {className}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 my-3 text-center">
              <div className="bg-white rounded-xl p-2"><div className="text-2xl font-black text-orange-500">{subs.length}</div><div className="text-[10px] font-bold text-slate-500">Bài đã làm</div></div>
              <div className="bg-white rounded-xl p-2"><div className="text-2xl font-black text-emerald-600">{subs.length ? (Math.round((subs.reduce((a, s) => a + s.score, 0) / subs.length) * 10) / 10).toLocaleString('vi-VN') : '–'}</div><div className="text-[10px] font-bold text-slate-500">Điểm trung bình</div></div>
              <div className="bg-white rounded-xl p-2"><div className="text-2xl font-black text-violet-600">{reviews.filter((r) => r.mastered).length}/{reviews.length}</div><div className="text-[10px] font-bold text-slate-500">Bài ôn đã vững</div></div>
            </div>
            <div className="bg-white rounded-xl p-3 text-[13px] space-y-1">
              {sorted.slice(-5).map((s) => <div key={s.id} className="flex justify-between gap-2"><span>{subjectInfo(s.subject).icon} {s.examTitle}</span><b>{s.score.toLocaleString('vi-VN')} – {rank(s.score).label}</b></div>)}
            </div>
            {strong.length > 0 && <div className="mt-2 text-[13px]"><b className="text-emerald-700">🌟 Con làm tốt:</b> {strong.map((t) => t.topic).join('; ')}</div>}
            {weak.length > 0 && <div className="mt-1 text-[13px]"><b className="text-rose-700">🔸 Con cần cố gắng:</b> {weak.map((t) => t.topic).join('; ')}</div>}
            {comment && <div className="mt-2 bg-white rounded-xl p-3 text-[13px] leading-relaxed whitespace-pre-line"><b>💬 Lời nhắn của cô:</b><br />{comment}</div>}
            <div className="text-right text-[11px] font-bold text-slate-500 mt-2">{teacher?.name || cls.ownerName} • {new Date().toLocaleDateString('vi-VN')}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
