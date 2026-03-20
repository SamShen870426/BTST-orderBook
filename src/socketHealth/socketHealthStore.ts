import {
  WS_ORDERBOOK_URL,
  WS_TRADE_URL,
  TRADE_TOPIC,
  WS_ACTIVITY_TIMEOUT_MS,
  getOrderBookTopic,
} from '../constants';

/** 與訂單簿 hook 預設 group 一致，僅供診斷頁顯示 subscribe 字串 */
const DEFAULT_ORDERBOOK_GROUP = 0;

export type SocketHealthSlotId = 'orderbook' | 'trade';

export interface SocketHealthLatencyPoint {
  t: number;
  ms: number;
}

export interface SocketHealthSlot {
  id: SocketHealthSlotId;
  label: string;
  url: string;
  subscribeTopic: string;
  readyState: number;
  lastOpenAt: number | null;
  lastCloseAt: number | null;
  lastMessageAt: number | null;
  lastPongAt: number | null;
  lastPingSentAt: number | null;
  closeCount: number;
  /** 每則 onmessage 遞增，供 Pulse 偵測（不依賴 1s poll） */
  inboundSeq: number;
}

/** getSnapshot 回傳：含繪圖／監控用衍生欄位 */
export interface SocketHealthSlotSnapshot extends SocketHealthSlot {
  throughputMps: number;
  latencyHistory: SocketHealthLatencyPoint[];
}

const inboundRing: Record<SocketHealthSlotId, number[]> = {
  orderbook: [],
  trade: [],
};

const latencyRing: Record<SocketHealthSlotId, SocketHealthLatencyPoint[]> = {
  orderbook: [],
  trade: [],
};

const INBOUND_RING_MS = 2500;
const LATENCY_WINDOW_MS = 60_000;
const MAX_LATENCY_POINTS = 200;

function pushInboundTs(id: SocketHealthSlotId, ts: number): void {
  const arr = inboundRing[id];
  arr.push(ts);
  const cutoff = ts - INBOUND_RING_MS;
  let i = 0;
  while (i < arr.length && arr[i]! < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

function pushLatencySample(id: SocketHealthSlotId, sample: SocketHealthLatencyPoint): void {
  const arr = latencyRing[id];
  arr.push(sample);
  const cutoff = sample.t - LATENCY_WINDOW_MS;
  while (arr.length > 0 && arr[0]!.t < cutoff) arr.shift();
  while (arr.length > MAX_LATENCY_POINTS) arr.shift();
}

function createSlot(
  id: SocketHealthSlotId,
  label: string,
  url: string,
  subscribeTopic: string
): SocketHealthSlot {
  return {
    id,
    label,
    url,
    subscribeTopic,
    readyState: 3, // WebSocket.CLOSED
    lastOpenAt: null,
    lastCloseAt: null,
    lastMessageAt: null,
    lastPongAt: null,
    lastPingSentAt: null,
    closeCount: 0,
    inboundSeq: 0,
  };
}

const slots: Record<SocketHealthSlotId, SocketHealthSlot> = {
  orderbook: createSlot(
    'orderbook',
    '訂單簿 (OSS /ws/oss/futures)',
    WS_ORDERBOOK_URL,
    getOrderBookTopic(DEFAULT_ORDERBOOK_GROUP)
  ),
  trade: createSlot('trade', '成交 (/ws/futures)', WS_TRADE_URL, TRADE_TOPIC),
};

const RS = typeof WebSocket !== 'undefined' ? WebSocket : { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

function buildSnapshot(id: SocketHealthSlotId, now: number): SocketHealthSlotSnapshot {
  const s = slots[id];
  const throughputMps = inboundRing[id].filter((t) => t > now - 1000).length;
  const latencyHistory = latencyRing[id].filter((p) => p.t > now - LATENCY_WINDOW_MS);
  return {
    ...s,
    throughputMps,
    latencyHistory: latencyHistory.map((p) => ({ ...p })),
  };
}

/** Pulse 用：輕量讀取（O(1)） */
export function socketHealthPeekInboundSeq(id: SocketHealthSlotId): number {
  return slots[id].inboundSeq;
}

/** 建立連線物件後、onopen 前 */
export function socketHealthMarkConnecting(id: SocketHealthSlotId): void {
  slots[id].readyState = RS.CONNECTING;
  inboundRing[id].length = 0;
  latencyRing[id].length = 0;
}

export function socketHealthMarkOpen(id: SocketHealthSlotId, subscribeTopic?: string): void {
  const s = slots[id];
  s.readyState = RS.OPEN;
  s.lastOpenAt = Date.now();
  if (subscribeTopic !== undefined) {
    s.subscribeTopic = subscribeTopic;
  }
}

export function socketHealthMarkClosed(id: SocketHealthSlotId): void {
  const s = slots[id];
  s.readyState = RS.CLOSED;
  s.lastCloseAt = Date.now();
  s.closeCount += 1;
}

/** 任一 onmessage（含 pong）— 僅賦值，不觸發 React */
export function socketHealthMarkInbound(id: SocketHealthSlotId): void {
  const now = Date.now();
  const s = slots[id];
  s.lastMessageAt = now;
  s.inboundSeq += 1;
  pushInboundTs(id, now);
}

export function socketHealthMarkPong(id: SocketHealthSlotId): void {
  const now = Date.now();
  const s = slots[id];
  s.lastPongAt = now;
  const pingAt = s.lastPingSentAt;
  if (pingAt != null) {
    const ms = now - pingAt;
    if (ms >= 0 && ms < 120_000) {
      pushLatencySample(id, { t: now, ms });
    }
  }
}

export function socketHealthMarkPingSent(id: SocketHealthSlotId): void {
  slots[id].lastPingSentAt = Date.now();
}

/** 診斷頁用：淺拷貝 slot + 衍生欄位 */
export function socketHealthGetSnapshot(): Record<SocketHealthSlotId, SocketHealthSlotSnapshot> {
  const now = Date.now();
  return {
    orderbook: buildSnapshot('orderbook', now),
    trade: buildSnapshot('trade', now),
  };
}

export { WS_ACTIVITY_TIMEOUT_MS as SOCKET_HEALTH_STALE_MS };
