import React, { useEffect, useState } from 'react';
import type { ClassRoom } from '../types';
import { getClass } from '../api';
import { Card, Empty } from './ui';
import { ReportCard, SkillTree, TreeAndBadges, useStudentData } from './Learner';
import { attemptComment, dinnerQuestion } from '../analytics';
import { fmtDate, pct, rank, topicStats } from '../grading';
import { subjectInfo } from '../curriculum';
import { friendly } from '../store';

export function parentLink(c: ClassRoom, name: string) {
  const key = c.parentKeys?.[name];
  return key ? location.href.split('#')[0].split('?')[0] + `#/ph/${c.id}/${key}` : '';
}

// Cổng phụ huynh: mở bằng link riêng của từng học sinh, không cần tài khoản
export function ParentView({ code, keyStr }: { code: string; keyStr: string }) {
  const [cls, setCls] = useState<ClassRoom | null | undefined>(undefined);
  const [err, setErr] = useState('');
  useEffect(() => { getClass(code).then(setCls).catch((e) => { setErr(friendly(e)); setCls(null); }); }, [code]);
  const name = cls ? Object.entries(cls.parentKeys || {}).find(([, k]) => k === keyStr)?.[0] || '' : '';
  if (cls === undefined) return <div className="text-center py-16 font-bold text-slate-500">Đang tải…</div>;
  if (!cls || !name) return <Card className="max-w-xl mx-auto"><Empty icon="🔒" title="Link phụ huynh không đúng hoặc đã hết hiệu lực">{err || 'Bố mẹ liên hệ cô giáo chủ nhiệm để nhận lại link.'}</Empty></Card>;
  return <ParentBody cls={cls} name={name} />;
}

function ParentBody({ cls, name }: { cls: ClassRoom; name: string }) {
  const d = useStudentData(cls.id, name);
  const comments = d.subs.flatMap((s) => s.results.filter((r) => r.comment).map((r) => ({ at: s.submittedAt, title: s.examTitle, text: r.comment! })));
  const timeline = [
    ...d.subs.map((s) => {
      const st = topicStats([s], d.byId);
      const strong = st.filter((t) => pct(t) >= 80).slice(-1)[0];
      const weak = st.filter((t) => pct(t) < 70)[0];
      return { at: s.submittedAt, icon: subjectInfo(s.subject).icon, title: s.examTitle, badge: `${s.score.toLocaleString('vi-VN')} điểm – ${s.pending ? 'chờ chấm' : rank(s.score).label}`, text: attemptComment({ name, title: s.examTitle, percent: Math.round((s.raw / (s.rawMax || 1)) * 100), durationSec: s.durationSec, total: s.results.length, strong: strong ? `${strong.topic} (${pct(strong)}%)` : undefined, weak: weak?.topic, kind: 'exam' }) };
    }),
    ...d.acts.map((a) => ({ at: a.at, icon: a.kind === 'daily' ? '🚀' : a.kind === 'rescue' ? '🛟' : '✏️', title: a.kind === 'daily' ? 'Nhiệm vụ mỗi ngày' : (a.kind === 'rescue' ? 'Giải cứu kiến thức: ' : 'Ôn tập: ') + a.topic, badge: `đúng ${a.percent}%`, text: attemptComment({ name, title: a.kind === 'daily' ? 'Nhiệm vụ mỗi ngày' : a.topic, percent: a.percent, durationSec: a.durationSec, total: a.total, kind: a.kind }) })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);

  return (
    <div className="max-w-3xl mx-auto px-3 pb-10 space-y-4">
      <Card className="p-5 text-center bg-gradient-to-r from-emerald-50 to-amber-50">
        <div className="text-4xl">👨‍👩‍👧</div>
        <div className="font-black text-xl text-emerald-800">Cổng phụ huynh</div>
        <div className="font-bold">Con: {name} – Lớp {cls.name}</div>
        <div className="text-xs text-slate-500 font-bold">{cls.school}{cls.province ? ' – ' + cls.province : ''} • GVCN: {cls.ownerName}</div>
      </Card>
      {cls.notice && <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 px-4 py-3 font-bold text-sky-900">📢 Thông báo của cô: {cls.notice}</div>}

      {d.loading ? <div className="text-center py-10 font-bold text-slate-500">Đang tải kết quả học tập…</div> : (
        <>
          {d.warnings.map((w) => (
            <Card key={w.topic} className="p-4 border-rose-200 bg-rose-50">
              <div className="font-black text-rose-800">🧭 Con đang bị vướng một chút ở phần "{w.topic}"</div>
              <div className="text-sm mt-1">Ba lần gần đây con làm phần này chưa tốt. Bố mẹ dành 10 phút cùng con mở <b>Góc ôn tập</b> trên web để luyện lại nhé – không cần lo lắng, con chỉ cần thêm chút thời gian.</div>
              {cls.videos?.[w.topic] && <a href={cls.videos[w.topic]} target="_blank" rel="noreferrer" className="inline-block mt-2 font-black text-rose-700 underline">▶️ Mở video 1 phút cô gửi để con xem lại</a>}
              <div className="text-sm mt-2"><b>🍽️ Gợi ý hỏi con:</b> {dinnerQuestion(w.topic)}</div>
            </Card>
          ))}

          <Card className="p-4 sm:p-5">
            <div className="font-black text-lg text-violet-800 mb-2">📰 Bản tin tuần của con</div>
            <ReportCard name={name} cls={cls} subs={d.subs} acts={d.acts} skills={d.skills} streakDays={d.streakDays} />
          </Card>

          {comments.length > 0 && (
            <Card className="p-4">
              <div className="font-black text-violet-800 mb-2">💬 Nhận xét của cô</div>
              {comments.slice(-5).reverse().map((c, i) => <div key={i} className="text-sm border-b last:border-0 py-1.5"><b>{c.title}:</b> {c.text}</div>)}
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <div className="font-black text-lg text-emerald-800 mb-3">🌳 Cây tri thức & huy hiệu của con</div>
            <TreeAndBadges skills={d.skills} subs={d.subs} acts={d.acts} streakDays={d.streakDays} />
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="font-black text-lg text-emerald-800 mb-3">🗺️ Bản đồ kỹ năng</div>
            <SkillTree skills={d.skills} compact />
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="font-black text-lg text-slate-700 mb-2">🕒 Hoạt động gần đây & nhận xét tự động</div>
            {timeline.length === 0 ? <div className="text-sm text-slate-500">Con chưa làm bài nào.</div> : timeline.map((t, i) => (
              <div key={i} className="py-2 border-b last:border-0">
                <div className="flex items-center gap-2 text-sm"><span className="text-xl">{t.icon}</span><b className="flex-1">{t.title}</b><span className="text-xs font-black text-orange-600">{t.badge}</span></div>
                <div className="text-[13px] text-slate-600 mt-0.5">{t.text}</div>
                <div className="text-[11px] text-slate-400">{fmtDate(t.at)}</div>
              </div>
            ))}
          </Card>
          <div className="text-center text-xs text-slate-500">Bản tin không so sánh con với các bạn – chỉ ghi nhận sự cố gắng và tiến bộ của chính con. 💛</div>
        </>
      )}
    </div>
  );
}
