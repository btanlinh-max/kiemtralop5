import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Modal({ open, onClose, title, children, wide, full, footer }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean; full?: boolean; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white w-full ${full ? 'sm:max-w-6xl h-[96vh]' : wide ? 'sm:max-w-4xl max-h-[94vh]' : 'sm:max-w-lg max-h-[92vh]'} rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-4 border-amber-200`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 text-white">
          <div className="font-extrabold text-base sm:text-lg leading-tight">{title}</div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20" aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {footer && <div className="border-t bg-amber-50/60 px-4 sm:px-6 py-3 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'orange' | 'blue' | 'ghost' | 'danger' | 'white' | 'violet'; loading?: boolean; small?: boolean };
export function Btn({ variant = 'primary', loading, small, className = '', children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
    violet: 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200',
    ghost: 'bg-white hover:bg-amber-50 text-slate-700 border border-slate-200',
    white: 'bg-white hover:bg-orange-50 text-orange-700 border border-orange-200',
    danger: 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200',
  }[variant];
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-extrabold rounded-xl shadow-sm transition active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed ${small ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${v} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="block">
      <div className="block text-xs font-bold text-slate-600 mb-1">{label}</div>
      {children}
      {hint && <div className="block text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border-2 border-amber-100 shadow-sm ${className}`}>{children}</div>;
}

export function Empty({ icon = '📭', title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-5xl mb-2">{icon}</div>
      <div className="font-extrabold text-slate-700">{title}</div>
      {children && <div className="text-sm text-slate-500 mt-1">{children}</div>}
    </div>
  );
}

// ---- Thông báo nhỏ ----
let pushToast: (m: string, kind?: 'ok' | 'err' | 'info') => void = () => {};
export const toast = (m: string, kind: 'ok' | 'err' | 'info' = 'ok') => pushToast(m, kind);

export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string; kind: string }[]>([]);
  useEffect(() => {
    pushToast = (m, kind = 'ok') => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, m, kind }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 7000 : 3500);
    };
  }, []);
  return (
    <div className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[92vw] max-w-md no-print">
      {items.map((t) => (
        <div key={t.id} className={`rounded-2xl px-4 py-3 shadow-xl font-bold text-sm border-2 ${t.kind === 'err' ? 'bg-rose-50 text-rose-800 border-rose-200' : t.kind === 'info' ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
          {t.m}
        </div>
      ))}
    </div>
  );
}

export function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 70 ? 'bg-lime-500' : value >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className={`h-2.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: Math.max(2, Math.min(100, value)) + '%' }} />
    </div>
  );
}

export function confirmDo(msg: string) {
  return window.confirm(msg);
}
