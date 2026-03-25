// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { generateCSV, downloadCSV } from '../../services/export';
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
    expect(lines[2]).toContain('0.50');
    expect(lines[2]).toContain('-1.20');
    expect(lines[2]).toContain('5.50');
  });

  it('should call createElement and appendChild when downloading CSV', () => {
    const session: Session = {
      sessionId: 'test-123',
      timestamp: '2026-03-25T10:00:00Z',
      exerciseTag: 'No Exercise/Control',
      ppmm: 37.8,
      timeSeries: [{ t: 0, x: 0, y: 0, r: 0 }],
    };

    // Mock browser APIs that may not be available in test environment
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: { visibility: '' },
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(mockLink as unknown as Node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(mockLink as unknown as Node);

    // Mock URL methods if not available
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
      global.URL.revokeObjectURL = vi.fn();
    }

    downloadCSV([session]);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
