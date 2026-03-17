import { useEffect, useRef, useCallback, useState } from 'react';
import type { OrderBookWsMessage, QuoteLevel } from '../types';
import { WS_ORDERBOOK_URL, ORDERBOOK_TOPIC, MAX_DISPLAY_ROWS } from '../constants';

type PriceMap = Map<number, number>;

const BATCH_INTERVAL = 50;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface OrderBookState {
  asks: QuoteLevel[];
  bids: QuoteLevel[];
  status: ConnectionStatus;
}

function buildQuoteLevels(
  map: PriceMap,
  side: 'buy' | 'sell',
  limit: number
): QuoteLevel[] {
  const entries = Array.from(map.entries()).filter(([, size]) => size > 0);

  if (side === 'sell') {
    entries.sort((a, b) => a[0] - b[0]);
    const sliced = entries.slice(0, limit);
    let cumulative = 0;
    const levels: QuoteLevel[] = sliced.map(([price, size]) => {
      cumulative += size;
      return { price, size, total: cumulative };
    });
    return levels.reverse();
  }

  entries.sort((a, b) => b[0] - a[0]);
  const sliced = entries.slice(0, limit);
  let cumulative = 0;
  return sliced.map(([price, size]) => {
    cumulative += size;
    return { price, size, total: cumulative };
  });
}

export function useOrderBook() {
  const wsRef = useRef<WebSocket | null>(null);
  const bidsMap = useRef<PriceMap>(new Map());
  const asksMap = useRef<PriceMap>(new Map());
  const lastSeqNum = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const batchTimerRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const [orderBook, setOrderBook] = useState<OrderBookState>({
    asks: [],
    bids: [],
    status: 'connecting',
  });

  const setStatus = useCallback((status: ConnectionStatus) => {
    setOrderBook((prev) => (prev.status === status ? prev : { ...prev, status }));
  }, []);

  const applyLevels = useCallback((levels: [string, string][], map: PriceMap) => {
    for (const [priceStr, sizeStr] of levels) {
      const price = parseFloat(priceStr);
      const size = parseFloat(sizeStr);
      if (size === 0) {
        map.delete(price);
      } else {
        map.set(price, size);
      }
    }
  }, []);

  const flush = useCallback(() => {
    setOrderBook((prev) => ({
      asks: buildQuoteLevels(asksMap.current, 'sell', MAX_DISPLAY_ROWS),
      bids: buildQuoteLevels(bidsMap.current, 'buy', MAX_DISPLAY_ROWS),
      status: prev.status,
    }));
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    wsRef.current?.close();
    setStatus('connecting');

    const ws = new WebSocket(WS_ORDERBOOK_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      setStatus('connected');
      ws.send(JSON.stringify({ op: 'subscribe', args: [ORDERBOOK_TOPIC] }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: OrderBookWsMessage = JSON.parse(event.data as string);
        if (!msg.data || !msg.data.type) return;

        const { data } = msg;

        if (data.type === 'snapshot') {
          bidsMap.current.clear();
          asksMap.current.clear();
          applyLevels(data.bids, bidsMap.current);
          applyLevels(data.asks, asksMap.current);
          lastSeqNum.current = data.seqNum;
          flush();
          return;
        }

        if (data.type === 'delta') {
          if (lastSeqNum.current !== null && data.prevSeqNum !== lastSeqNum.current) {
            ws.send(JSON.stringify({ op: 'unsubscribe', args: [ORDERBOOK_TOPIC] }));
            bidsMap.current.clear();
            asksMap.current.clear();
            lastSeqNum.current = null;
            dirtyRef.current = false;
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 'subscribe', args: [ORDERBOOK_TOPIC] }));
              }
            }, 200);
            return;
          }

          applyLevels(data.bids, bidsMap.current);
          applyLevels(data.asks, asksMap.current);
          lastSeqNum.current = data.seqNum;

          const bestBid = Math.max(...Array.from(bidsMap.current.keys()));
          const bestAsk = Math.min(...Array.from(asksMap.current.keys()));
          if (bestBid >= bestAsk) {
            ws.send(JSON.stringify({ op: 'unsubscribe', args: [ORDERBOOK_TOPIC] }));
            bidsMap.current.clear();
            asksMap.current.clear();
            lastSeqNum.current = null;
            dirtyRef.current = false;
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 'subscribe', args: [ORDERBOOK_TOPIC] }));
              }
            }, 200);
            return;
          }

          dirtyRef.current = true;
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');

      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, retryCount.current),
        RECONNECT_MAX_MS
      );
      retryCount.current++;
      retryTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [applyLevels, flush, setStatus]);

  useEffect(() => {
    mountedRef.current = true;

    connect();

    batchTimerRef.current = setInterval(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        flush();
      }
    }, BATCH_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          clearTimeout(retryTimer.current);
          retryCount.current = 0;
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      clearInterval(batchTimerRef.current);
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect, flush]);

  return orderBook;
}
