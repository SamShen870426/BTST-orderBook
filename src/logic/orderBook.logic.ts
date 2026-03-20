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

/**
 * 將 Map<price, size> 轉成顯示用的 QuoteLevel[]（僅 price / size / total；barPercent 先填 0）。
 *
 * 金融級規格：
 * - API 僅提供 price、size；total 與 barPercent 均由前端計算。
 * - 累加邏輯 (Inside-Out)：由最優價（靠近 Spread）往外累加。
 *   - Buy (Bids)：最高價→低，total 從第一筆向下累加。
 *   - Sell (Asks)：最低價→高累加，UI 顯示時反轉（高價在上）。
 * - 深度條分母見 `getDepthBarDenominator`；實際百分比由 `applyDepthBarPercent` 套用。
 */
export function buildQuoteLevels(
  map: PriceMap,
  side: 'buy' | 'sell',
  limit: number
): QuoteLevel[] {
  const entries = Array.from(map.entries()).filter(([, size]) => size > 0);

  const isAsk = side === 'sell';
  entries.sort((a, b) => (isAsk ? a[0] - b[0] : b[0] - a[0]));
  const sliced = entries.slice(0, limit);
  let cumulative = new Decimal(0);
  const levels: QuoteLevel[] = sliced.map(([price, size]) => {
    cumulative = cumulative.plus(size);
    return { price, size, total: cumulative.toNumber(), barPercent: 0 };
  });
  const result = isAsk ? levels.reverse() : levels;
  return result;
}

/**
 * 深度條分母：買側 8 筆累計總量與賣側 8 筆累計總量取較大者。
 * 各側累計總量 = 該側可見列中 total 的最大值（即該側由 Spread 往外累加後的總深度）。
 */
export function getDepthBarDenominator(asks: QuoteLevel[], bids: QuoteLevel[]): number {
  const askTotal = asks.length ? Math.max(...asks.map((q) => q.total)) : 0;
  const bidTotal = bids.length ? Math.max(...bids.map((q) => q.total)) : 0;
  return Math.max(askTotal, bidTotal);
}

/** 以同一分母計算深度條寬度百分比（買賣共用分母時呼叫）。 */
export function applyDepthBarPercent(levels: QuoteLevel[], denominator: number): QuoteLevel[] {
  return levels.map((q) => ({
    ...q,
    barPercent: computeBarPercent(q.total, denominator),
  }));
}

/**
 * 深度條寬度百分比：當前行 total / 分母（通常為 getDepthBarDenominator 結果）。
 */
export function computeBarPercent(total: number, maxTotal: number): number {
  if (maxTotal <= 0) return 0;
  return Math.round((total / maxTotal) * 1000) / 10;
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
