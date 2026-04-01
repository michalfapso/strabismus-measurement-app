import { Session, CalibrationState } from '../types';
import { ReportSnapshot } from '../types/analysis';

const DB_NAME = 'StrabismusMeasurementDB';
const DB_VERSION = 2;
const SESSIONS_STORE = 'sessions';
const CALIBRATION_STORE = 'calibration';
const REPORTS_STORE = 'reports';

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

      if (!database.objectStoreNames.contains(REPORTS_STORE)) {
        database.createObjectStore(REPORTS_STORE, { keyPath: 'reportId' });
      }
    };
  });
}

export async function saveReport(report: ReportSnapshot): Promise<void> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([REPORTS_STORE], 'readwrite');
    const store = tx.objectStore(REPORTS_STORE);
    const request = store.put(report);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getReport(reportId: string): Promise<ReportSnapshot | undefined> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([REPORTS_STORE], 'readonly');
    const store = tx.objectStore(REPORTS_STORE);
    const request = store.get(reportId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllReports(): Promise<ReportSnapshot[]> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([REPORTS_STORE], 'readonly');
    const store = tx.objectStore(REPORTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const reports = request.result as ReportSnapshot[];
      resolve(reports.sort((a, b) => b.savedAt - a.savedAt));
    };
  });
}

export async function deleteReport(reportId: string): Promise<void> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([REPORTS_STORE], 'readwrite');
    const store = tx.objectStore(REPORTS_STORE);
    const request = store.delete(reportId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
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
