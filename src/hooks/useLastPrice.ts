import { useEffect, useRef, useState, useCallback } from 'react';
import type { TradeHistoryWsMessage, PriceDirection } from '../types';
import { WS_TRADE_URL, TRADE_TOPIC, WS_ACTIVITY_TIMEOUT_MS } from '../constants';
import { computePriceDirection } from '../logic/lastPrice.logic';
import {
  isWsAppPongMessage,
  logWsAppPongReceived,
  startWsAppPingInterval,
} from '../ws/wsAppPingPong';

const RECONNECT_BASE_MS = 1000;
const WS_PING_CHANNEL = 'futures trade (/ws/futures)';
const RECONNECT_MAX_MS = 30000;

export interface LastPriceState {
  price: number | null;
  direction: PriceDirection;
}

export function useLastPrice(): LastPriceState {
  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const activityTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const [state, setState] = useState<LastPriceState>({ price: null, direction: 'same' });

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    wsRef.current?.close();
    const ws = new WebSocket(WS_TRADE_URL);
    wsRef.current = ws;

    let disposeAppPing: (() => void) | undefined;

    const resetActivityTimer = () => {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => {
        ws.close();
      }, WS_ACTIVITY_TIMEOUT_MS);
    };

    ws.onopen = () => {
      retryCount.current = 0;
      ws.send(JSON.stringify({ op: 'subscribe', args: [TRADE_TOPIC] }));
      resetActivityTimer();
      disposeAppPing?.();
      disposeAppPing = startWsAppPingInterval(ws, WS_PING_CHANNEL);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current !== ws) return;
      resetActivityTimer();

      if (isWsAppPongMessage(event.data)) {
        logWsAppPongReceived(WS_PING_CHANNEL);
        return;
      }

      try {
        const msg: TradeHistoryWsMessage = JSON.parse(event.data as string);
        if (!msg.data || !Array.isArray(msg.data) || msg.data.length === 0) return;

        const trade = msg.data[0];
        if (trade === undefined) return;
        const newPrice = trade.price;
        const direction = computePriceDirection(prevPriceRef.current, newPrice);

        prevPriceRef.current = newPrice;
        setState({ price: newPrice, direction });
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      disposeAppPing?.();
      disposeAppPing = undefined;
      clearTimeout(activityTimerRef.current);
      if (!mountedRef.current) return;
      if (wsRef.current !== ws) return;

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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

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
      clearTimeout(retryTimer.current);
      clearTimeout(activityTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect]);

  return state;
}
