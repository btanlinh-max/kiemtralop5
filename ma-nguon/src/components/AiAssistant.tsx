import React, { useRef, useState } from 'react';
import { Send, Sparkles, Copy, Trash2 } from 'lucide-react';
import { ask, hasKey } from '../ai';
import { Btn, Card, toast } from './ui';
import { Rich } from './Rich';

const PRESETS = [
  { icon: '📝', label: 'Phiếu bài tập cuối tuần', text: 'Soạn phiếu bài tập cuối tuần môn Toán lớp 5 (Kết nối tri thức), chủ đề: số thập phân. Gồm 6 bài từ dễ đến khó, có đáp án ở cuối.' },
  { icon: '📖', label: 'Câu hỏi đọc hiểu', text: 'Soạn 6 câu hỏi đọc hiểu theo 3 mức TT27 cho bài đọc sau (dán bài đọc vào đây):\n' },
  { icon: '🧮', label: 'Giải bài toán từng bước', text: 'Giải từng bước, dễ hiểu cho học sinh lớp 5 bài toán sau: ' },
  { icon: '🎯', label: 'Ma trận đề', text: 'Lập bảng ma trận đề kiểm tra cuối học kì I môn Toán lớp 5 theo TT27 (tỉ lệ M1 40% – M2 40% – M3 20%), ghi rõ mạch kiến thức, số câu, số điểm.' },
  { icon: '💬', label: 'Nhận xét học sinh', text: 'Viết 5 mẫu lời nhận xét môn Tiếng Việt lớp 5 theo TT27 cho học sinh mức Hoàn thành, ngắn gọn, cụ thể, động viên.' },
  { icon: '🎲', label: 'Trò chơi khởi động', text: 'Gợi ý 3 trò chơi khởi động 5 phút cho tiết Toán lớp 5 bài "Nhân số thập phân", có luật chơi và câu hỏi cụ thể.' },
];

export function AiAssistant() {
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const send = async (t = input) => {
    if (!t.trim()) return;
    const history = msgs.slice(-6).map((m) => (m.role === 'user' ? 'Giáo viên: ' : 'Trợ lý: ') + m.text).join('\n\n');
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    setInput('');
    setBusy(true);
    setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const r = await ask((history ? 'Hội thoại trước:\n' + history + '\n\n' : '') + 'Yêu cầu mới: ' + t, {
        system: 'Bạn là trợ lý chuyên môn cho giáo viên tiểu học Việt Nam (lớp 5, sách Kết nối tri thức, CT GDPT 2018, TT27). Trả lời tiếng Việt, ngắn gọn, trình bày rõ ràng bằng gạch đầu dòng, dùng **đậm** cho ý chính. Phân số viết {a/b}. Không dùng bảng markdown phức tạp.',
      });
      setMsgs((m) => [...m, { role: 'ai', text: r.replace(/^#+\s*/gm, '').trim() }]);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-3xl overflow-hidden border-4 border-violet-300 shadow">
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 sm:px-6 py-4 text-white flex items-center gap-3">
          <div className="text-3xl bg-white/25 rounded-2xl w-14 h-14 flex items-center justify-center">🤖</div>
          <div>
            <div className="text-xl sm:text-2xl font-black">TRỢ LÝ AI CHUYÊN MÔN</div>
            <div className="text-xs sm:text-sm font-bold text-violet-100">Soạn phiếu, ma trận, câu hỏi, nhận xét… Dùng mã AI riêng của thầy cô.</div>
          </div>
        </div>
      </div>
      {!hasKey() && <Card className="p-4 text-sm font-bold text-rose-700 bg-rose-50">Cần mã AI Gemini – vào tab ⚙️ Cài đặt để thêm (miễn phí).</Card>}
      {msgs.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setInput(p.text)} className="text-left rounded-2xl border-2 border-violet-200 bg-white hover:bg-violet-50 p-3">
              <div className="font-black">{p.icon} {p.label}</div>
              <div className="text-xs text-slate-500 line-clamp-2 mt-1">{p.text}</div>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-violet-100'}`}>
              <Rich text={m.text} />
              {m.role === 'ai' && <div className="mt-2"><button className="text-xs font-bold text-violet-700 inline-flex items-center gap-1" onClick={() => navigator.clipboard.writeText(m.text.replace(/\*\*/g, '')).then(() => toast('Đã sao chép'))}><Copy className="w-3 h-3" /> Sao chép</button></div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm font-bold text-violet-600 flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> AI đang soạn…</div>}
        <div ref={end} />
      </div>
      <Card className="p-2 flex gap-2 items-end sticky bottom-2">
        {msgs.length > 0 && <button className="p-2.5 text-slate-400" title="Cuộc trò chuyện mới" onClick={() => setMsgs([])}><Trash2 className="w-5 h-5" /></button>}
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Nhập yêu cầu cho trợ lý AI…" className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-[15px] focus:outline-none focus:border-violet-400"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Btn variant="violet" onClick={() => send()} loading={busy} disabled={!hasKey()}><Send className="w-4 h-4" /></Btn>
      </Card>
    </div>
  );
}
