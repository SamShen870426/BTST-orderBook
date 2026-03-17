import { useRef, useEffect, useMemo } from 'react';
import { useOrderBook } from '../hooks/useOrderBook';
import { useLastPrice } from '../hooks/useLastPrice';
import QuoteRow from './QuoteRow';
import LastPrice from './LastPrice';

interface PrevSnapshot {
  displayedAskPrices: Set<number>;
  displayedBidPrices: Set<number>;
  askSizes: Map<number, number>;
  bidSizes: Map<number, number>;
}

export default function OrderBook() {
  const { asks, bids, status } = useOrderBook();
  const lastPrice = useLastPrice();
  const committedRef = useRef<PrevSnapshot | null>(null);

  const prev = committedRef.current;

  useEffect(() => {
    committedRef.current = {
      displayedAskPrices: new Set(asks.map((q) => q.price)),
      displayedBidPrices: new Set(bids.map((q) => q.price)),
      askSizes: new Map(asks.map((q) => [q.price, q.size])),
      bidSizes: new Map(bids.map((q) => [q.price, q.size])),
    };
  }, [asks, bids]);

  const sumAskTotals = useMemo(
    () => asks.reduce((sum, q) => sum + q.total, 0),
    [asks]
  );
  const sumBidTotals = useMemo(
    () => bids.reduce((sum, q) => sum + q.total, 0),
    [bids]
  );

  const askRows = asks.map((quote) => {
    const wasDisplayed = prev?.displayedAskPrices.has(quote.price) ?? true;
    const isNew = prev !== null && !wasDisplayed;
    const prevSize = prev?.askSizes.get(quote.price);
    const barPercent = sumAskTotals > 0
      ? Math.round((quote.total / sumAskTotals) * 1000) / 10
      : 0;

    return (
      <QuoteRow
        key={quote.price}
        quote={quote}
        side="sell"
        barPercent={barPercent}
        prevSize={prevSize}
        isNew={isNew}
      />
    );
  });

  const bidRows = bids.map((quote) => {
    const wasDisplayed = prev?.displayedBidPrices.has(quote.price) ?? true;
    const isNew = prev !== null && !wasDisplayed;
    const prevSize = prev?.bidSizes.get(quote.price);
    const barPercent = sumBidTotals > 0
      ? Math.round((quote.total / sumBidTotals) * 1000) / 10
      : 0;

    return (
      <QuoteRow
        key={quote.price}
        quote={quote}
        side="buy"
        barPercent={barPercent}
        prevSize={prevSize}
        isNew={isNew}
      />
    );
  });

  const isLoading = status === 'connecting' && asks.length === 0;
  const isDisconnected = status === 'disconnected';

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <span>Order Book</span>
        {isDisconnected && (
          <span className="status-badge disconnected">Reconnecting...</span>
        )}
        {status === 'connecting' && asks.length > 0 && (
          <span className="status-badge connecting">Connecting...</span>
        )}
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner" />
          <span className="loading-text">Loading order book...</span>
        </div>
      ) : (
        <>
          <div className="quote-table-head">
            <span className="quote-cell price">Price (USD)</span>
            <span className="quote-cell size">Size</span>
            <span className="quote-cell total">Total</span>
          </div>
          <div className={`quote-section sell-section${isDisconnected ? ' stale' : ''}`}>{askRows}</div>
          <LastPrice price={lastPrice.price} direction={lastPrice.direction} />
          <div className={`quote-section buy-section${isDisconnected ? ' stale' : ''}`}>{bidRows}</div>
        </>
      )}
    </div>
  );
}
