// Kết nối Firebase (chỉ tải khi web có cấu hình Firebase)
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, connectAuthEmulator, getRedirectResult, type User } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs, limit, type Firestore } from 'firebase/firestore';
import { CONFIG, USE_EMULATOR } from './config';

let app: FirebaseApp;
let db: Firestore;

export function init() {
  if (app) return;
  app = initializeApp(CONFIG.firebase as any);
  db = getFirestore(app);
  if (USE_EMULATOR) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  getRedirectResult(getAuth(app)).catch(() => {});
}

export function onUser(cb: (u: User | null) => void) {
  init();
  return onAuthStateChanged(getAuth(app), cb);
}

export async function googleSignIn() {
  init();
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(getAuth(app), p);
  } catch (e: any) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(getAuth(app), p);
    else if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
    else throw e;
  }
}

export async function logout() {
  init();
  await signOut(getAuth(app));
}

const ref = (path: string) => doc(db, path);

export async function fget(path: string) {
  init();
  const s = await getDoc(ref(path));
  return s.exists() ? s.data() : null;
}
export async function fset(path: string, data: any) {
  init();
  await setDoc(ref(path), data);
}
export async function fupdate(path: string, data: any) {
  init();
  await updateDoc(ref(path), data);
}
export async function fdel(path: string) {
  init();
  await deleteDoc(ref(path));
}
export async function flist(col: string, filters: [string, string, any][] = [], max = 500) {
  init();
  const q = query(collection(db, col), ...filters.map(([f, op, v]) => where(f, op as any, v)), limit(max));
  const s = await getDocs(q);
  return s.docs.map((d) => d.data());
}

// Chỉ dùng khi kiểm thử với Emulator
export async function emuSignIn(sub: string, email: string, name: string) {
  if (!USE_EMULATOR) return;
  init();
  const { signInWithCredential } = await import('firebase/auth');
  await signInWithCredential(getAuth(app), GoogleAuthProvider.credential(JSON.stringify({ sub, email, name, email_verified: true })));
}
