import Decimal from 'decimal.js';
import type { QuoteLevel } from '../types';

export type PriceMap = Map<number, number>;

export function applyLevels(levels: [string, string][], map: PriceMap): void {
  for (const [priceStr, sizeStr] of levels) {
    const price = parseFloat(priceStr);
    const size = parseFloat(sizeStr);
    if (size === 0) {
      map.delete(price);
    } else {
      map.set(price, size);
    }
  }
}

export function buildQuoteLevels(
  map: PriceMap,
  side: 'buy' | 'sell',
  limit: number
): QuoteLevel[] {
  const entries = Array.from(map.entries()).filter(([, size]) => size > 0);

  if (side === 'sell') {
    entries.sort((a, b) => a[0] - b[0]);
    const sliced = entries.slice(0, limit);
    let cumulative = new Decimal(0);
    const levels: QuoteLevel[] = sliced.map(([price, size]) => {
      cumulative = cumulative.plus(size);
      return { price, size, total: cumulative.toNumber() };
    });
    return levels.reverse();
  }

  entries.sort((a, b) => b[0] - a[0]);
  const sliced = entries.slice(0, limit);
  let cumulative = new Decimal(0);
  return sliced.map(([price, size]) => {
    cumulative = cumulative.plus(size);
    return { price, size, total: cumulative.toNumber() };
  });
}

export function computeBarPercent(total: number, sumTotals: number): number {
  if (sumTotals <= 0) return 0;
  return Math.round((total / sumTotals) * 1000) / 10;
}

export interface PrevSnapshot {
  displayedAskPrices: Set<number>;
  displayedBidPrices: Set<number>;
  askSizes: Map<number, number>;
  bidSizes: Map<number, number>;
}

export function buildSnapshot(asks: QuoteLevel[], bids: QuoteLevel[]): PrevSnapshot {
  return {
    displayedAskPrices: new Set(asks.map((q) => q.price)),
    displayedBidPrices: new Set(bids.map((q) => q.price)),
    askSizes: new Map(asks.map((q) => [q.price, q.size])),
    bidSizes: new Map(bids.map((q) => [q.price, q.size])),
  };
}

export function computeIsNew(
  prev: PrevSnapshot | null,
  price: number,
  side: 'buy' | 'sell'
): boolean {
  if (prev === null) return false;
  const priceSet = side === 'sell' ? prev.displayedAskPrices : prev.displayedBidPrices;
  return !priceSet.has(price);
}

export function getPrevSize(
  prev: PrevSnapshot | null,
  price: number,
  side: 'buy' | 'sell'
): number | undefined {
  if (prev === null) return undefined;
  const sizeMap = side === 'sell' ? prev.askSizes : prev.bidSizes;
  return sizeMap.get(price);
}

export function sumTotals(quotes: QuoteLevel[]): number {
  return quotes.reduce((sum, q) => sum + q.total, 0);
}
