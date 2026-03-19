import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useOrderBook } from '../hooks/useOrderBook';
import { useLastPrice } from '../hooks/useLastPrice';
import {
  buildSnapshot,
  computeBarPercent,
  computeIsNew,
  getPrevSize,
  sumTotals,
} from '../logic/orderBook.logic';
import type { PrevSnapshot } from '../logic/orderBook.logic';
import OrderBookView from './OrderBookView';

export default function OrderBook() {
  const [groupLevel, setGroupLevel] = useState(0);
  const { asks, bids, status } = useOrderBook(groupLevel);
  const lastPrice = useLastPrice();
  const committedRef = useRef<PrevSnapshot | null>(null);

  const prev = committedRef.current;

  useEffect(() => {
    committedRef.current = buildSnapshot(asks, bids);
  }, [asks, bids]);

  const handleGroupChange = useCallback((level: number) => {
    committedRef.current = null;
    setGroupLevel(level);
  }, []);

  const sumAsk = useMemo(() => sumTotals(asks), [asks]);
  const sumBid = useMemo(() => sumTotals(bids), [bids]);

  const askRows = useMemo(
    () =>
      asks.map((quote) => ({
        quote,
        side: 'sell' as const,
        barPercent: computeBarPercent(quote.total, sumAsk),
        prevSize: getPrevSize(prev, quote.price, 'sell'),
        isNew: computeIsNew(prev, quote.price, 'sell'),
      })),
    [asks, sumAsk, prev]
  );

  const bidRows = useMemo(
    () =>
      bids.map((quote) => ({
        quote,
        side: 'buy' as const,
        barPercent: computeBarPercent(quote.total, sumBid),
        prevSize: getPrevSize(prev, quote.price, 'buy'),
        isNew: computeIsNew(prev, quote.price, 'buy'),
      })),
    [bids, sumBid, prev]
  );

  return (
    <OrderBookView
      askRows={askRows}
      bidRows={bidRows}
      lastPrice={lastPrice.price}
      lastPriceDirection={lastPrice.direction}
      status={status}
      groupLevel={groupLevel}
      onGroupChange={handleGroupChange}
    />
  );
}
