import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api';
import type { ClassRoom, Exam, Profile, Teacher } from './types';
import { SEED_EXAMS } from './seed';
import { toast } from './components/ui';

interface Store {
  teacher: Teacher | null;
  authReady: boolean;
  exams: Exam[]; // đề của giáo viên đang đăng nhập
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  classes: ClassRoom[]; // lớp của giáo viên
  setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  profile: Profile;
  setProfile: (p: Profile) => void;
  // học sinh
  myClass: ClassRoom | null;
  classExams: Exam[];
  refreshStudent: () => Promise<void>;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

const PKEY = 'kt5_profile2';
function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (p) return p;
  } catch {}
  return { role: 'student', classCode: '', className: '', teacherName: '', studentName: '' };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setP] = useState<Profile>(loadProfile);
  const [myClass, setMyClass] = useState<ClassRoom | null>(null);
  const [classExams, setClassExams] = useState<Exam[]>([]);

  const setProfile = (p: Profile) => {
    setP(p);
    try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {}
  };

  useEffect(() => {
    let off = () => {};
    api.watchTeacher((t) => { setTeacher(t); setAuthReady(true); }).then((u) => (off = u)).catch((e) => { setError(e.message); setAuthReady(true); });
    const h = (e: Event) => setTeacher((e as CustomEvent).detail);
    window.addEventListener('kt5-teacher', h);
    return () => { off(); window.removeEventListener('kt5-teacher', h); };
  }, []);

  const refresh = useCallback(async () => {
    if (!teacher) return;
    setLoading(true);
    setError('');
    try {
      let ex = await api.myExams(teacher.uid);
      // Chế độ thử trên một máy: nạp sẵn đề mẫu lần đầu
      if (!api.isCloud() && !ex.length && !localStorage.getItem('kt5_seeded')) {
        for (const e of SEED_EXAMS) await api.saveExam({ ...e, ownerUid: teacher.uid });
        localStorage.setItem('kt5_seeded', '1');
        ex = await api.myExams(teacher.uid);
      }
      setExams(ex.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
      setClasses((await api.myClasses(teacher.uid)).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })));
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }, [teacher?.uid]);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshStudent = useCallback(async () => {
    if (!profile.classCode) { setMyClass(null); setClassExams([]); return; }
    setLoading(true);
    try {
      const c = await api.getClass(profile.classCode);
      setMyClass(c);
      if (c) setClassExams((await api.classExams(c.id)).filter((e) => e.open).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }, [profile.classCode]);

  useEffect(() => { if (profile.role === 'student') refreshStudent(); }, [refreshStudent, profile.role]);

  useEffect(() => {
    const sync = () => api.flushQueue().then((n) => n && toast(`Đã gửi ${n} bài làm còn chờ (lúc mất mạng).`));
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, []);

  return (
    <Ctx.Provider value={{ teacher, authReady, exams, setExams, classes, setClasses, loading, error, refresh, profile, setProfile, myClass, classExams, refreshStudent }}>
      {children}
    </Ctx.Provider>
  );
}

export function friendly(e: any): string {
  const m = String(e?.message || e);
  if (/permission|insufficient/i.test(m)) return 'Không có quyền thực hiện thao tác này (kiểm tra lại đăng nhập).';
  if (/offline|network|Failed to fetch|unavailable/i.test(m)) return 'Không kết nối được máy chủ – kiểm tra mạng rồi thử lại.';
  return m;
}
