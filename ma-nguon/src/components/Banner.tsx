import React from 'react';
import { Sparkles, BookOpen, GraduationCap, Award } from 'lucide-react';
import { CONFIG } from '../config';

export const Banner: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="w-full flex justify-center px-2 sm:px-4 pt-3 pb-2">
    <div
      className={`w-full max-w-[1280px] ${compact ? 'min-h-[120px]' : 'min-h-[170px] sm:min-h-[200px]'} rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-xl border-4 border-amber-300 text-white flex items-center justify-between px-3 sm:px-10 py-3`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.25) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(253,224,71,0.3) 0%, transparent 50%), linear-gradient(135deg, #059669 0%, #0d9488 45%, #d97706 100%)',
      }}
    >
      <div className="absolute top-2 left-6 opacity-20 pointer-events-none animate-float"><BookOpen className="w-20 h-20" /></div>
      <div className="absolute -bottom-6 right-16 opacity-20 pointer-events-none animate-float" style={{ animationDelay: '1.5s' }}><GraduationCap className="w-28 h-28 text-amber-200" /></div>
      <div className="absolute top-3 right-48 opacity-25 pointer-events-none"><Sparkles className="w-10 h-10 text-yellow-300 animate-pulse" /></div>

      <div className="hidden md:flex items-center space-x-3 z-10 select-none">
        <div className="relative">
          <div className="w-28 h-28 bg-white/20 backdrop-blur-md rounded-2xl p-2 border-2 border-white/40 shadow-lg flex flex-col items-center justify-center text-center -rotate-3 hover:rotate-0 transition-transform">
            <span className="text-4xl">🎒</span>
            <span className="text-xs font-bold text-amber-100 mt-1 uppercase tracking-wider">Học sinh</span>
            <span className="text-[10px]">Lớp 5 • Mọi thiết bị</span>
          </div>
          <div className="absolute -top-2 -right-2 bg-rose-500 text-[11px] font-black px-2 py-0.5 rounded-full shadow border border-white">10 ĐIỂM</div>
        </div>
        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-2xl p-2 border-2 border-white/40 shadow-lg flex flex-col items-center justify-center text-center rotate-3 hover:rotate-0 transition-transform">
          <span className="text-3xl">🎯</span>
          <span className="text-xs font-bold text-amber-100 mt-1 uppercase tracking-wider">Ôn đúng</span>
          <span className="text-[10px]">chỗ còn hổng</span>
        </div>
      </div>

      <div className="flex-1 text-center z-10 px-1 py-1">
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] sm:text-sm font-bold text-amber-100 border border-white/30 shadow-inner mb-2">
          <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
          <span>KẾT NỐI TRI THỨC VỚI CUỘC SỐNG • THÔNG TƯ 27/2020</span>
        </div>
        <h1 className="text-[22px] sm:text-3xl md:text-4xl lg:text-[32px] xl:text-[36px] font-black uppercase tracking-tight drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)] leading-tight">{CONFIG.appTitle}</h1>
        {!compact && <p className="text-[11px] sm:text-sm md:text-base font-semibold text-amber-100 drop-shadow mt-1">{CONFIG.appTagline}</p>}
        {CONFIG.owner && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400/90 text-slate-900 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
            <Award className="w-3.5 h-3.5 text-amber-900 shrink-0" />
            <span>Bản quyền thuộc về {CONFIG.owner} – {CONFIG.school}</span>
          </div>
        )}
      </div>

      <div className="hidden lg:flex items-center space-x-3 z-10 select-none">
        <div className="relative">
          <div className="w-28 h-28 bg-white/20 backdrop-blur-md rounded-2xl p-2 border-2 border-white/40 shadow-lg flex flex-col items-center justify-center text-center rotate-2 hover:rotate-0 transition-transform">
            <span className="text-4xl">📝</span>
            <span className="text-xs font-bold text-amber-100 mt-1 uppercase tracking-wider">Đề thi</span>
            <span className="text-[10px]">8 dạng câu hỏi</span>
          </div>
          <div className="absolute -top-2 -left-2 bg-amber-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow border border-white">HOT</div>
        </div>
        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-2xl p-2 border-2 border-white/40 shadow-lg flex flex-col items-center justify-center text-center -rotate-3 hover:rotate-0 transition-transform">
          <span className="text-3xl">⭐</span>
          <span className="text-xs font-bold text-amber-100 mt-1 uppercase tracking-wider">Trợ lý AI</span>
          <span className="text-[10px]">Soạn đề siêu tốc</span>
        </div>
      </div>
    </div>
  </div>
);

export const Footer = () => (
  <footer className="max-w-[1280px] mx-auto px-4 py-6 text-center text-xs text-slate-500 no-print">
    <div className="font-bold text-slate-600">{CONFIG.appTitle}</div>
    <div>{CONFIG.owner}{CONFIG.ownerRole ? ' – ' + CONFIG.ownerRole : ''} • {CONFIG.school}, {CONFIG.address}</div>
    <div className="mt-1">Chương trình GDPT 2018 • Bộ sách Kết nối tri thức với cuộc sống • Đánh giá theo Thông tư 27/2020/TT-BGDĐT</div>
  </footer>
);
