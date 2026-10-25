import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Camera, Check, X as XIcon, Volume2 } from 'lucide-react';
import type { Question, QResult } from '../types';
import { Rich, plain } from './Rich';
import { sameAnswer, shuffleArr } from '../grading';
import { LEVEL_SHORT } from '../curriculum';

const L = 'ABCDEFGH';

function seedOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(plain(text).replace(/\[\[\d+\]\]/g, ' chỗ trống '));
    u.lang = 'vi-VN';
    u.rate = 0.95;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('vi'));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const max = 1000;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.6);
}

export function QuestionView({ q, index, value, onChange, reveal, result, readOnly }: {
  q: Question; index: number; value: any; onChange?: (v: any) => void; reveal?: boolean; result?: QResult; readOnly?: boolean;
}) {
  const set = (v: any) => !readOnly && onChange?.(v);
  const statusCls = !reveal || !result ? '' : result.status === 'right' ? 'ring-emerald-400' : result.status === 'partial' ? 'ring-amber-400' : result.status === 'pending' ? 'ring-sky-300' : 'ring-rose-400';

  return (
    <div className={`rounded-2xl ${reveal && result ? 'ring-2 ' + statusCls : ''}`}>
      <div className="flex items-start gap-2 mb-3">
        <span className="shrink-0 inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-xl bg-orange-500 text-white font-black">{index}</span>
        <div className="flex-1 text-[17px] sm:text-lg leading-relaxed font-semibold text-slate-800">
          {q.type === 'fill' ? <FillPrompt q={q} value={value} set={set} reveal={reveal} readOnly={readOnly} /> : <Rich text={q.prompt} />}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{q.points.toLocaleString("vi-VN")} điểm • {LEVEL_SHORT[q.level]}</span>
            <button type="button" onClick={() => speak(q.prompt + '. ' + (q.options || []).map((o, i) => L[i] + '. ' + o).join('. '))} className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1 no-print">
              <Volume2 className="w-3 h-3" /> Đọc to
            </button>
          </div>
        </div>
      </div>

      {q.type === 'mcq' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((o, i) => {
            const chosen = value === i;
            const correct = reveal && q.answer === i;
            const wrong = reveal && chosen && q.answer !== i;
            return (
              <button
                type="button" key={i} onClick={() => set(i)} disabled={readOnly}
                className={`text-left flex items-start gap-3 rounded-2xl border-2 px-3 py-3 min-h-[56px] transition ${correct ? 'border-emerald-500 bg-emerald-50' : wrong ? 'border-rose-400 bg-rose-50' : chosen ? 'border-orange-500 bg-orange-50 shadow' : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'}`}
              >
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black ${chosen ? 'bg-orange-500 text-white' : correct ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}>{L[i]}</span>
                <span className="pt-1 text-[16px]"><Rich text={o} /></span>
                {correct && <Check className="ml-auto w-5 h-5 text-emerald-600 shrink-0" />}
                {wrong && <XIcon className="ml-auto w-5 h-5 text-rose-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'tf' && (
        <div className="space-y-2">
          {(q.statements || []).map((s, i) => {
            const arr: (boolean | undefined)[] = value || [];
            const pick = (v: boolean) => { const n = [...arr]; n[i] = v; set(n); };
            const exp = q.tfAnswers?.[i];
            const ok = reveal && arr[i] === exp;
            return (
              <div key={i} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 ${reveal ? (ok ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50') : 'border-slate-200 bg-white'}`}>
                <span className="font-black text-slate-500">{String.fromCharCode(97 + i)})</span>
                <span className="flex-1 text-[16px]"><Rich text={s} /></span>
                {[true, false].map((v) => (
                  <button type="button" key={String(v)} disabled={readOnly} onClick={() => pick(v)}
                    className={`w-11 h-11 rounded-xl font-black border-2 ${arr[i] === v ? (v ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white') : 'bg-white border-slate-300 text-slate-600'}`}>
                    {v ? 'Đ' : 'S'}
                  </button>
                ))}
                {reveal && !ok && <span className="text-xs font-bold text-emerald-700">→ {exp ? 'Đ' : 'S'}</span>}
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'match' && <MatchView q={q} value={value} set={set} reveal={reveal} readOnly={readOnly} />}
      {q.type === 'order' && <OrderView q={q} value={value} set={set} reveal={reveal} readOnly={readOnly} />}

      {q.type === 'short' && (
        <div>
          <input className="w-full rounded-2xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-orange-400 focus:outline-none" placeholder="Nhập câu trả lời của em…" value={value || ''} onChange={(e) => set(e.target.value)} readOnly={readOnly} />
          {reveal && (q.accepted || []).length > 0 && <div className="mt-2 text-sm font-bold text-emerald-700">Đáp án: <Rich text={(q.accepted || []).join(' hoặc ')} /></div>}
        </div>
      )}

      {q.type === 'essay' && <EssayView q={q} value={value} set={set} reveal={reveal} readOnly={readOnly} result={result} />}

      {reveal && q.explanation && (
        <div className="mt-3 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-[15px] text-sky-900">
          <b>💡 Giải thích: </b><Rich text={q.explanation} />
        </div>
      )}
      {reveal && result?.comment && (
        <div className="mt-2 rounded-2xl bg-violet-50 border border-violet-200 px-4 py-3 text-[15px] text-violet-900">
          <b>✍️ Nhận xét của cô: </b><Rich text={result.comment} />
        </div>
      )}
    </div>
  );
}

function FillPrompt({ q, value, set, reveal, readOnly }: { q: Question; value: any; set: (v: any) => void; reveal?: boolean; readOnly?: boolean }) {
  const arr: string[] = value || [];
  const parts = q.prompt.split(/(\[\[\d+\]\])/g);
  return (
    <span>
      {parts.map((p, i) => {
        const m = p.match(/^\[\[(\d+)\]\]$/);
        if (!m) return <Rich key={i} text={p} />;
        const k = +m[1];
        const exp = q.blanks?.[k] || '';
        const ok = reveal && sameAnswer(arr[k] || '', exp);
        return (
          <span key={i} className="inline-flex items-center gap-1 mx-1 align-middle">
            <input
              value={arr[k] || ''} readOnly={readOnly}
              onChange={(e) => { const n = [...arr]; n[k] = e.target.value; set(n); }}
              className={`w-28 sm:w-32 rounded-xl border-2 px-2 py-1.5 text-center font-bold text-[16px] focus:outline-none ${reveal ? (ok ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50') : 'border-orange-300 bg-orange-50/50 focus:border-orange-500'}`}
              placeholder="…" aria-label={`Chỗ trống ${k + 1}`}
            />
            {reveal && !ok && <span className="text-xs font-bold text-emerald-700">({exp.split('|')[0]})</span>}
          </span>
        );
      })}
    </span>
  );
}

function MatchView({ q, value, set, reveal, readOnly }: { q: Question; value: any; set: (v: any) => void; reveal?: boolean; readOnly?: boolean }) {
  const pairs = q.pairs || [];
  const order = useMemo(() => shuffleArr(pairs.map((_, i) => i), seedOf(q.id)), [q.id, pairs.length]);
  const arr: (number | undefined)[] = value || [];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        {pairs.map((p, i) => {
          const ok = reveal && arr[i] === i;
          return (
            <div key={i} className={`rounded-2xl border-2 p-2.5 ${reveal ? (ok ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50') : 'border-slate-200 bg-white'}`}>
              <div className="font-bold mb-1.5 text-[15px]">{i + 1}. <Rich text={p[0]} /></div>
              <select disabled={readOnly} value={arr[i] ?? ''} onChange={(e) => { const n = [...arr]; n[i] = e.target.value === '' ? undefined : +e.target.value; set(n); }}
                className="w-full rounded-xl border-2 border-orange-200 bg-orange-50/50 px-2 py-2 text-[15px] font-semibold">
                <option value="">— Chọn ý nối —</option>
                {order.map((j, k) => <option key={j} value={j}>{String.fromCharCode(97 + k)}) {plain(pairs[j][1])}</option>)}
              </select>
              {reveal && !ok && <div className="text-xs font-bold text-emerald-700 mt-1">Đúng: <Rich text={p[1]} /></div>}
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-3 h-fit">
        <div className="text-xs font-black text-amber-800 mb-1">CÁC Ý Ở CỘT B</div>
        {order.map((j, k) => <div key={j} className="py-1 text-[15px]"><b>{String.fromCharCode(97 + k)})</b> <Rich text={pairs[j][1]} /></div>)}
      </div>
    </div>
  );
}

function OrderView({ q, value, set, reveal, readOnly }: { q: Question; value: any; set: (v: any) => void; reveal?: boolean; readOnly?: boolean }) {
  const items = q.items || [];
  const initial = useMemo(() => {
    let s = shuffleArr(items, seedOf(q.id));
    if (s.every((x, i) => x === items[i]) && s.length > 1) s = [...s.slice(1), s[0]];
    return s;
  }, [q.id, items.length]);
  const arr: string[] = value && value.length === items.length ? value : initial;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const n = [...arr];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-slate-500">Dùng nút ▲ ▼ để sắp xếp đúng thứ tự.</div>
      {arr.map((it, i) => (
        <div key={it + i} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 ${reveal ? (items[i] === it ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50') : 'border-slate-200 bg-white'}`}>
          <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-black flex items-center justify-center">{i + 1}</span>
          <span className="flex-1 text-[16px]"><Rich text={it} /></span>
          {!readOnly && (
            <>
              <button type="button" onClick={() => move(i, -1)} className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center active:bg-orange-100" aria-label="Lên"><ArrowUp className="w-5 h-5" /></button>
              <button type="button" onClick={() => move(i, 1)} className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center active:bg-orange-100" aria-label="Xuống"><ArrowDown className="w-5 h-5" /></button>
            </>
          )}
        </div>
      ))}
      {reveal && <div className="text-sm text-emerald-700 font-bold">Thứ tự đúng: {items.map((x, i) => `${i + 1}. ${plain(x)}`).join('  →  ')}</div>}
    </div>
  );
}

function EssayView({ q, value, set, reveal, readOnly, result }: { q: Question; value: any; set: (v: any) => void; reveal?: boolean; readOnly?: boolean; result?: QResult }) {
  const v = typeof value === 'object' && value ? value : { text: value || '', img: '' };
  return (
    <div>
      <textarea
        value={v.text || ''} readOnly={readOnly}
        onChange={(e) => set({ ...v, text: e.target.value })}
        rows={q.points >= 3 ? 10 : 4}
        className="w-full rounded-2xl border-2 border-slate-300 px-4 py-3 text-[16px] leading-relaxed focus:border-orange-400 focus:outline-none"
        placeholder="Em viết bài làm vào đây… (có thể chụp ảnh bài làm trên giấy ở nút bên dưới)"
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {!readOnly && (
          <label className="inline-flex items-center gap-1.5 rounded-xl border-2 border-sky-200 bg-sky-50 text-sky-800 font-bold text-sm px-3 py-2 cursor-pointer">
            <Camera className="w-4 h-4" /> {v.img ? 'Chụp lại ảnh' : 'Chụp ảnh bài làm'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) set({ ...v, img: await compressImage(f) });
            }} />
          </label>
        )}
        <span className="text-xs text-slate-500">{(v.text || '').trim().split(/\s+/).filter(Boolean).length} chữ</span>
      </div>
      {v.img && <img src={v.img} alt="Ảnh bài làm" className="mt-2 max-h-80 rounded-xl border" />}
      {reveal && result?.status === 'pending' && <div className="mt-2 text-sm font-bold text-sky-700">⏳ Câu tự luận – cô giáo sẽ chấm và nhận xét.</div>}
      {reveal && q.guide && result?.status !== 'pending' && <div className="mt-2 text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3 border border-emerald-200"><b>Gợi ý đáp án: </b><Rich text={q.guide} /></div>}
    </div>
  );
}
