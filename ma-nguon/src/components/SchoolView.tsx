import React, { useEffect, useState } from 'react';
import { Building2, Copy, FileSpreadsheet, LogIn, Plus, RefreshCw } from 'lucide-react';
import type { ClassRoom, Exam, School, Submission, Activity } from '../types';
import { useStore, friendly } from '../store';
import { classActs, classSubs, getClass, getExam, getSchool, saveClass, saveSchool, saveTeacher } from '../api';
import { Bar, Btn, Card, Empty, Field, inputCls, toast, copyText } from './ui';
import { makeCode, pct, topicStats, GAP_THRESHOLD } from '../grading';
import { safeName } from '../exporters';

interface ClassStat { cls: ClassRoom; students: number; subs: number; acts: number; avg: number; tot: number; ht: number; cht: number; active: number; gaps: { topic: string; p: number }[] }

export function SchoolView() {
  const { teacher, classes, setClasses } = useStore();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [stats, setStats] = useState<ClassStat[]>([]);
  const [khoiGaps, setKhoiGaps] = useState<{ topic: string; subject: string; p: number; n: number }[]>([]);

  useEffect(() => {
    if (!teacher?.schoolCode) return;
    getSchool(teacher.schoolCode).then(setSchool).catch((e) => toast(friendly(e), 'err'));
  }, [teacher?.schoolCode]);

  const loadStats = async (s: School) => {
    setLoading(true);
    try {
      const out: ClassStat[] = [];
      const examCache: Record<string, Exam> = {};
      const allSubs: Submission[] = [];
      for (const code of s.classes) {
        const c = await getClass(code);
        if (!c) continue;
        const [subs, acts] = await Promise.all([classSubs(code), classActs(code)]);
        for (const id of new Set(subs.map((x) => x.examId))) if (!examCache[id]) { const e = await getExam(id).catch(() => null); if (e) examCache[id] = e; }
        // bài mới nhất của mỗi học sinh cho mỗi đề
        const latest = new Map<string, Submission>();
        for (const x of subs) { const k = x.examId + '¦' + x.studentName.toLowerCase(); if (!latest.has(k) || latest.get(k)!.submittedAt < x.submittedAt) latest.set(k, x); }
        const L = [...latest.values()];
        allSubs.push(...L);
        const week = new Date(Date.now() - 7 * 864e5).toISOString();
        const active = new Set([...subs.filter((x) => x.submittedAt >= week).map((x) => x.studentName.toLowerCase()), ...acts.filter((a: Activity) => a.at >= week).map((a) => a.studentName.toLowerCase())]).size;
        out.push({
          cls: c, students: c.students.length, subs: subs.length, acts: acts.length,
          avg: L.length ? Math.round((L.reduce((a, x) => a + x.score, 0) / L.length) * 10) / 10 : 0,
          tot: L.filter((x) => x.score >= 9).length, ht: L.filter((x) => x.score >= 5 && x.score < 9).length, cht: L.filter((x) => x.score < 5).length,
          active,
          gaps: topicStats(L, examCache).filter((t) => pct(t) < GAP_THRESHOLD).slice(0, 3).map((t) => ({ topic: t.topic, p: pct(t) })),
        });
      }
      setStats(out.sort((a, b) => a.cls.name.localeCompare(b.cls.name, 'vi', { numeric: true })));
      setKhoiGaps(topicStats(allSubs, examCache).map((t) => ({ topic: t.topic, subject: t.subject, p: pct(t), n: t.count })).slice(0, 12));
    } catch (e: any) { toast(friendly(e), 'err'); } finally { setLoading(false); }
  };
  useEffect(() => { if (school) loadStats(school); }, [school?.id, school?.classes.length]);

  if (!teacher) return null;

  const create = async () => {
    if (!name.trim()) return toast('Nhập tên trường / tổ khối.', 'err');
    const s: School = { id: makeCode(), name: name.trim(), province: teacher.province, createdBy: teacher.uid, members: [teacher.uid], memberNames: { [teacher.uid]: teacher.name }, classes: [] };
    try { await saveSchool(s); await saveTeacher({ ...teacher, schoolCode: s.id }); setSchool(s); toast('Đã tạo. Gửi mã ' + s.id + ' cho đồng nghiệp để cùng tham gia.'); } catch (e: any) { toast(friendly(e), 'err'); }
  };
  const join = async () => {
    try {
      const s = await getSchool(joinCode);
      if (!s) return toast('Không tìm thấy mã ' + joinCode, 'err');
      const n: School = { ...s, members: [...new Set([...s.members, teacher.uid])], memberNames: { ...s.memberNames, [teacher.uid]: teacher.name } };
      await saveSchool(n);
      await saveTeacher({ ...teacher, schoolCode: n.id });
      setSchool(n);
      toast('Đã tham gia ' + n.name);
    } catch (e: any) { toast(friendly(e), 'err'); }
  };
  const toggleClass = async (c: ClassRoom) => {
    if (!school) return;
    const on = school.classes.includes(c.id);
    const n: School = { ...school, classes: on ? school.classes.filter((x) => x !== c.id) : [...school.classes, c.id] };
    try {
      await saveSchool(n);
      const nc = { ...c, schoolCode: on ? undefined : school.id };
      await saveClass(nc);
      setClasses((x) => x.map((y) => (y.id === c.id ? nc : y)));
      setSchool(n);
    } catch (e: any) { toast(friendly(e), 'err'); }
  };
  const excel = async () => {
    const XLSX = await import('xlsx');
    const rows = stats.map((s) => ({ 'Lớp': s.cls.name, 'Giáo viên': s.cls.ownerName, 'Sĩ số': s.students, 'HS học trong tuần': s.active, 'Số bài nộp': s.subs, 'Lượt ôn tập': s.acts, 'Điểm TB': s.avg, 'Hoàn thành tốt': s.tot, 'Hoàn thành': s.ht, 'Chưa hoàn thành': s.cht, 'Phần còn hổng': s.gaps.map((g) => `${g.topic} (${g.p}%)`).join('; ') }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tổng hợp');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(khoiGaps.map((g) => ({ 'Môn': g.subject, 'Chủ đề': g.topic, 'Tỉ lệ đúng (%)': g.p, 'Số lượt': g.n }))), 'Phần hổng chung');
    XLSX.writeFile(wb, safeName('Tong-hop-' + (school?.name || '')) + '.xlsx');
  };

  if (!school) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-5">
          <div className="font-black text-emerald-800 text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Tạo trường / tổ khối</div>
          <div className="text-sm text-slate-600 mt-1">Dành cho khối trưởng, tổ trưởng hoặc Ban giám hiệu. Tạo xong, gửi mã cho giáo viên trong khối để cùng xem tổng hợp.</div>
          <Field label="Tên"><input className={inputCls + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Khối 5 – TH Vương Thừa Vũ" /></Field>
          <Btn className="mt-3" onClick={create}><Plus className="w-4 h-4" /> Tạo</Btn>
        </Card>
        <Card className="p-5">
          <div className="font-black text-sky-800 text-lg flex items-center gap-2"><LogIn className="w-5 h-5" /> Tham gia bằng mã</div>
          <div className="text-sm text-slate-600 mt-1">Nhập mã khối trưởng / nhà trường gửi.</div>
          <div className="flex gap-2 mt-3">
            <input className={inputCls + ' uppercase tracking-widest font-black'} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Mã 6 ký tự" />
            <Btn variant="blue" onClick={join} disabled={joinCode.length < 4}>Tham gia</Btn>
          </div>
        </Card>
      </div>
    );
  }

  const total = stats.reduce((a, s) => ({ st: a.st + s.students, sub: a.sub + s.subs, act: a.act + s.acts, active: a.active + s.active, tot: a.tot + s.tot, ht: a.ht + s.ht, cht: a.cht + s.cht }), { st: 0, sub: 0, act: 0, active: 0, tot: 0, ht: 0, cht: 0 });
  const graded = total.tot + total.ht + total.cht || 1;

  return (
    <div className="space-y-3">
      <div className="rounded-3xl overflow-hidden border-4 border-emerald-300 shadow">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 sm:px-6 py-4 text-white flex flex-wrap items-center gap-3">
          <div className="text-3xl bg-white/25 rounded-2xl w-14 h-14 flex items-center justify-center">🏫</div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xl sm:text-2xl font-black">{school.name.toUpperCase()}</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-50">{school.members.length} giáo viên • {school.classes.length} lớp • Mã tham gia: <b>{school.id}</b></div>
          </div>
          <Btn variant="white" small onClick={() => copyText(`Mời thầy cô tham gia "${school.name}" trên web: ${location.href.split('#')[0]} → Giáo viên → tab Nhà trường → nhập mã ${school.id}`, 'Đã chép lời mời')}><Copy className="w-3.5 h-3.5" /> Chép lời mời</Btn>
          <Btn variant="white" small onClick={() => loadStats(school)} loading={loading}><RefreshCw className="w-3.5 h-3.5" /></Btn>
          <Btn variant="white" small onClick={excel} disabled={!stats.length}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        </div>
      </div>

      <Card className="p-4">
        <div className="text-sm font-black text-slate-700 mb-2">Lớp của tôi tham gia tổng hợp:</div>
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => { const on = school.classes.includes(c.id); return <button key={c.id} onClick={() => toggleClass(c)} className={`px-3 py-1.5 rounded-xl font-black border-2 text-sm ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'}`}>{on ? '✓ ' : '+ '}{c.name}</button>; })}
          {!classes.length && <span className="text-sm text-slate-500">Thầy cô chưa có lớp.</span>}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[['Học sinh', total.st, 'text-slate-800'], ['Học trong tuần', total.active, 'text-orange-500'], ['Bài đã nộp', total.sub, 'text-sky-600'], ['Lượt ôn tập', total.act, 'text-violet-600'], ['Hoàn thành tốt', Math.round((total.tot / graded) * 100) + '%', 'text-emerald-600']].map(([l, v, c]) => (
          <Card key={l as string} className="p-3 text-center"><div className={`text-3xl font-black ${c}`}>{v}</div><div className="text-xs font-bold text-slate-500">{l}</div></Card>
        ))}
      </div>

      {!stats.length ? <Card><Empty icon="📊" title={loading ? 'Đang tổng hợp…' : 'Chưa có lớp nào tham gia'}>Mỗi giáo viên bấm thêm lớp của mình ở ô phía trên.</Empty></Card> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-left text-xs text-slate-600"><tr><th className="p-2">Lớp</th><th className="p-2">Giáo viên</th><th className="p-2 text-center">Sĩ số</th><th className="p-2 text-center">Học tuần này</th><th className="p-2 text-center">Bài nộp</th><th className="p-2 text-center">Lượt ôn</th><th className="p-2 text-center">Điểm TB</th><th className="p-2">HTT / HT / CHT</th><th className="p-2">Phần còn hổng</th></tr></thead>
            <tbody>
              {stats.map((s) => {
                const g = s.tot + s.ht + s.cht || 1;
                return (
                  <tr key={s.cls.id} className="border-t">
                    <td className="p-2 font-black">{s.cls.name}</td>
                    <td className="p-2">{s.cls.ownerName}</td>
                    <td className="p-2 text-center">{s.students}</td>
                    <td className="p-2 text-center">{s.active}</td>
                    <td className="p-2 text-center">{s.subs}</td>
                    <td className="p-2 text-center">{s.acts}</td>
                    <td className="p-2 text-center font-black text-orange-600">{s.avg.toLocaleString('vi-VN')}</td>
                    <td className="p-2 min-w-[140px]">
                      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100"><div className="bg-emerald-500" style={{ width: (s.tot / g) * 100 + '%' }} /><div className="bg-sky-400" style={{ width: (s.ht / g) * 100 + '%' }} /><div className="bg-rose-400" style={{ width: (s.cht / g) * 100 + '%' }} /></div>
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">{s.tot} / {s.ht} / {s.cht}</div>
                    </td>
                    <td className="p-2 text-xs">{s.gaps.map((x) => `${x.topic} (${x.p}%)`).join('; ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {khoiGaps.length > 0 && (
        <Card className="p-4">
          <div className="font-black text-rose-700 mb-2">🎯 Phần kiến thức cả khối cần tăng cường (thấp nhất trước) – gợi ý cho sinh hoạt chuyên môn</div>
          <div className="space-y-2">
            {khoiGaps.map((g) => (
              <div key={g.subject + g.topic}>
                <div className="flex justify-between text-sm font-bold"><span>{g.topic} <span className="text-slate-400 font-semibold">– {g.subject}</span></span><span>{g.p}%</span></div>
                <Bar value={g.p} className="mt-0.5" />
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="text-xs text-slate-500">Thành viên: {Object.values(school.memberNames).join(', ')}</div>
    </div>
  );
}
