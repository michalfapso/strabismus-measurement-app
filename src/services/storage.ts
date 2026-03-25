import { Session, CalibrationState } from '../types';

const DB_NAME = 'StrabismusMeasurementDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const CALIBRATION_STORE = 'calibration';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(SESSIONS_STORE)) {
        database.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
      }

      if (!database.objectStoreNames.contains(CALIBRATION_STORE)) {
        database.createObjectStore(CALIBRATION_STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function saveSession(session: Session): Promise<void> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([SESSIONS_STORE], 'readwrite');
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.put(session);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([SESSIONS_STORE], 'readonly');
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.get(sessionId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllSessions(): Promise<Session[]> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([SESSIONS_STORE], 'readonly');
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const sessions = request.result as Session[];
      resolve(sessions.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    };
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([SESSIONS_STORE], 'readwrite');
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.delete(sessionId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveCalibration(calibration: CalibrationState): Promise<void> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([CALIBRATION_STORE], 'readwrite');
    const store = tx.objectStore(CALIBRATION_STORE);
    const request = store.put({ ...calibration, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getCalibration(): Promise<CalibrationState | null> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([CALIBRATION_STORE], 'readonly');
    const store = tx.objectStore(CALIBRATION_STORE);
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (!request.result) {
        resolve(null);
        return;
      }
      const { id: _id, ...calibration } = request.result;
      resolve(calibration as CalibrationState);
    };
  });
}
