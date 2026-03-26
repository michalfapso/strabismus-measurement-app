import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDB,
  saveSession,
  getSession,
  getAllSessions,
  saveCalibration,
  getCalibration
} from '../../services/storage';
import { Session, CalibrationState } from '../../types';

describe('Storage Service', () => {
  beforeEach(async () => {
    await initDB();
  });

  afterEach(async () => {
    // Clear IndexedDB after each test
    const db = await initDB();
    const tx = db.transaction(['sessions', 'calibration'], 'readwrite');
    tx.objectStore('sessions').clear();
    tx.objectStore('calibration').clear();
    await new Promise(resolve => tx.oncomplete = () => resolve(undefined));
  });

  it('should initialize database', async () => {
    const db = await initDB();
    expect(db).toBeDefined();
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    expect(db.objectStoreNames.contains('calibration')).toBe(true);
  });

  it('should save and retrieve a session', async () => {
    const session: Session = {
      sessionId: 'test-123',
      timestamp: new Date().toISOString(),
      exerciseTag: 'Pencil Push-ups',
      ppmm: 37.8,
      timeSeries: [{ t: 0, x: 0, y: 0, r: 0 }],
    };

    await saveSession(session);
    const retrieved = await getSession('test-123');

    expect(retrieved).toEqual(session);
  });

  it('should get all sessions', async () => {
    const session1: Session = {
      sessionId: 'test-1',
      timestamp: new Date().toISOString(),
      exerciseTag: 'Brock String',
      ppmm: 37.8,
      timeSeries: [],
    };
    const session2: Session = {
      sessionId: 'test-2',
      timestamp: new Date().toISOString(),
      exerciseTag: 'No Exercise/Control',
      ppmm: 37.8,
      timeSeries: [],
    };

    await saveSession(session1);
    await saveSession(session2);
    const all = await getAllSessions();

    expect(all.length).toBe(2);
    expect(all.map(s => s.sessionId)).toContain('test-1');
    expect(all.map(s => s.sessionId)).toContain('test-2');
  });

  it('should save and retrieve calibration', async () => {
    const calibration: CalibrationState = {
      ppi: 96,
      timestamp: new Date().toISOString(),
    };

    await saveCalibration(calibration);
    const retrieved = await getCalibration();

    expect(retrieved).toEqual(calibration);
  });
});
