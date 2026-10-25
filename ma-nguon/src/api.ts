// Lớp dữ liệu: Firebase (dùng chung toàn quốc) hoặc lưu trên máy (chế độ thử khi chưa có cấu hình).
import { CONFIG } from './config';
import type { ClassRoom, Exam, Resource, Review, Submission, Teacher } from './types';

export const isCloud = () => !!CONFIG.firebase;
const fb = () => import('./fb');

// Firestore không nhận mảng lồng nhau / undefined → lưu các phần phức tạp dạng chuỗi JSON
const JSON_FIELDS: Record<string, string[]> = { exams: ['passages', 'questions'], subs: ['answers', 'results'], reviews: ['questions'] };
function enc(kind: string, obj: any) {
  const o = JSON.parse(JSON.stringify(obj));
  for (const f of JSON_FIELDS[kind] || []) if (f in o) { o[f + '_json'] = JSON.stringify(o[f]); delete o[f]; }
  return o;
}
function dec<T>(kind: string, o: any): T {
  if (!o) return o;
  for (const f of JSON_FIELDS[kind] || []) if (typeof o[f + '_json'] === 'string') { try { o[f] = JSON.parse(o[f + '_json']); } catch { o[f] = []; } delete o[f + '_json']; }
  return o as T;
}

// ---------- Chế độ trên một máy ----------
type LCol = 'exams' | 'classes' | 'subs' | 'reviews' | 'resources' | 'teachers';
function lget<T>(col: LCol): T[] { try { return JSON.parse(localStorage.getItem('kt5_db_' + col) || '[]'); } catch { return []; } }
function lset(col: LCol, arr: any[]) {
  try { localStorage.setItem('kt5_db_' + col, JSON.stringify(arr)); }
  catch { throw new Error('Bộ nhớ trên máy đã đầy. Hãy xoá bớt tài liệu lớn.'); }
}
function lput(col: LCol, item: any) {
  const arr = lget<any>(col);
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.unshift(item);
  lset(col, arr);
  return item;
}
const ldel = (col: LCol, id: string) => lset(col, lget<any>(col).filter((x) => x.id !== id));
const lfind = <T,>(col: LCol, f: (x: T) => boolean) => lget<T>(col).filter(f);
const eq = (a: any, b: any) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

// ---------- Đăng nhập giáo viên ----------
const LT = 'kt5_local_teacher';
export async function watchTeacher(cb: (t: Teacher | null) => void): Promise<() => void> {
  if (!isCloud()) {
    try { cb(JSON.parse(localStorage.getItem(LT) || 'null')); } catch { cb(null); }
    const h = () => { try { cb(JSON.parse(localStorage.getItem(LT) || 'null')); } catch {} };
    window.addEventListener('kt5-local-auth', h);
    return () => window.removeEventListener('kt5-local-auth', h);
  }
  const f = await fb();
  return f.onUser(async (u) => {
    if (!u) return cb(null);
    let t: Teacher | null = null;
    try { t = (await f.fget('teachers/' + u.uid)) as Teacher | null; } catch {}
    cb({ uid: u.uid, name: t?.name || u.displayName || '', email: u.email || '', school: t?.school || '', province: t?.province || '', photo: u.photoURL || '' });
  });
}

export async function signIn(local?: { name: string; email: string }) {
  if (!isCloud()) {
    const t: Teacher = { uid: 'local', name: local?.name || 'Giáo viên', email: local?.email || '', school: '', province: '' };
    const old = (() => { try { return JSON.parse(localStorage.getItem(LT) || 'null'); } catch { return null; } })();
    localStorage.setItem(LT, JSON.stringify({ ...t, school: old?.school || '', province: old?.province || '' }));
    window.dispatchEvent(new Event('kt5-local-auth'));
    return;
  }
  await (await fb()).googleSignIn();
}

export async function signOutTeacher() {
  if (!isCloud()) { localStorage.removeItem(LT); window.dispatchEvent(new Event('kt5-local-auth')); return; }
  await (await fb()).logout();
}

export async function saveTeacher(t: Teacher) {
  if (!isCloud()) { localStorage.setItem(LT, JSON.stringify(t)); window.dispatchEvent(new Event('kt5-local-auth')); return; }
  await (await fb()).fset('teachers/' + t.uid, JSON.parse(JSON.stringify(t)));
  window.dispatchEvent(new CustomEvent('kt5-teacher', { detail: t }));
}

// ---------- Đề ----------
export async function myExams(uid: string): Promise<Exam[]> {
  if (!isCloud()) return lget<Exam>('exams').filter((e) => !e.ownerUid || e.ownerUid === uid);
  return (await (await fb()).flist('exams', [['ownerUid', '==', uid]])).map((x) => dec<Exam>('exams', x));
}
export async function publicExams(): Promise<Exam[]> {
  if (!isCloud()) return lget<Exam>('exams').filter((e) => e.public);
  return (await (await fb()).flist('exams', [['public', '==', true]], 300)).map((x) => dec<Exam>('exams', x));
}
export async function classExams(code: string): Promise<Exam[]> {
  if (!isCloud()) return lget<Exam>('exams').filter((e) => (e.classes || []).includes(code));
  return (await (await fb()).flist('exams', [['classes', 'array-contains', code]])).map((x) => dec<Exam>('exams', x));
}
export async function getExam(id: string): Promise<Exam | null> {
  if (!isCloud()) return lget<Exam>('exams').find((e) => e.id === id || e.code === id) || null;
  return dec<Exam>('exams', await (await fb()).fget('exams/' + id));
}
export async function saveExam(e: Exam) {
  if (!isCloud()) return lput('exams', e);
  await (await fb()).fset('exams/' + e.id, enc('exams', e));
  return e;
}
export async function deleteExam(id: string) {
  if (!isCloud()) return ldel('exams', id);
  await (await fb()).fdel('exams/' + id);
}

// ---------- Lớp ----------
export async function myClasses(uid: string): Promise<ClassRoom[]> {
  if (!isCloud()) return lget<ClassRoom>('classes').filter((c) => c.ownerUid === uid);
  return (await (await fb()).flist('classes', [['ownerUid', '==', uid]])) as ClassRoom[];
}
export async function getClass(code: string): Promise<ClassRoom | null> {
  code = code.trim().toUpperCase();
  if (!isCloud()) return lget<ClassRoom>('classes').find((c) => c.id === code) || null;
  return (await (await fb()).fget('classes/' + code)) as ClassRoom | null;
}
export async function saveClass(c: ClassRoom) {
  if (!isCloud()) return lput('classes', c);
  await (await fb()).fset('classes/' + c.id, JSON.parse(JSON.stringify(c)));
  return c;
}
export async function deleteClass(code: string) {
  if (!isCloud()) return ldel('classes', code);
  await (await fb()).fdel('classes/' + code);
}

// ---------- Bài làm ----------
export async function classSubs(code: string, f: { examId?: string; studentName?: string } = {}): Promise<Submission[]> {
  if (!isCloud()) return lfind<Submission>('subs', (s) => s.classCode === code && (!f.examId || s.examId === f.examId) && (!f.studentName || eq(s.studentName, f.studentName)));
  const filters: [string, string, any][] = [];
  if (f.examId) filters.push(['examId', '==', f.examId]);
  if (f.studentName) filters.push(['studentName', '==', f.studentName]);
  return (await (await fb()).flist(`classes/${code}/subs`, filters, 2000)).map((x) => dec<Submission>('subs', x));
}
export async function saveSub(s: Submission) {
  if (!isCloud()) return lput('subs', s);
  await (await fb()).fset(`classes/${s.classCode}/subs/${s.id}`, enc('subs', s));
  return s;
}
export async function deleteSub(s: Submission) {
  if (!isCloud()) return ldel('subs', s.id);
  await (await fb()).fdel(`classes/${s.classCode}/subs/${s.id}`);
}

// Nộp bài (có hàng đợi khi mất mạng)
const QKEY = 'kt5_queue';
const queue = (): Submission[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
const setQueue = (q: Submission[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} };
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, j) => setTimeout(() => j(new Error('timeout')), ms))]);

export async function submit(sub: Submission): Promise<'sent' | 'queued'> {
  try {
    const mine = JSON.parse(localStorage.getItem('kt5_mysubs') || '[]');
    mine.unshift(sub);
    localStorage.setItem('kt5_mysubs', JSON.stringify(mine.slice(0, 100)));
  } catch {}
  try {
    await withTimeout(saveSub(sub), 12000);
    return 'sent';
  } catch (e: any) {
    if (e?.code === 'permission-denied') return 'sent'; // bài đã có trên máy chủ (lần gửi trước đã tới nơi)
    setQueue([...queue().filter((x) => x.id !== sub.id), sub]);
    return 'queued';
  }
}
export async function flushQueue(): Promise<number> {
  const q = queue();
  if (!q.length) return 0;
  const left: Submission[] = [];
  let n = 0;
  for (const s of q) { try { await withTimeout(saveSub(s), 12000); n++; } catch (e: any) { if (e?.code === 'permission-denied') n++; else left.push(s); } }
  setQueue(left);
  return n;
}
export const pendingCount = () => queue().length;

// ---------- Bài ôn riêng ----------
export async function classReviews(code: string, f: { studentName?: string } = {}): Promise<Review[]> {
  if (!isCloud()) return lfind<Review>('reviews', (r) => r.classCode === code && (!f.studentName || eq(r.studentName, f.studentName)));
  return (await (await fb()).flist(`classes/${code}/reviews`, f.studentName ? [['studentName', '==', f.studentName]] : [], 2000)).map((x) => dec<Review>('reviews', x));
}
export async function saveReview(r: Review) {
  if (!isCloud()) return lput('reviews', r);
  await (await fb()).fset(`classes/${r.classCode}/reviews/${r.id}`, enc('reviews', r));
  return r;
}
export async function deleteReview(r: Review) {
  if (!isCloud()) return ldel('reviews', r.id);
  await (await fb()).fdel(`classes/${r.classCode}/reviews/${r.id}`);
}
export async function reviewProgress(r: Review, best: number) {
  const upd = { attempts: (r.attempts || 0) + 1, best: Math.max(r.best || 0, best), mastered: !!r.mastered || best >= 80 };
  Object.assign(r, upd);
  if (!isCloud()) {
    const arr = lget<Review>('reviews');
    const x = arr.find((y) => y.id === r.id);
    if (x) { Object.assign(x, upd); lset('reviews', arr); }
    return;
  }
  await (await fb()).fupdate(`classes/${r.classCode}/reviews/${r.id}`, upd);
}

// ---------- Tài liệu ----------
export async function myResources(uid: string): Promise<Resource[]> {
  if (!isCloud()) return lget<Resource>('resources').filter((r) => !r.ownerUid || r.ownerUid === uid);
  return (await (await fb()).flist('resources', [['ownerUid', '==', uid]])) as Resource[];
}
export async function publicResources(): Promise<Resource[]> {
  if (!isCloud()) return lget<Resource>('resources').filter((r) => r.public);
  return (await (await fb()).flist('resources', [['public', '==', true]], 300)) as Resource[];
}
export async function saveResource(r: Resource) {
  if (!isCloud()) return lput('resources', r);
  await (await fb()).fset('resources/' + r.id, JSON.parse(JSON.stringify(r)));
  return r;
}
export async function deleteResource(id: string) {
  if (!isCloud()) return ldel('resources', id);
  await (await fb()).fdel('resources/' + id);
}

// Mã ngẫu nhiên chưa bị dùng (cho lớp/đề)
export async function freshCode(kind: 'exams' | 'classes', make: () => string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = make();
    const exists = kind === 'exams' ? await getExam(c) : await getClass(c);
    if (!exists) return c;
  }
  return make() + make().slice(0, 2);
}
