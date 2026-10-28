import React, { useEffect, useState } from 'react';
import { School2, FilePlus2, Layers, FileUp, Sparkles, BookCopy, BarChart3, Users, FolderOpen, Bot, Settings as Cog, PlayCircle, ChevronLeft, Zap } from 'lucide-react';
import { Banner, Footer } from './components/Banner';
import { IdentityBar } from './components/IdentityBar';
import { useStore, friendly } from './store';
import { Btn, Card, Toaster, toast } from './components/ui';
import { ExamBank } from './components/ExamBank';
import { ExamEditor, newExam } from './components/ExamEditor';
import { ImportModal } from './components/ImportModal';
import { AiCreateModal } from './components/AiCreateModal';
import { ShareModal } from './components/ShareModal';
import { Results } from './components/Results';
import { Students } from './components/Students';
import { Resources, saveResourceFile } from './components/Resources';
import { AiAssistant } from './components/AiAssistant';
import { Settings } from './components/Settings';
import { StudentHome, StudentLogin } from './components/StudentHome';
import { TestRunner } from './components/TestRunner';
import { ResultView } from './components/ResultView';
import type { Exam, Submission } from './types';
import { deleteExam, freshCode, isCloud, saveExam as apiSaveExam } from './api';
import { AccountCard } from './components/Settings';
import { Modal } from './components/ui';
import { makeCode } from './grading';
import { subjectInfo } from './curriculum';
import { KIND_LABEL } from './types';
import { Rich } from './components/Rich';
import { ParentView } from './components/ParentView';
import { SchoolView } from './components/SchoolView';

type Tab = 'bank' | 'results' | 'students' | 'school' | 'resources' | 'ai' | 'settings';

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const { profile, setProfile, exams, setExams, loading, error, teacher, authReady, classes, classExams } = useStore();
  const hash = useHash();
  const [tab, setTab] = useState<Tab>('bank');
  const [editing, setEditing] = useState<Exam | null>(null);
  const [importing, setImporting] = useState(false);
  const [aiCreate, setAiCreate] = useState(false);
  const [sharing, setSharing] = useState<Exam | null>(null);
  const [resultsExam, setResultsExam] = useState('');
  const [preview, setPreview] = useState<Exam | null>(null);
  const [running, setRunning] = useState<Exam | null>(null);
  const [starting, setStarting] = useState<Exam | null>(null);
  const [done, setDone] = useState<{ exam: Exam; sub: Submission; status: 'sent' | 'queued' | 'practice' } | null>(null);
  const [studentTab, setStudentTab] = useState<'exams' | 'review' | 'history' | undefined>();

  const isTeacher = profile.role === 'teacher' && !!teacher;

  // Link #/lop/MÃLỚP hoặc #/lop/MÃLỚP/de/MÃĐỀ
  const hm = hash.match(/#\/lop\/([A-Z0-9]{4,8})(?:\/de\/([A-Z0-9]{4,10}))?/i);
  const linkClass = hm?.[1]?.toUpperCase();
  const linkExam = hm?.[2]?.toUpperCase();
  useEffect(() => {
    if (!linkClass) return;
    if (profile.role !== 'student') setProfile({ ...profile, role: 'student' });
    if (profile.classCode && profile.classCode !== linkClass) setProfile({ ...profile, role: 'student', classCode: '', className: '', studentName: '' });
  }, [linkClass]);
  useEffect(() => {
    if (!linkClass || !profile.studentName || profile.classCode !== linkClass || loading) return;
    if (linkExam) {
      const ex = classExams.find((e) => e.id === linkExam);
      if (ex) setStarting(ex);
      else if (!loading && classExams.length) toast('Đề này chưa mở hoặc không thuộc lớp em.', 'err');
      else return;
    }
    // Xoá link khỏi thanh địa chỉ VÀ báo cho ứng dụng, để link cũ không tự mở lại đề khi danh sách đề tải lại
    history.replaceState(null, '', location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, [linkClass, linkExam, profile.studentName, profile.classCode, classExams, loading]);

  const saveExam = async (e: Exam) => {
    const ex = { ...e, ownerUid: teacher?.uid, ownerSchool: e.ownerSchool || teacher?.school, author: e.author || teacher?.name || '', updatedAt: new Date().toISOString() };
    if (!ex.id || ex.id.startsWith('tmp')) { ex.id = await freshCode('exams', makeCode); ex.code = ex.id; }
    try {
      await apiSaveExam(ex);
      setExams((xs) => [ex, ...xs.filter((x) => x.id !== ex.id)]);
    } catch (err: any) {
      toast(friendly(err), 'err');
      throw err;
    }
  };

  const saveMany = async (list: Exam[]) => {
    for (const e of list) await saveExam(e);
  };

  // Cổng phụ huynh: #/ph/MÃLỚP/MÃPH
  const ph = hash.match(/#\/ph\/([A-Z0-9]{4,8})\/([A-Za-z0-9]{6,20})/);
  if (ph) return <div className="min-h-screen"><Banner compact /><main className="pt-2"><ParentView code={ph[1].toUpperCase()} keyStr={ph[2]} /></main><Footer /><Toaster /></div>;

  // ---------- Màn làm bài ----------
  if (preview) return <><TestRunner exam={preview} studentName="Xem trước" className="GV" classCode="PREVIEW" practice onExit={() => setPreview(null)} onDone={(sub) => { setDone({ exam: preview, sub, status: 'practice' }); setPreview(null); }} /><Toaster /></>;
  if (running) return <><TestRunner exam={running} studentName={profile.studentName} className={profile.className} classCode={profile.classCode} onExit={() => setRunning(null)} onDone={(sub, status) => { setDone({ exam: running, sub, status }); setRunning(null); }} /><Toaster /></>;

  return (
    <div className="min-h-screen">
      <Banner compact={!!done} />
      <IdentityBar />
      <main className="pb-6">
        {done ? (
          <div className="pt-2"><ResultView exam={done.exam} sub={done.sub} status={done.status} onHome={() => setDone(null)} onReview={() => { setDone(null); setStudentTab('review'); }} /></div>
        ) : isTeacher ? (
          <div className="max-w-[1280px] mx-auto px-2 sm:px-4 space-y-3">
            {/* Thanh tác vụ nhanh */}
            <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 border-4 border-orange-300 shadow-lg px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2">
              <div className="font-black text-white flex items-center gap-1.5 text-sm"><Zap className="w-4 h-4" /> NÚT TÁC VỤ NHANH:</div>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Btn variant="white" onClick={() => setEditing(newExam(teacher))}><FilePlus2 className="w-4 h-4" /> Tạo đề mới</Btn>
                <Btn variant="blue" onClick={() => setImporting(true)}><FileUp className="w-4 h-4" /> Tải đề Word / PDF</Btn>
                <Btn variant="violet" onClick={() => setAiCreate(true)}><Sparkles className="w-4 h-4" /> AI soạn đề</Btn>
                <Btn variant="primary" onClick={() => setTab('bank')}><Layers className="w-4 h-4" /> Quản lý đề ({exams.length})</Btn>
              </div>
            </div>
            {/* Thanh điều hướng */}
            <nav className="rounded-2xl bg-white border-2 border-amber-200 shadow-sm p-1.5 grid grid-cols-4 md:grid-cols-7 gap-1 no-print">
              {([
                ['bank', 'Ngân hàng đề', <BookCopy className="w-4 h-4" />],
                ['results', 'Kết quả & Phân tích', <BarChart3 className="w-4 h-4" />],
                ['students', 'Lớp học & Ôn tập', <Users className="w-4 h-4" />],
                ['school', 'Nhà trường', <School2 className="w-4 h-4" />],
                ['resources', 'Tài liệu chung', <FolderOpen className="w-4 h-4" />],
                ['ai', 'Trợ lý AI', <Bot className="w-4 h-4" />],
                ['settings', 'Cài đặt', <Cog className="w-4 h-4" />],
              ] as const).map(([k, l, ic]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-2 py-2.5 text-[11px] sm:text-sm font-black uppercase flex flex-col sm:flex-row items-center justify-center gap-1 transition ${tab === k ? 'bg-orange-500 text-white shadow' : 'text-slate-700 hover:bg-amber-50'}`}>{ic}<span className="text-center leading-tight">{l}</span></button>
              ))}
            </nav>
            {error && <Card className="p-3 text-sm font-bold text-rose-700 bg-rose-50">⚠️ {error}</Card>}
            {!isCloud() && tab === 'bank' && (
              <Card className="p-3 text-sm bg-sky-50 border-sky-200 text-sky-900"><b>Chế độ thử:</b> dữ liệu đang lưu trên máy này (web chưa có cấu hình Firebase).</Card>
            )}
            {!classes.length && !loading && (
              <Card className="p-3 text-sm bg-amber-50 border-amber-200 text-amber-900 flex flex-wrap items-center gap-2"><span>👋 <b>Bước đầu tiên:</b> tạo lớp và thêm danh sách học sinh để giao bài.</span><Btn small variant="orange" onClick={() => setTab('students')}>Tạo lớp ngay</Btn></Card>
            )}
            {tab === 'bank' && <ExamBank onEdit={setEditing} onShare={setSharing} onPreview={setPreview} onResults={(e) => { setResultsExam(e.id); setTab('results'); }} saveExam={saveExam} removeExam={async (e) => { await deleteExam(e.id); setExams((xs) => xs.filter((x) => x.id !== e.id)); toast('Đã xoá đề.'); }} />}
            {tab === 'results' && <Results examId={resultsExam} setExamId={setResultsExam} />}
            {tab === 'students' && <Students />}
            {tab === 'school' && <SchoolView />}
            {tab === 'resources' && <Resources />}
            {tab === 'ai' && <AiAssistant />}
            {tab === 'settings' && <Settings />}
          </div>
        ) : !profile.studentName || !profile.classCode ? (
          <div className="px-2 sm:px-4 pt-2"><StudentLogin presetCode={linkClass} /></div>
        ) : starting ? (
          <StartScreen exam={starting} onBack={() => setStarting(null)} onStart={() => { setRunning(starting); setStarting(null); }} />
        ) : (
          <StudentHome onStart={setStarting} initialTab={studentTab} />
        )}
      </main>
      <Footer />
      {editing && <ExamEditor exam={editing} onClose={() => setEditing(null)} onPreview={setPreview} onSave={async (e) => { await saveExam(e); setEditing(null); toast('Đã lưu đề ✔'); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onSaveMany={saveMany} onEdit={(e) => { setImporting(false); setEditing(e); }} onSaveResource={(f, s, k) => saveResourceFile(f, s, k, teacher).then(() => {})} />}
      {aiCreate && <AiCreateModal onClose={() => setAiCreate(false)} onCreated={(e) => { setAiCreate(false); setEditing(e); }} />}
      {sharing && <ShareModal exam={sharing} saveExam={saveExam} onClose={() => setSharing(null)} />}
      {isTeacher && teacher && (!teacher.school || !teacher.province) && (
        <Modal open onClose={() => {}} title="👋 Chào mừng thầy cô! Hoàn tất thông tin (1 lần)">
          <AccountCard />
        </Modal>
      )}
      <Toaster />
    </div>
  );
}

function StartScreen({ exam, onStart, onBack }: { exam: Exam; onStart: () => void; onBack: () => void }) {
  const si = subjectInfo(exam.subject);
  return (
    <div className="max-w-xl mx-auto px-3">
      <Card className="p-6 text-center">
        <div className="text-6xl">{si.icon}</div>
        <div className="text-sm font-bold text-slate-500 mt-1">{exam.subject} • {KIND_LABEL[exam.kind]}</div>
        <div className="text-2xl font-black text-slate-800 mt-1">{exam.title}</div>
        <div className="grid grid-cols-3 gap-2 my-4">
          <div className="rounded-2xl bg-amber-50 p-3"><div className="text-2xl font-black text-orange-500">{exam.questions.length}</div><div className="text-xs font-bold text-slate-500">câu hỏi</div></div>
          <div className="rounded-2xl bg-amber-50 p-3"><div className="text-2xl font-black text-orange-500">{exam.duration || '∞'}</div><div className="text-xs font-bold text-slate-500">phút</div></div>
          <div className="rounded-2xl bg-amber-50 p-3"><div className="text-2xl font-black text-orange-500">10</div><div className="text-xs font-bold text-slate-500">điểm</div></div>
        </div>
        {exam.note && <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 text-left text-sm mb-3"><Rich text={exam.note} /></div>}
        <div className="text-sm text-slate-600 text-left space-y-1 mb-4">
          <div>✅ Bài làm tự lưu – lỡ tắt máy vẫn làm tiếp được.</div>
          <div>🔊 Bấm "Đọc to" nếu em muốn nghe đề.</div>
          <div>🎯 Làm xong em biết ngay điểm và phần cần ôn thêm.</div>
        </div>
        <Btn variant="orange" className="w-full py-4 text-lg" onClick={onStart}><PlayCircle className="w-6 h-6" /> Bắt đầu làm bài</Btn>
        <Btn variant="ghost" className="w-full mt-2" onClick={onBack}><ChevronLeft className="w-4 h-4" /> Quay lại</Btn>
      </Card>
    </div>
  );
}
