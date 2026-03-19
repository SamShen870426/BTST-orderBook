import { useEffect, useRef, useCallback, useState } from 'react';
import type { OrderBookWsMessage, OrderBookData } from '../types';
import { WS_ORDERBOOK_URL, getOrderBookTopic, MAX_DISPLAY_ROWS } from '../constants';
import { applyLevels, buildQuoteLevels } from '../logic/orderBook.logic';
import type { PriceMap } from '../logic/orderBook.logic';
import type { QuoteLevel } from '../types';

const BATCH_INTERVAL = 50;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const ACTIVITY_TIMEOUT_MS = 10000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface OrderBookState {
  asks: QuoteLevel[];
  bids: QuoteLevel[];
  status: ConnectionStatus;
}

export function useOrderBook(groupLevel: number) {
  const wsRef = useRef<WebSocket | null>(null);
  const bidsMap = useRef<PriceMap>(new Map());
  const asksMap = useRef<PriceMap>(new Map());
  const lastSeqNum = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const batchTimerRef = useRef<ReturnType<typeof setInterval>>();
  const activityTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const topicRef = useRef(getOrderBookTopic(groupLevel));
  const pendingDeltasRef = useRef<OrderBookData[]>([]);
  const awaitingSnapshotRef = useRef(false);

  const [orderBook, setOrderBook] = useState<OrderBookState>({
    asks: [],
    bids: [],
    status: 'connecting',
  });

  const setStatus = useCallback((status: ConnectionStatus) => {
    setOrderBook((prev) => (prev.status === status ? prev : { ...prev, status }));
  }, []);

  const flush = useCallback(() => {
    setOrderBook((prev) => ({
      asks: buildQuoteLevels(asksMap.current, 'sell', MAX_DISPLAY_ROWS),
      bids: buildQuoteLevels(bidsMap.current, 'buy', MAX_DISPLAY_ROWS),
      status: prev.status,
    }));
  }, []);

  const clearBookState = useCallback(() => {
    bidsMap.current.clear();
    asksMap.current.clear();
    lastSeqNum.current = null;
    dirtyRef.current = false;
  }, []);

  const resubscribe = useCallback((ws: WebSocket) => {
    const topic = topicRef.current;
    ws.send(JSON.stringify({ op: 'unsubscribe', args: [topic] }));
    clearBookState();
    pendingDeltasRef.current = [];
    awaitingSnapshotRef.current = true;
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
      }
    }, 200);
  }, [clearBookState]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    wsRef.current?.close();
    clearBookState();
    setStatus('connecting');

    const ws = new WebSocket(WS_ORDERBOOK_URL);
    wsRef.current = ws;

    const resetActivityTimer = () => {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => {
        ws.close();
      }, ACTIVITY_TIMEOUT_MS);
    };

    ws.onopen = () => {
      retryCount.current = 0;
      setStatus('connected');
      ws.send(JSON.stringify({ op: 'subscribe', args: [topicRef.current] }));
      resetActivityTimer();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current !== ws) return;
      resetActivityTimer();

      try {
        const msg: OrderBookWsMessage = JSON.parse(event.data as string);
        if (!msg.data || !msg.data.type) return;

        const { data } = msg;

        if (data.type === 'snapshot') {
          clearBookState();
          applyLevels(data.bids, bidsMap.current);
          applyLevels(data.asks, asksMap.current);
          lastSeqNum.current = data.seqNum;

          if (awaitingSnapshotRef.current) {
            const buffered = pendingDeltasRef.current
              .filter((d) => d.prevSeqNum >= data.seqNum)
              .sort((a, b) => a.seqNum - b.seqNum);

            for (const delta of buffered) {
              if (delta.prevSeqNum === lastSeqNum.current) {
                applyLevels(delta.bids, bidsMap.current);
                applyLevels(delta.asks, asksMap.current);
                lastSeqNum.current = delta.seqNum;
              }
            }
            pendingDeltasRef.current = [];
            awaitingSnapshotRef.current = false;
          }

          flush();
          return;
        }

        if (data.type === 'delta') {
          if (awaitingSnapshotRef.current) {
            pendingDeltasRef.current.push(data);
            return;
          }

          if (lastSeqNum.current !== null && data.prevSeqNum !== lastSeqNum.current) {
            resubscribe(ws);
            return;
          }

          applyLevels(data.bids, bidsMap.current);
          applyLevels(data.asks, asksMap.current);
          lastSeqNum.current = data.seqNum;

          const bestBid = Math.max(...Array.from(bidsMap.current.keys()));
          const bestAsk = Math.min(...Array.from(asksMap.current.keys()));
          if (bestBid >= bestAsk) {
            resubscribe(ws);
            return;
          }

          dirtyRef.current = true;
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      clearTimeout(activityTimerRef.current);
      if (!mountedRef.current) return;
      if (wsRef.current !== ws) return;

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
  }, [flush, setStatus, clearBookState, resubscribe]);

  useEffect(() => {
    const newTopic = getOrderBookTopic(groupLevel);
    const oldTopic = topicRef.current;

    if (newTopic === oldTopic) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 'unsubscribe', args: [oldTopic] }));
      clearBookState();
      setOrderBook((prev) => ({ ...prev, asks: [], bids: [] }));
      topicRef.current = newTopic;
      ws.send(JSON.stringify({ op: 'subscribe', args: [newTopic] }));
    } else {
      topicRef.current = newTopic;
    }
  }, [groupLevel, clearBookState]);

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
      clearTimeout(activityTimerRef.current);
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect, flush]);

  return orderBook;
}
