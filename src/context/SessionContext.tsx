import React, { createContext, useState, ReactNode } from 'react';
import { Session, TimeSeries, SessionStats } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const SessionContext = createContext<{
  currentSession: Session | null;
  startSession: (exerciseTag: string, ppi: number) => void;
  addTimeSeriesPoint: (point: TimeSeries) => void;
  endSession: () => Promise<void>;
  clearSession: () => void;
  sessions: Session[];
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  selectedSessionIds: Set<string>;
  setSelectedSessionIds: (ids: Set<string>) => void;
  loadHistoricalSessions: (from?: Date, to?: Date) => Promise<Session[]>;
}>({
  currentSession: null,
  startSession: () => {},
  addTimeSeriesPoint: () => {},
  endSession: async () => {},
  clearSession: () => {},
  sessions: [],
  showResults: false,
  setShowResults: () => {},
  selectedSessionIds: new Set(),
  setSelectedSessionIds: () => {},
  loadHistoricalSessions: async () => [],
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  const startSession = (exerciseTag: string, ppi: number) => {
    const session: Session = {
      sessionId: uuidv4(),
      timestamp: new Date().toISOString(),
      exerciseTag,
      ppi,
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
    setShowResults(true);
    setCurrentSession(null);
  };

  const clearSession = () => {
    setCurrentSession(null);
  };

  const loadHistoricalSessions = async (from?: Date, to?: Date): Promise<Session[]> => {
    const { getAllSessions } = await import('../services/storage');
    const allSessions = await getAllSessions();

    if (!from && !to) return allSessions;

    return allSessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      const passesFrom = !from || sessionDate >= from;
      const passesTo = !to || sessionDate <= to;
      return passesFrom && passesTo;
    });
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
        showResults,
        setShowResults,
        selectedSessionIds,
        setSelectedSessionIds,
        loadHistoricalSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
