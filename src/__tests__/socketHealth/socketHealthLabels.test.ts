import { describe, it, expect } from 'vitest';
import {
  formatAgo,
  socketHealthReadyStateLabel,
  socketHealthUiStatus,
} from '../../socketHealth/socketHealthLabels';
import type { SocketHealthSlot } from '../../socketHealth/socketHealthStore';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

function slot(partial: Partial<SocketHealthSlot>): SocketHealthSlot {
  return {
    id: 'orderbook',
    label: 't',
    url: 'wss://x',
    subscribeTopic: 'topic',
    readyState: OPEN,
    lastOpenAt: null,
    lastCloseAt: null,
    lastMessageAt: null,
    lastPongAt: null,
    lastPingSentAt: null,
    closeCount: 0,
    inboundSeq: 0,
    ...partial,
  };
}

describe('socketHealthLabels', () => {
  it('socketHealthReadyStateLabel', () => {
    expect(socketHealthReadyStateLabel(CONNECTING)).toContain('連');
    expect(socketHealthReadyStateLabel(OPEN)).toContain('連');
    expect(socketHealthReadyStateLabel(CLOSED)).toContain('關');
  });

  it('socketHealthUiStatus: OPEN with fresh message => ok', () => {
    const now = 1_000_000;
    const s = slot({ readyState: OPEN, lastMessageAt: now - 1000 });
    expect(socketHealthUiStatus(s, now)).toBe('ok');
  });

  it('socketHealthUiStatus: OPEN stale => stale', () => {
    const now = 1_000_000;
    const s = slot({ readyState: OPEN, lastMessageAt: now - 60_000 });
    expect(socketHealthUiStatus(s, now)).toBe('stale');
  });

  it('formatAgo', () => {
    const now = 10_000;
    expect(formatAgo(null, now)).toBe('—');
    expect(formatAgo(7000, now)).toBe('3 秒前');
  });
});
