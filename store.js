import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

const APP_KEY = 'ih-open-house-live-v1';
let api = null;
let db = null;
let authUser = null;

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(APP_KEY) || '{"rooms":{}}');
  } catch {
    return { rooms: {} };
  }
}

function writeLocal(data) {
  const serialized = JSON.stringify(data);
  localStorage.setItem(APP_KEY, serialized);
  window.dispatchEvent(new StorageEvent('storage', { key: APP_KEY, newValue: serialized }));
}

function getAt(data, path) {
  return path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data);
}

function setAt(data, path, value) {
  const keys = path.split('/').filter(Boolean);
  let cursor = data;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] ||= {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

function updateAt(data, path, updates) {
  setAt(data, path, { ...(getAt(data, path) || {}), ...updates });
}

async function init() {
  if (!firebaseConfigured || api) return;

  const [{ initializeApp }, database, auth] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js'),
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
  ]);

  const app = initializeApp(firebaseConfig);
  db = database.getDatabase(app);
  const authInstance = auth.getAuth(app);
  await authInstance.authStateReady();
  authUser = authInstance.currentUser;
  if (!authUser) {
    authUser = (await auth.signInAnonymously(authInstance)).user;
  }
  api = { ...database, ...auth };
}

export const backendMode = firebaseConfigured ? 'live' : 'demo';

export async function ready() {
  if (firebaseConfigured) await init();
}

export function currentUserId() {
  return authUser?.uid || null;
}

export function serverNow() {
  return Date.now();
}

export async function getValue(path) {
  if (firebaseConfigured) {
    await init();
    return (await api.get(api.ref(db, path))).val();
  }
  return getAt(readLocal(), path);
}

export async function setValue(path, value) {
  if (firebaseConfigured) {
    await init();
    await api.set(api.ref(db, path), value);
    return;
  }
  const data = readLocal();
  setAt(data, path, value);
  writeLocal(data);
}

export async function updateValue(path, updates) {
  if (firebaseConfigured) {
    await init();
    await api.update(api.ref(db, path), updates);
    return;
  }
  const data = readLocal();
  updateAt(data, path, updates);
  writeLocal(data);
}

export async function updateMany(updates) {
  if (firebaseConfigured) {
    await init();
    await api.update(api.ref(db), updates);
    return;
  }
  const data = readLocal();
  Object.entries(updates).forEach(([path, value]) => setAt(data, path, value));
  writeLocal(data);
}

export function subscribe(path, callback) {
  if (firebaseConfigured) {
    let off = () => {};
    init().then(() => {
      off = api.onValue(api.ref(db, path), (snapshot) => callback(snapshot.val()));
    });
    return () => off();
  }

  callback(getAt(readLocal(), path));
  const handler = (event) => {
    if (event.key === APP_KEY) callback(getAt(readLocal(), path));
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
