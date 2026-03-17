import { useEffect, useRef, useState } from 'react';
import type { TradeHistoryWsMessage, PriceDirection } from '../types';
import { WS_TRADE_URL, TRADE_TOPIC } from '../constants';

interface LastPriceState {
  price: number | null;
  direction: PriceDirection;
}

export function useLastPrice(): LastPriceState {
  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [state, setState] = useState<LastPriceState>({ price: null, direction: 'same' });

  useEffect(() => {
    const ws = new WebSocket(WS_TRADE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [TRADE_TOPIC] }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: TradeHistoryWsMessage = JSON.parse(event.data as string);
        if (!msg.data || !Array.isArray(msg.data) || msg.data.length === 0) return;

        const trade = msg.data[0];
        if (trade === undefined) return;
        const newPrice = trade.price;
        const prev = prevPriceRef.current;

        let direction: PriceDirection = 'same';
        if (prev !== null) {
          if (newPrice > prev) direction = 'up';
          else if (newPrice < prev) direction = 'down';
        }

        prevPriceRef.current = newPrice;
        setState({ price: newPrice, direction });
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return state;
}
