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
