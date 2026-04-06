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

    // Helper for safe integer parsing with validation
    const safeParseInt = (value: string | null, defaultValue: number): number => {
      if (!value) return defaultValue;
      const parsed = parseInt(value, 10);  // Add radix 10
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const params = new URLSearchParams(window.location.search);

    // Parse sessions with semicolon delimiter (safer than comma)
    const sessionIds = (params.get('sessions') || '')
      .split(';')
      .filter(id => id.length > 0);

    const exerciseFilter = params.get('exercise') || undefined;

    // Parse zoom values with safe parsing
    let zoomStart = safeParseInt(params.get('zoomStart'), 0);
    let zoomEnd = safeParseInt(params.get('zoomEnd'), 20);

    // Validate zoom range: ensure zoomStart <= zoomEnd
    if (zoomStart > zoomEnd) {
      zoomStart = 0;
      zoomEnd = 20;
    }

    const drilledDownSessionId = params.get('detail') || undefined;

    return { selectedSessionIds: sessionIds, exerciseFilter, zoomStart, zoomEnd, drilledDownSessionId };
  }

  // Update URL whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (state.selectedSessionIds.length > 0) {
      params.set('sessions', state.selectedSessionIds.join(';'));
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
