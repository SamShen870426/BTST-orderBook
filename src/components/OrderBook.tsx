import { useRef, useEffect, useMemo } from 'react';
import { useOrderBook } from '../hooks/useOrderBook';
import { useLastPrice } from '../hooks/useLastPrice';
import {
  buildSnapshot,
  computeIsNew,
  getPrevSize,
} from '../logic/orderBook.logic';
import type { PrevSnapshot } from '../logic/orderBook.logic';
import OrderBookView from './OrderBookView';

export default function OrderBook() {
  const { asks, bids, status } = useOrderBook();
  const lastPrice = useLastPrice();
  const committedRef = useRef<PrevSnapshot | null>(null);

  const prev = committedRef.current;

  useEffect(() => {
    committedRef.current = buildSnapshot(asks, bids);
  }, [asks, bids]);

  const askRows = useMemo(
    () =>
      asks.map((quote) => ({
        quote,
        side: 'sell' as const,
        barPercent: quote.barPercent,
        prevSize: getPrevSize(prev, quote.price, 'sell'),
        isNew: computeIsNew(prev, quote.price, 'sell'),
      })),
    [asks, prev]
  );

  const bidRows = useMemo(
    () =>
      bids.map((quote) => ({
        quote,
        side: 'buy' as const,
        barPercent: quote.barPercent,
        prevSize: getPrevSize(prev, quote.price, 'buy'),
        isNew: computeIsNew(prev, quote.price, 'buy'),
      })),
    [bids, prev]
  );

  return (
    <OrderBookView
      askRows={askRows}
      bidRows={bidRows}
      lastPrice={lastPrice.price}
      lastPriceDirection={lastPrice.direction}
      status={status}
    />
  );
}
