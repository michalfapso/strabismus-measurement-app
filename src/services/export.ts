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
