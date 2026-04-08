import React, { createContext, useState, ReactNode } from 'react';
import { Session, TimeSeries, SessionStats } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const SessionContext = createContext<{
  currentSession: Session | null;
  completedSession: Session | null;
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
  deleteSelectedSessions: (sessionIds: string[]) => Promise<void>;
}>({
  currentSession: null,
  completedSession: null,
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
  deleteSelectedSessions: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);
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
    console.log('[SessionContext] startSession:', session.sessionId, 'exercise:', exerciseTag);
    setCurrentSession(session);
  };

  const addTimeSeriesPoint = (point: TimeSeries) => {
    console.log('[SessionContext] addTimeSeriesPoint called with:', point);
    // Use functional update to always get the latest state
    setCurrentSession(prevSession => {
      if (!prevSession) {
        console.log('[SessionContext] No active session, ignoring point');
        return prevSession;
      }
      const newTimeSeries = [...prevSession.timeSeries, point];
      console.log('[SessionContext] Total points now:', newTimeSeries.length);
      return {
        ...prevSession,
        timeSeries: newTimeSeries,
      };
    });
  };

  const endSession = async () => {
    if (!currentSession) return;

    console.log('[SessionContext] endSession called');
    console.log('[SessionContext] Total points recorded:', currentSession.timeSeries.length);
    console.log('[SessionContext] Session duration:', currentSession.timeSeries.length > 1
      ? ((currentSession.timeSeries[currentSession.timeSeries.length - 1].t - currentSession.timeSeries[0].t) / 1000).toFixed(2) + 's'
      : '0s');
    if (currentSession.timeSeries.length > 0) {
      console.log('[SessionContext] First point:', currentSession.timeSeries[0]);
      console.log('[SessionContext] Last point:', currentSession.timeSeries[currentSession.timeSeries.length - 1]);
    }

    const { saveSession } = await import('../services/storage');
    await saveSession(currentSession);
    setSessions([currentSession, ...sessions]);
    setCompletedSession(currentSession);
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

  const deleteSelectedSessions = async (sessionIds: string[]) => {
    const { deleteSession } = await import('../services/storage');
    for (const sessionId of sessionIds) {
      await deleteSession(sessionId);
    }
    // Update the sessions list to remove deleted sessions
    setSessions(sessions.filter(s => !sessionIds.includes(s.sessionId)));
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        completedSession,
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
        deleteSelectedSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
