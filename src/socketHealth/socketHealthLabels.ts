import type { SocketHealthSlot } from './socketHealthStore';
import { SOCKET_HEALTH_STALE_MS } from './socketHealthStore';

const RS = typeof WebSocket !== 'undefined' ? WebSocket : { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

export function socketHealthReadyStateLabel(readyState: number): string {
  switch (readyState) {
    case RS.CONNECTING:
      return '連線中';
    case RS.OPEN:
      return '已連線';
    case RS.CLOSING:
      return '關閉中';
    case RS.CLOSED:
      return '已關閉';
    default:
      return `未知 (${readyState})`;
  }
}

export type SocketHealthUiStatus = 'ok' | 'stale' | 'down' | 'connecting';

export function socketHealthUiStatus(slot: SocketHealthSlot, now: number): SocketHealthUiStatus {
  if (slot.readyState === RS.CONNECTING) return 'connecting';
  if (slot.readyState !== RS.OPEN) return 'down';
  if (slot.lastMessageAt == null) return 'stale';
  if (now - slot.lastMessageAt > SOCKET_HEALTH_STALE_MS) return 'stale';
  return 'ok';
}

export function formatAgo(ts: number | null, now: number): string {
  if (ts == null) return '—';
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 0) return '剛剛';
  if (sec < 60) return `${sec} 秒前`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  return `${h} 小時前`;
}
