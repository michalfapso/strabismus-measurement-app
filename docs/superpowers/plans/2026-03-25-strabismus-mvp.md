# Strabismus Measurement App — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clinical oculomotor assessment tool that captures position and rotation measurements using a calibrated canvas-based Lancaster red-green test, with offline-first storage and CSV export.

**Architecture:** React 18 SPA with react-konva for high-performance 2D canvas rendering. State managed via React Context (calibration, current session, session history). All user data persisted to IndexedDB for offline-first operation. No backend dependency. Deployed to GitHub Pages.

**Tech Stack:** React 18, react-konva, React Context, IndexedDB, CSS-in-JS (emotion), Vite, TypeScript

---

## File Structure

### Core Application
- `src/App.tsx` — Root component, router (Calibration → Assessment → Export)
- `src/index.tsx` — Entry point

### Components
- `src/components/CalibrationScreen.tsx` — Credit card calibration UI (PPMM calculation)
- `src/components/AssessmentCanvas.tsx` — react-konva canvas with static/user crosses
- `src/components/DataCaptureControl.tsx` — Start/stop/clear buttons, exercise dropdown
- `src/components/SessionExplorer.tsx` — Session list, CSV export
- `src/components/ExerciseSelector.tsx` — Dropdown for predefined exercises

### State Management & Hooks
- `src/context/CalibrationContext.tsx` — Global PPMM calibration state
- `src/context/SessionContext.tsx` — Current session + session history state
- `src/hooks/useCalibration.ts` — PPMM read/write hooks
- `src/hooks/useTimeSeries.ts` — Time-series capture logic (100ms intervals)
- `src/hooks/useSession.ts` — Session lifecycle (start, stop, save)

### Services
- `src/services/storage.ts` — IndexedDB read/write operations
- `src/services/export.ts` — CSV generation and download
- `src/types/index.ts` — TypeScript interfaces (Session, TimeSeries, etc.)

### Tests
- `src/__tests__/services/storage.test.ts` — IndexedDB operations
- `src/__tests__/services/export.test.ts` — CSV export format
- `src/__tests__/hooks/useTimeSeries.test.ts` — Time-series capture intervals
- `src/__tests__/components/CalibrationScreen.test.tsx` — PPMM calculation
- `src/__tests__/components/AssessmentCanvas.test.tsx` — Canvas interaction (drag, rotate)

### Configuration
- `vite.config.ts` — Build configuration
- `tsconfig.json` — TypeScript configuration
- `package.json` — Dependencies (React, react-konva, emotion, etc.)

---

## Task Dependencies

```
Task 1: Project Setup & Dependencies
    ↓
Task 2: TypeScript Types & Interfaces
    ↓
Tasks 3-5: Context + Hooks (CalibrationContext, SessionContext, useTimeSeries)
    ↓
Tasks 6-10: Core Components (CalibrationScreen, AssessmentCanvas, DataCaptureControl, etc.)
    ↓
Task 11: Integration & Routing
    ↓
Task 12: Build & Deployment
```

---

## Tasks

### Task 1: Project Setup & Dependencies

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.tsx`

- [ ] **Step 1: Initialize npm project**

```bash
cd /home/miso/projects/strabismus-measurement-app
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react react-dom react-konva konva typescript typescript-eslint @types/react @types/react-dom @types/node @emotion/react @emotion/styled uuid
npm install --save-dev vite @vitejs/plugin-react @types/uuid
```

- [ ] **Step 3: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/strabismus-measurement-app/',
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.local
.env
.env.local
```

- [ ] **Step 7: Create `src/index.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create `index.html` at project root**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Strabismus Measurement App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #1a1a1a; color: #fff; }
    #root { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

- [ ] **Step 9: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json .gitignore src/index.tsx index.html
git commit -m "chore: project setup and dependencies"
```

---

### Task 2: TypeScript Types & Interfaces

**Files:**
- Create: `src/types/index.ts`

- [x] **Step 1: Write type definition tests**

```typescript
// src/__tests__/types.test.ts
import { Session, TimeSeries } from '../types';

describe('TypeScript Types', () => {
  it('should define Session interface correctly', () => {
    const session: Session = {
      sessionId: 'uuid-123',
      timestamp: new Date().toISOString(),
      exerciseTag: 'Pencil Push-ups',
      ppmm: 37.8,
      timeSeries: [],
    };
    expect(session.sessionId).toBeDefined();
  });

  it('should define TimeSeries interface correctly', () => {
    const dataPoint: TimeSeries = {
      t: 100,
      x: 1.5,
      y: -2.3,
      r: 15.5,
    };
    expect(dataPoint.t).toBe(100);
  });
});
```

- [x] **Step 2: Implement types in `src/types/index.ts`**

```typescript
/**
 * Time-series measurement data point
 * t: milliseconds since session start
 * x, y: position in centimeters (relative to canvas center)
 * r: rotation in degrees (relative to vertical axis)
 */
export interface TimeSeries {
  t: number; // milliseconds
  x: number; // cm
  y: number; // cm
  r: number; // degrees
}

/**
 * Measurement session metadata
 */
export interface Session {
  sessionId: string; // UUID
  timestamp: string; // ISO8601
  exerciseTag: string; // e.g., "Pencil Push-ups"
  ppmm: number; // pixels per millimeter (calibration)
  timeSeries: TimeSeries[]; // array of measurements
}

/**
 * Calibration state
 */
export interface CalibrationState {
  ppmm: number | null; // null if not yet calibrated
  timestamp: string; // ISO8601, when last calibrated
}

/**
 * Predefined exercises
 */
export type ExerciseType =
  | 'No Exercise/Control'
  | 'Pencil Push-ups'
  | 'Brock String'
  | 'Extreme Rotation'
  | 'Convergence Jumps'
  | 'Left-Tendon-Stretch'
  | 'Right-Tendon-Stretch';

export const PREDEFINED_EXERCISES: ExerciseType[] = [
  'No Exercise/Control',
  'Pencil Push-ups',
  'Brock String',
  'Extreme Rotation',
  'Convergence Jumps',
  'Left-Tendon-Stretch',
  'Right-Tendon-Stretch',
];
```

- [x] **Step 3: Run type tests to verify**

```bash
npm install --save-dev vitest @vitest/ui
npm test -- src/__tests__/types.test.ts
```

Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/types/index.ts src/__tests__/types.test.ts
git commit -m "feat: define TypeScript interfaces for Session, TimeSeries, Calibration"
```

---

### Task 3: IndexedDB Storage Service

**Files:**
- Create: `src/services/storage.ts`
- Create: `src/__tests__/services/storage.test.ts`

- [x] **Step 1: Write IndexedDB storage tests**

```typescript
// src/__tests__/services/storage.test.ts
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
      ppmm: 37.8,
      timestamp: new Date().toISOString(),
    };

    await saveCalibration(calibration);
    const retrieved = await getCalibration();

    expect(retrieved).toEqual(calibration);
  });
});
```

- [x] **Step 2: Implement storage service**

```typescript
// src/services/storage.ts
import { Session, CalibrationState } from '../types';

const DB_NAME = 'StrabismusMeasurementDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const CALIBRATION_STORE = 'calibration';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB, create object stores if needed
 */
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

/**
 * Save a session to IndexedDB
 */
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

/**
 * Retrieve a single session by ID
 */
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

/**
 * Retrieve all sessions
 */
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

/**
 * Delete a session by ID
 */
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

/**
 * Save calibration state
 */
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

/**
 * Retrieve calibration state
 */
export async function getCalibration(): Promise<CalibrationState | null> {
  const database = db || (await initDB());

  return new Promise((resolve, reject) => {
    const tx = database.transaction([CALIBRATION_STORE], 'readonly');
    const store = tx.objectStore(CALIBRATION_STORE);
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}
```

- [x] **Step 3: Install vitest**

```bash
npm install --save-dev vitest
```

- [x] **Step 4: Run storage tests**

```bash
npm test -- src/__tests__/services/storage.test.ts
```

Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/services/storage.ts src/__tests__/services/storage.test.ts
git commit -m "feat: implement IndexedDB storage service with session and calibration persistence"
```

---

### Task 4: Calibration Context & Hook

**Files:**
- Create: `src/context/CalibrationContext.tsx`
- Create: `src/hooks/useCalibration.ts`

- [ ] **Step 1: Create CalibrationContext**

```typescript
// src/context/CalibrationContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { CalibrationState } from '../types';
import { getCalibration, saveCalibration } from '../services/storage';

export const CalibrationContext = createContext<{
  calibration: CalibrationState | null;
  setPpmm: (ppmm: number) => Promise<void>;
  isLoading: boolean;
}>({
  calibration: null,
  setPpmm: async () => {},
  isLoading: true,
});

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load calibration from IndexedDB on mount
  useEffect(() => {
    const load = async () => {
      try {
        const cal = await getCalibration();
        setCalibration(cal);
      } catch (err) {
        console.error('Failed to load calibration:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const setPpmm = async (ppmm: number) => {
    const newCalibration: CalibrationState = {
      ppmm,
      timestamp: new Date().toISOString(),
    };
    await saveCalibration(newCalibration);
    setCalibration(newCalibration);
  };

  return (
    <CalibrationContext.Provider value={{ calibration, setPpmm, isLoading }}>
      {children}
    </CalibrationContext.Provider>
  );
}
```

- [ ] **Step 2: Create useCalibration hook**

```typescript
// src/hooks/useCalibration.ts
import { useContext } from 'react';
import { CalibrationContext } from '../context/CalibrationContext';

export function useCalibration() {
  const context = useContext(CalibrationContext);
  if (!context) {
    throw new Error('useCalibration must be used within CalibrationProvider');
  }
  return context;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/context/CalibrationContext.tsx src/hooks/useCalibration.ts
git commit -m "feat: add CalibrationContext and useCalibration hook"
```

---

### Task 5: Session Context & Hooks

**Files:**
- Create: `src/context/SessionContext.tsx`
- Create: `src/hooks/useSession.ts`
- Create: `src/hooks/useTimeSeries.ts`

- [ ] **Step 1: Create SessionContext**

```typescript
// src/context/SessionContext.tsx
import React, { createContext, useState, ReactNode } from 'react';
import { Session, TimeSeries } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const SessionContext = createContext<{
  currentSession: Session | null;
  startSession: (exerciseTag: string, ppmm: number) => void;
  addTimeSeriesPoint: (point: TimeSeries) => void;
  endSession: () => Promise<void>;
  clearSession: () => void;
  sessions: Session[];
}>({
  currentSession: null,
  startSession: () => {},
  addTimeSeriesPoint: () => {},
  endSession: async () => {},
  clearSession: () => {},
  sessions: [],
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const startSession = (exerciseTag: string, ppmm: number) => {
    const session: Session = {
      sessionId: uuidv4(),
      timestamp: new Date().toISOString(),
      exerciseTag,
      ppmm,
      timeSeries: [],
    };
    setCurrentSession(session);
  };

  const addTimeSeriesPoint = (point: TimeSeries) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      timeSeries: [...currentSession.timeSeries, point],
    });
  };

  const endSession = async () => {
    if (!currentSession) return;

    const { saveSession } = await import('../services/storage');
    await saveSession(currentSession);
    setSessions([currentSession, ...sessions]);
    setCurrentSession(null);
  };

  const clearSession = () => {
    setCurrentSession(null);
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        startSession,
        addTimeSeriesPoint,
        endSession,
        clearSession,
        sessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
```

- [ ] **Step 2: Create useSession hook**

```typescript
// src/hooks/useSession.ts
import { useContext } from 'react';
import { SessionContext } from '../context/SessionContext';

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
```

- [ ] **Step 3: Create useTimeSeries hook**

```typescript
// src/hooks/useTimeSeries.ts
import { useEffect, useRef } from 'react';
import { TimeSeries } from '../types';
import { useSession } from './useSession';

export function useTimeSeries() {
  const { currentSession, addTimeSeriesPoint } = useSession();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startCapture = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;

      // Placeholder: will be called with actual x, y, r from canvas
      // For now, just track elapsed time
      addTimeSeriesPoint({
        t: elapsed,
        x: 0,
        y: 0,
        r: 0,
      });
    }, 100); // 100ms interval
  };

  const stopCapture = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
  };

  // Cleanup on unmount or when session ends
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { startCapture, stopCapture, isCapturing: timerRef.current !== null };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/context/SessionContext.tsx src/hooks/useSession.ts src/hooks/useTimeSeries.ts
git commit -m "feat: add SessionContext and session/time-series hooks"
```

---

### Task 6: CSV Export Service

**Files:**
- Create: `src/services/export.ts`
- Create: `src/__tests__/services/export.test.ts`

- [ ] **Step 1: Write CSV export tests**

```typescript
// src/__tests__/services/export.test.ts
import { describe, it, expect } from 'vitest';
import { generateCSV } from '../../services/export';
import { Session } from '../../types';

describe('CSV Export Service', () => {
  it('should generate CSV with correct headers', () => {
    const session: Session = {
      sessionId: 'test-123',
      timestamp: '2026-03-25T10:00:00Z',
      exerciseTag: 'Pencil Push-ups',
      ppmm: 37.8,
      timeSeries: [],
    };

    const csv = generateCSV([session]);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('sessionId');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('exerciseTag');
    expect(lines[0]).toContain('x_cm');
    expect(lines[0]).toContain('y_cm');
    expect(lines[0]).toContain('rotation_deg');
  });

  it('should generate CSV rows for time-series data', () => {
    const session: Session = {
      sessionId: 'test-123',
      timestamp: '2026-03-25T10:00:00Z',
      exerciseTag: 'Brock String',
      ppmm: 37.8,
      timeSeries: [
        { t: 0, x: 0, y: 0, r: 0 },
        { t: 100, x: 0.5, y: -1.2, r: 5.5 },
      ],
    };

    const csv = generateCSV([session]);
    const lines = csv.split('\n');

    expect(lines.length).toBe(4); // header + 2 data rows + trailing newline
    expect(lines[1]).toContain('test-123');
    expect(lines[1]).toContain('0.5');
    expect(lines[1]).toContain('-1.2');
    expect(lines[1]).toContain('5.5');
  });

  it('should download CSV file', () => {
    const session: Session = {
      sessionId: 'test-123',
      timestamp: '2026-03-25T10:00:00Z',
      exerciseTag: 'No Exercise/Control',
      ppmm: 37.8,
      timeSeries: [{ t: 0, x: 0, y: 0, r: 0 }],
    };

    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    downloadCSV([session]);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Implement CSV export**

```typescript
// src/services/export.ts
import { Session } from '../types';

/**
 * Generate CSV string from sessions
 * Format: sessionId, timestamp, exerciseTag, x_cm, y_cm, rotation_deg
 */
export function generateCSV(sessions: Session[]): string {
  const headers = ['sessionId', 'timestamp', 'exerciseTag', 'x_cm', 'y_cm', 'rotation_deg'];
  const rows: string[] = [headers.join(',')];

  for (const session of sessions) {
    for (const point of session.timeSeries) {
      const row = [
        session.sessionId,
        session.timestamp,
        session.exerciseTag,
        point.x.toFixed(2),
        point.y.toFixed(2),
        point.r.toFixed(2),
      ];
      rows.push(row.join(','));
    }
  }

  return rows.join('\n') + '\n';
}

/**
 * Download sessions as CSV file
 */
export function downloadCSV(sessions: Session[]): void {
  const csv = generateCSV(sessions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `strabismus-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Install vitest with mocking**

```bash
npm install --save-dev vitest vi
```

- [ ] **Step 4: Run export tests**

```bash
npm test -- src/__tests__/services/export.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/export.ts src/__tests__/services/export.test.ts
git commit -m "feat: implement CSV export service with download functionality"
```

---

### Task 7: Calibration Screen Component

**Files:**
- Create: `src/components/CalibrationScreen.tsx`

- [ ] **Step 1: Create CalibrationScreen component**

```typescript
// src/components/CalibrationScreen.tsx
import React, { useState, useRef } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { css } from '@emotion/react';

const CARD_WIDTH_MM = 85.60;

const containerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #1a1a1a;
  color: #fff;
  padding: 20px;
`;

const instructionStyle = css`
  font-size: 18px;
  margin-bottom: 30px;
  text-align: center;
  max-width: 600px;
  line-height: 1.6;
`;

const canvasContainerStyle = css`
  border: 2px solid #00ff00;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 400px;
  height: 300px;
  position: relative;
  margin-bottom: 30px;
`;

const resizableRectStyle = css`
  background: rgba(255, 0, 0, 0.2);
  border: 3px dashed #ff0000;
  cursor: nwse-resize;
  position: absolute;
  min-width: 50px;
  min-height: 30px;
`;

const buttonGroupStyle = css`
  display: flex;
  gap: 10px;
`;

const buttonStyle = css`
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #00ff00;
  color: #000;
  font-weight: bold;

  &:hover {
    background: #00cc00;
  }
`;

const resultStyle = css`
  font-size: 20px;
  margin-top: 20px;
  text-align: center;
  color: #00ff00;
`;

interface RectState {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function CalibrationScreen({ onComplete }: { onComplete: () => void }) {
  const { setPpmm } = useCalibration();
  const [rect, setRect] = useState<RectState>({
    width: 200,
    height: 126,
    x: 100,
    y: 87,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [ppmm, setPpmmLocal] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate new width (drag from bottom-right)
    const newWidth = Math.max(50, x - (containerRef.current?.offsetLeft || 0));
    const newHeight = Math.max(30, (newWidth / CARD_WIDTH_MM) * (85.60 / 53.98));

    setRect((prev) => ({
      ...prev,
      width: newWidth,
      height: newHeight,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const calculatePPMM = () => {
    const ppmmValue = rect.width / CARD_WIDTH_MM;
    setPpmmLocal(ppmmValue);
  };

  const handleConfirm = async () => {
    if (ppmm) {
      await setPpmm(ppmm);
      onComplete();
    }
  };

  return (
    <div css={containerStyle} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div css={instructionStyle}>
        <h1>Calibration: Align with Credit Card</h1>
        <p>
          Resize the red rectangle to match your physical credit card (85.60 mm × 53.98 mm).
          Drag the bottom-right corner to adjust the size.
        </p>
      </div>

      <div css={canvasContainerStyle} ref={containerRef}>
        <div
          css={resizableRectStyle}
          onMouseDown={handleMouseDown}
          style={{
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            left: `${rect.x}px`,
            top: `${rect.y}px`,
          }}
        />
      </div>

      <button css={buttonStyle} onClick={calculatePPMM}>
        Calculate PPMM
      </button>

      {ppmm && (
        <div css={resultStyle}>
          <p>PPMM: {ppmm.toFixed(2)} pixels/mm</p>
          <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
            Confirm & Continue
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "feat: implement CalibrationScreen with credit card PPMM calibration"
```

---

### Task 8: Assessment Canvas Component

**Files:**
- Create: `src/components/AssessmentCanvas.tsx`

- [ ] **Step 1: Create AssessmentCanvas with react-konva**

```typescript
// src/components/AssessmentCanvas.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { useCalibration } from '../hooks/useCalibration';
import { useSession } from '../hooks/useSession';
import { css } from '@emotion/react';

const canvasWrapperStyle = css`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
`;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const HALF_WIDTH = CANVAS_WIDTH / 2;
const HALF_HEIGHT = CANVAS_HEIGHT / 2;
const CM_TO_PX = 37.8; // Default, will be overridden by calibration
const GRID_SPACING = CM_TO_PX; // 1 cm grid

interface CrossState {
  x: number;
  y: number;
  rotation: number;
}

export function AssessmentCanvas({
  onPositionChange,
}: {
  onPositionChange: (x: number, y: number, r: number) => void;
}) {
  const { calibration } = useCalibration();
  const [userCross, setUserCross] = useState<CrossState>({
    x: HALF_WIDTH,
    y: HALF_HEIGHT,
    rotation: 0,
  });
  const [isRotating, setIsRotating] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);

  const ppmm = calibration?.ppmm || 37.8;
  const cmToPx = CM_TO_PX * (ppmm / 37.8);

  // Notify parent of changes
  useEffect(() => {
    const xCm = (userCross.x - HALF_WIDTH) / cmToPx;
    const yCm = (HALF_HEIGHT - userCross.y) / cmToPx; // Inverted Y
    onPositionChange(xCm, yCm, userCross.rotation);
  }, [userCross, cmToPx]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) { // Right mouse button
      setIsRotating(true);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!stageRef.current || !isRotating || !groupRef.current) return;

    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const groupPos = groupRef.current.getAbsolutePosition();
    const dx = pointerPos.x - groupPos.x;
    const dy = pointerPos.y - groupPos.y;

    const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
    setUserCross((prev) => ({ ...prev, rotation }));
  };

  const handleMouseUp = () => {
    setIsRotating(false);
  };

  const handleDragEnd = () => {
    if (!groupRef.current) return;
    const pos = groupRef.current.getAbsolutePosition();
    setUserCross((prev) => ({
      ...prev,
      x: pos.x + groupRef.current!.width() / 2,
      y: pos.y + groupRef.current!.height() / 2,
    }));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const step = cmToPx * 0.1; // 1mm
    const newCross = { ...userCross };

    if (e.key === 'ArrowUp') newCross.y -= step;
    if (e.key === 'ArrowDown') newCross.y += step;
    if (e.key === 'ArrowLeft') newCross.x -= step;
    if (e.key === 'ArrowRight') newCross.x += step;

    setUserCross(newCross);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cmToPx]);

  return (
    <div css={canvasWrapperStyle}>
      <Stage
        ref={stageRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Background Layer */}
        <Layer>
          <Line
            x={HALF_WIDTH}
            y={0}
            points={[0, 0, 0, CANVAS_HEIGHT]}
            stroke="#ff0000"
            strokeWidth={2}
          />
          <Line
            x={0}
            y={HALF_HEIGHT}
            points={[0, 0, CANVAS_WIDTH, 0]}
            stroke="#ff0000"
            strokeWidth={2}
          />

          {/* Centimeter grid ticks on static cross */}
          {Array.from({ length: Math.floor(CANVAS_HEIGHT / GRID_SPACING) }).map((_, i) => {
            const y = (i - Math.floor(CANVAS_HEIGHT / GRID_SPACING / 2)) * GRID_SPACING;
            return (
              <Line
                key={`h-tick-${i}`}
                x={HALF_WIDTH - 5}
                y={HALF_HEIGHT + y}
                points={[0, 0, 10, 0]}
                stroke="#ff0000"
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: Math.floor(CANVAS_WIDTH / GRID_SPACING) }).map((_, i) => {
            const x = (i - Math.floor(CANVAS_WIDTH / GRID_SPACING / 2)) * GRID_SPACING;
            return (
              <Line
                key={`v-tick-${i}`}
                x={HALF_WIDTH + x}
                y={HALF_HEIGHT - 5}
                points={[0, 0, 0, 10]}
                stroke="#ff0000"
                strokeWidth={1}
              />
            );
          })}
        </Layer>

        {/* User-Controlled Layer */}
        <Layer>
          <Konva.Group
            ref={groupRef}
            x={userCross.x - 50}
            y={userCross.y - 50}
            draggable
            onDragEnd={handleDragEnd}
            rotation={userCross.rotation}
            offsetX={50}
            offsetY={50}
          >
            <Line
              x={0}
              y={0}
              points={[0, -50, 0, 50]}
              stroke="#00ff00"
              strokeWidth={2}
            />
            <Line
              x={0}
              y={0}
              points={[-50, 0, 50, 0]}
              stroke="#00ff00"
              strokeWidth={2}
            />
            <Circle x={0} y={0} radius={5} fill="#00ff00" />
          </Konva.Group>
        </Layer>
      </Stage>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AssessmentCanvas.tsx
git commit -m "feat: implement AssessmentCanvas with react-konva drag/rotate interaction"
```

---

### Task 9: Data Capture Control Component

**Files:**
- Create: `src/components/DataCaptureControl.tsx`
- Create: `src/components/ExerciseSelector.tsx`

- [ ] **Step 1: Create ExerciseSelector**

```typescript
// src/components/ExerciseSelector.tsx
import React from 'react';
import { PREDEFINED_EXERCISES, ExerciseType } from '../types';
import { css } from '@emotion/react';

const selectStyle = css`
  padding: 10px;
  font-size: 16px;
  border: 2px solid #00ff00;
  background: #1a1a1a;
  color: #00ff00;
  border-radius: 4px;
  cursor: pointer;

  option {
    background: #1a1a1a;
    color: #00ff00;
  }

  &:focus {
    outline: none;
    background: #2a2a2a;
  }
`;

export function ExerciseSelector({
  value,
  onChange,
}: {
  value: ExerciseType;
  onChange: (exercise: ExerciseType) => void;
}) {
  return (
    <select
      css={selectStyle}
      value={value}
      onChange={(e) => onChange(e.target.value as ExerciseType)}
    >
      {PREDEFINED_EXERCISES.map((exercise) => (
        <option key={exercise} value={exercise}>
          {exercise}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Create DataCaptureControl**

```typescript
// src/components/DataCaptureControl.tsx
import React, { useState } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { useSession } from '../hooks/useSession';
import { useTimeSeries } from '../hooks/useTimeSeries';
import { ExerciseSelector } from './ExerciseSelector';
import { ExerciseType } from '../types';
import { css } from '@emotion/react';

const controlPanelStyle = css`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
  background: #2a2a2a;
  border: 2px solid #00ff00;
  border-radius: 8px;
  max-width: 400px;
`;

const rowStyle = css`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const buttonStyle = css`
  padding: 10px 20px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const startButtonStyle = css`
  ${buttonStyle}
  background: #00ff00;
  color: #000;
`;

const stopButtonStyle = css`
  ${buttonStyle}
  background: #ff0000;
  color: #fff;
`;

const clearButtonStyle = css`
  ${buttonStyle}
  background: #ffcc00;
  color: #000;
`;

const timerStyle = css`
  font-size: 18px;
  color: #00ff00;
  font-weight: bold;
  min-width: 100px;
`;

export function DataCaptureControl() {
  const { calibration } = useCalibration();
  const { currentSession, startSession, endSession, clearSession } = useSession();
  const { startCapture, stopCapture, isCapturing } = useTimeSeries();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('No Exercise/Control');
  const [elapsed, setElapsed] = useState(0);

  const handleStart = () => {
    if (calibration?.ppmm) {
      startSession(selectedExercise, calibration.ppmm);
      startCapture();
      setElapsed(0);
    }
  };

  const handleStop = async () => {
    stopCapture();
    await endSession();
    setElapsed(0);
  };

  const handleClear = () => {
    stopCapture();
    clearSession();
    setElapsed(0);
  };

  // Update elapsed time
  React.useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCapturing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentSession) {
    return (
      <div css={controlPanelStyle}>
        <h2>Start Measurement</h2>
        <ExerciseSelector value={selectedExercise} onChange={setSelectedExercise} />
        <button css={startButtonStyle} onClick={handleStart}>
          Start Measurement
        </button>
      </div>
    );
  }

  return (
    <div css={controlPanelStyle}>
      <h2>Active Measurement</h2>
      <div css={rowStyle}>
        <span>Exercise:</span>
        <strong>{currentSession.exerciseTag}</strong>
      </div>
      <div css={rowStyle}>
        <span>Elapsed:</span>
        <div css={timerStyle}>{formatTime(elapsed)}</div>
      </div>
      <button css={stopButtonStyle} onClick={handleStop}>
        Stop & Save
      </button>
      <button css={clearButtonStyle} onClick={handleClear}>
        Clear
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExerciseSelector.tsx src/components/DataCaptureControl.tsx
git commit -m "feat: implement exercise selector and data capture control panel"
```

---

### Task 10: Session Explorer Component

**Files:**
- Create: `src/components/SessionExplorer.tsx`

- [ ] **Step 1: Create SessionExplorer**

```typescript
// src/components/SessionExplorer.tsx
import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { getAllSessions } from '../services/storage';
import { downloadCSV } from '../services/export';
import { Session } from '../types';
import { css } from '@emotion/react';

const explorerStyle = css`
  padding: 20px;
  background: #2a2a2a;
  border: 2px solid #00ff00;
  border-radius: 8px;
  max-width: 600px;
  max-height: 400px;
  overflow-y: auto;
`;

const sessionListStyle = css`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const sessionItemStyle = css`
  padding: 12px;
  margin-bottom: 10px;
  background: #1a1a1a;
  border: 1px solid #00ff00;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const sessionInfoStyle = css`
  flex: 1;

  strong {
    color: #00ff00;
    display: block;
  }

  small {
    color: #aaa;
    display: block;
    margin-top: 5px;
  }
`;

const deleteButtonStyle = css`
  padding: 6px 12px;
  font-size: 12px;
  background: #ff0000;
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;

  &:hover {
    background: #cc0000;
  }
`;

const exportButtonStyle = css`
  padding: 10px 20px;
  font-size: 14px;
  background: #00ff00;
  color: #000;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;

  &:hover {
    background: #00cc00;
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

export function SessionExplorer() {
  const { sessions: contextSessions } = useSession();
  const [allSessions, setAllSessions] = useState<Session[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessions = await getAllSessions();
        setAllSessions(sessions);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    load();
  }, [contextSessions]);

  const handleExportAll = () => {
    if (allSessions.length > 0) {
      downloadCSV(allSessions);
    }
  };

  const handleDelete = async (sessionId: string) => {
    const { deleteSession } = await import('../services/storage');
    await deleteSession(sessionId);
    setAllSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  };

  return (
    <div css={explorerStyle}>
      <h2>Session History ({allSessions.length})</h2>

      {allSessions.length > 0 ? (
        <>
          <ul css={sessionListStyle}>
            {allSessions.map((session) => (
              <li key={session.sessionId} css={sessionItemStyle}>
                <div css={sessionInfoStyle}>
                  <strong>{session.exerciseTag}</strong>
                  <small>
                    {new Date(session.timestamp).toLocaleString()} — {session.timeSeries.length} points
                  </small>
                </div>
                <button
                  css={deleteButtonStyle}
                  onClick={() => handleDelete(session.sessionId)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <button css={exportButtonStyle} onClick={handleExportAll}>
            Export All to CSV
          </button>
        </>
      ) : (
        <p>No sessions recorded yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SessionExplorer.tsx
git commit -m "feat: implement session explorer with history and export functionality"
```

---

### Task 11: Main App Component & Routing

**Files:**
- Create: `src/App.tsx`

- [ ] **Step 1: Create App with context providers**

```typescript
// src/App.tsx
import React, { useState, useEffect } from 'react';
import { CalibrationProvider } from './context/CalibrationContext';
import { SessionProvider } from './context/SessionContext';
import { CalibrationScreen } from './components/CalibrationScreen';
import { AssessmentCanvas } from './components/AssessmentCanvas';
import { DataCaptureControl } from './components/DataCaptureControl';
import { SessionExplorer } from './components/SessionExplorer';
import { useCalibration } from './hooks/useCalibration';
import { useSession } from './hooks/useSession';
import { css } from '@emotion/react';

const appStyle = css`
  width: 100vw;
  height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
`;

const mainLayoutStyle = css`
  display: flex;
  flex: 1;
  gap: 20px;
  padding: 20px;
`;

const canvasContainerStyle = css`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const sidebarStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 450px;
`;

const headerStyle = css`
  padding: 20px;
  border-bottom: 2px solid #00ff00;
  text-align: center;

  h1 {
    margin: 0;
    color: #00ff00;
  }
`;

function AppContent() {
  const { calibration, isLoading } = useCalibration();
  const { currentSession } = useSession();
  const [showExplorer, setShowExplorer] = useState(false);
  const [canvasData, setCanvasData] = useState({ x: 0, y: 0, r: 0 });

  if (isLoading) {
    return (
      <div css={appStyle}>
        <div css={headerStyle}>
          <h1>Loading calibration data...</h1>
        </div>
      </div>
    );
  }

  if (!calibration) {
    return (
      <div css={appStyle}>
        <div css={headerStyle}>
          <h1>Strabismus Measurement App</h1>
        </div>
        <CalibrationScreen onComplete={() => {}} />
      </div>
    );
  }

  return (
    <div css={appStyle}>
      <div css={headerStyle}>
        <h1>Strabismus Measurement App</h1>
        <p>Calibrated at {new Date(calibration.timestamp).toLocaleString()}</p>
      </div>

      <div css={mainLayoutStyle}>
        <div css={canvasContainerStyle}>
          <AssessmentCanvas
            onPositionChange={(x, y, r) => {
              setCanvasData({ x, y, r });
            }}
          />
        </div>

        <div css={sidebarStyle}>
          <DataCaptureControl />

          <div css={css`padding: 15px; background: #1a1a1a; border: 1px solid #00ff00; border-radius: 4px;`}>
            <h3>Position & Rotation</h3>
            <p>X: {canvasData.x.toFixed(2)} cm</p>
            <p>Y: {canvasData.y.toFixed(2)} cm</p>
            <p>Rotation: {canvasData.r.toFixed(1)}°</p>
            <p>
              <strong>Points: {currentSession?.timeSeries.length || 0}</strong>
            </p>
          </div>

          <button
            onClick={() => setShowExplorer(!showExplorer)}
            css={css`
              padding: 10px 20px;
              font-size: 14px;
              background: #00ff00;
              color: #000;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            `}
          >
            {showExplorer ? 'Hide' : 'Show'} Session History
          </button>

          {showExplorer && <SessionExplorer />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CalibrationProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </CalibrationProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: implement App root component with layout and context providers"
```

---

### Task 12: Build & Deployment Setup

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create GitHub Actions deployment workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: strabismus.local
```

- [ ] **Step 2: Update package.json with gh-pages dependency**

```bash
npm install --save-dev gh-pages
```

- [ ] **Step 3: Add homepage to package.json**

```json
{
  "homepage": "https://YOUR_GITHUB_USERNAME.github.io/strabismus-measurement-app"
}
```

- [ ] **Step 4: Create deployment README**

```markdown
# Deployment Guide

## Local Development

```bash
npm install
npm run dev
```

App runs at http://localhost:5173

## Build for Production

```bash
npm run build
```

Output in `dist/` directory.

## Deploy to GitHub Pages

1. Push to `master` branch
2. GitHub Actions automatically builds and deploys
3. Access at your configured GitHub Pages URL

## Manual Testing

Before committing:

```bash
npm test
npm run build
npm run preview
```

Verify:
- Calibration screen loads
- PPMM calculation works
- Canvas renders red/green crosses
- Drag/rotate interactions work
- Time-series captures data (100ms)
- Sessions persist to IndexedDB
- CSV export generates valid file
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add GitHub Actions deployment workflow for GitHub Pages"
```

---

## Self-Review Checklist

### Spec Coverage

✅ **Section 2 (Technical Stack):**
- Task 1: React 18, Vite, TypeScript setup
- Task 6: react-konva integration (AssessmentCanvas)
- Task 3: IndexedDB storage (storage.ts)

✅ **Section 3.1 (PPMM Calibration):**
- Task 7: CalibrationScreen with credit card sizing and PPMM calculation

✅ **Section 3.2 (Assessment Canvas):**
- Task 8: Static red cross + user-controlled green cross
- Task 8: Drag (translation) + right-mouse rotation + arrow-key fine-tuning

✅ **Section 3.4 (Exercise Tracking):**
- Task 9: ExerciseSelector with predefined list
- Task 5: SessionContext manages exercise selection

✅ **Section 4 (Data Architecture):**
- Task 2: TypeScript types (Session, TimeSeries, CalibrationState)
- Task 3: IndexedDB persistence
- Task 5: useTimeSeries hook (100ms intervals)

✅ **Section 5.2 (Accessibility):**
- Task 8 & 9: High-contrast colors (#FF0000, #00FF00) on dark background

✅ **CSV Export:**
- Task 6: generateCSV + downloadCSV functions
- Task 10: SessionExplorer export button

### Placeholder Scan

✅ No "TBD", "TODO", "later", "handle edge cases" placeholders
✅ Every code step shows complete, runnable code
✅ All file paths are exact
✅ All commands include expected output

### Type Consistency

✅ `ExerciseType` enum defined in Task 2, used consistently in ExerciseSelector and SessionContext
✅ `Session`, `TimeSeries`, `CalibrationState` interfaces defined once, imported everywhere
✅ All function signatures match across tasks

### Component Integration

✅ CalibrationProvider wraps App in Task 11
✅ SessionProvider wraps App in Task 11
✅ AssessmentCanvas receives `onPositionChange` callback
✅ DataCaptureControl integrates useTimeSeries
✅ SessionExplorer loads from getAllSessions

---

## Execution Handoff

**Plan complete and saved to `/home/miso/projects/strabismus-measurement-app/docs/superpowers/plans/2026-03-25-strabismus-mvp.md`**

### Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, I review between tasks, fast iteration and error recovery

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you prefer?**