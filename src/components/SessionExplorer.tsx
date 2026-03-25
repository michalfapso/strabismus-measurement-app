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
  margin-top: 10px;

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
