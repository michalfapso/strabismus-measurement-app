import { useEffect, useState } from 'react';

export interface SessionAnalysisState {
  selectedSessionIds: string[];
  exerciseFilter?: string;
  zoomStart: number;
  zoomEnd: number;
  drilledDownSessionId?: string;
}

export function useSessionAnalysisState() {
  const [state, setState] = useState<SessionAnalysisState>(() => parseUrlState());

  // Parse state from URL on mount
  function parseUrlState(): SessionAnalysisState {
    if (typeof window === 'undefined') {
      return { selectedSessionIds: [], zoomStart: 0, zoomEnd: 20 };
    }

    const params = new URLSearchParams(window.location.search);
    const sessionIds = params.get('sessions')?.split(',').filter(id => id.length > 0) || [];
    const exerciseFilter = params.get('exercise') || undefined;
    const zoomStart = parseInt(params.get('zoomStart') || '0');
    const zoomEnd = parseInt(params.get('zoomEnd') || '20');
    const drilledDownSessionId = params.get('detail') || undefined;

    return { selectedSessionIds: sessionIds, exerciseFilter, zoomStart, zoomEnd, drilledDownSessionId };
  }

  // Update URL whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (state.selectedSessionIds.length > 0) {
      params.set('sessions', state.selectedSessionIds.join(','));
    }
    if (state.exerciseFilter) {
      params.set('exercise', state.exerciseFilter);
    }
    params.set('zoomStart', state.zoomStart.toString());
    params.set('zoomEnd', state.zoomEnd.toString());
    if (state.drilledDownSessionId) {
      params.set('detail', state.drilledDownSessionId);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [state]);

  return { state, setState };
}
