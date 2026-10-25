export interface AppConfig {
  appTitle: string;
  appTagline: string;
  owner: string;
  ownerEmail: string;
  ownerRole: string;
  school: string;
  address: string;
  grade: number;
  firebase: Record<string, string> | null;
}

const w = window as any;
export const CONFIG: AppConfig = {
  appTitle: 'HỆ THỐNG ĐỀ KIỂM TRA & ÔN TẬP LỚP 5',
  appTagline: '',
  owner: '',
  ownerEmail: '',
  ownerRole: '',
  school: '',
  address: '',
  grade: 5,
  firebase: null,
  ...(w.APP_CONFIG || {}),
};

// Dùng cho kiểm thử với Firebase Emulator: ?emu=1
export const USE_EMULATOR = (() => { try { if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false; return new URL(location.href).searchParams.get('emu') === '1' || localStorage.getItem('kt5_emu') === '1'; } catch { return false; } })();
