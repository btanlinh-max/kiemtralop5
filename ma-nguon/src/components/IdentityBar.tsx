import React, { useState } from 'react';
import { GraduationCap, ShieldCheck, UserCircle2, LogOut, Cloud, HardDrive } from 'lucide-react';
import { useStore } from '../store';
import { isCloud, signIn, signOutTeacher } from '../api';
import { Btn, inputCls, toast } from './ui';

export function IdentityBar() {
  const { profile, setProfile, teacher } = useStore();
  const [wantTeacher, setWantTeacher] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const isTeacherView = profile.role === 'teacher' && !!teacher;

  const login = async () => {
    setBusy(true);
    try {
      if (!isCloud() && !name.trim()) { toast('Nhập họ tên giáo viên.', 'err'); return; }
      await signIn({ name: name.trim(), email: email.trim() });
      setProfile({ ...profile, role: 'teacher' });
      setWantTeacher(false);
    } catch (e: any) {
      toast('Không đăng nhập được: ' + (e.message || e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex justify-center px-2 sm:px-4 py-2 no-print">
      <div className="w-full max-w-[1280px] rounded-2xl border-4 border-amber-200 bg-amber-50/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
          <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5"><UserCircle2 className="w-4 h-4" /> VAI TRÒ:</div>
          <div className="flex bg-white rounded-full p-1 border-2 border-amber-200">
            <button onClick={() => { setWantTeacher(false); setProfile({ ...profile, role: 'student' }); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-black flex items-center gap-1 ${profile.role === 'student' && !wantTeacher ? 'bg-orange-500 text-white shadow' : 'text-slate-600'}`}>
              <GraduationCap className="w-4 h-4" /> Học sinh
            </button>
            <button onClick={() => (teacher ? setProfile({ ...profile, role: 'teacher' }) : setWantTeacher(true))}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-black flex items-center gap-1 ${isTeacherView || wantTeacher ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}>
              <ShieldCheck className="w-4 h-4" /> Giáo viên
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black border ${isCloud() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {isCloud() ? <><Cloud className="w-3 h-3" /> Dữ liệu trực tuyến</> : <><HardDrive className="w-3 h-3" /> Chế độ thử trên máy này</>}
            </span>
            {isTeacherView && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 px-3 py-1 text-[11px] sm:text-xs font-bold">
                {teacher!.photo ? <img src={teacher!.photo} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" /> : '●'} {teacher!.name}{teacher!.email ? ` (${teacher!.email})` : ''}
                <button title="Đăng xuất" onClick={async () => { await signOutTeacher(); setProfile({ ...profile, role: 'student' }); }}><LogOut className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {profile.role === 'student' && profile.studentName && !wantTeacher && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800 px-3 py-1 text-[11px] sm:text-xs font-bold">
                🎒 {profile.studentName} – Lớp {profile.className}
                <button className="underline" onClick={() => setProfile({ ...profile, studentName: '', classCode: '', className: '' })}>Đổi</button>
              </span>
            )}
          </div>
        </div>
        {wantTeacher && !teacher && (
          <div className="bg-white border-t-2 border-amber-200 px-3 sm:px-4 py-4">
            <div className="text-xs font-black text-emerald-800 mb-2">🛡️ CỔNG DÀNH CHO GIÁO VIÊN – THẦY CÔ Ở MỌI MIỀN ĐỀU DÙNG ĐƯỢC, MIỄN PHÍ</div>
            {isCloud() ? (
              <div className="flex flex-wrap items-center gap-3">
                <Btn onClick={login} loading={busy} className="py-3 px-5 bg-white !text-slate-800 border-2 border-slate-300 hover:!bg-slate-50">
                  <svg viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                  Đăng nhập bằng Google
                </Btn>
                <span className="text-xs text-slate-500">Lần đầu đăng nhập, thầy cô điền tên trường rồi tự tạo lớp, thêm học sinh của mình.</span>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                <label className="block"><span className="text-[11px] font-bold text-slate-600">Họ và tên giáo viên</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cô giáo Phạm Hồng Hạnh" /></label>
                <label className="block"><span className="text-[11px] font-bold text-slate-600">Gmail</span><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label>
                <Btn onClick={login} loading={busy} className="py-3"><ShieldCheck className="w-4 h-4" /> Vào hệ thống (chế độ thử)</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
