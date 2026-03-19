import { describe, it, expect } from 'vitest';
import {
  applyLevels,
  buildQuoteLevels,
  computeBarPercent,
  buildSnapshot,
  computeIsNew,
  getPrevSize,
  sumTotals,
} from '../../logic/orderBook.logic';
import type { PriceMap } from '../../logic/orderBook.logic';

describe('applyLevels', () => {
  it('should add new price levels to the map', () => {
    const map: PriceMap = new Map();
    applyLevels([['100.5', '10'], ['200.0', '20']], map);

    expect(map.get(100.5)).toBe(10);
    expect(map.get(200.0)).toBe(20);
    expect(map.size).toBe(2);
  });

  it('should remove price levels when size is 0', () => {
    const map: PriceMap = new Map([[100.5, 10]]);
    applyLevels([['100.5', '0']], map);

    expect(map.has(100.5)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('should update existing price levels', () => {
    const map: PriceMap = new Map([[100.5, 10]]);
    applyLevels([['100.5', '25']], map);

    expect(map.get(100.5)).toBe(25);
  });
});

describe('buildQuoteLevels', () => {
  it('should build sell levels sorted high-to-low with cumulative totals from low-to-high', () => {
    const map: PriceMap = new Map([
      [100, 10],
      [101, 20],
      [102, 30],
    ]);
    const levels = buildQuoteLevels(map, 'sell', 3);

    expect(levels[0]!.price).toBe(102);
    expect(levels[0]!.total).toBe(60);
    expect(levels[2]!.price).toBe(100);
    expect(levels[2]!.total).toBe(10);
  });

  it('should build buy levels sorted high-to-low with cumulative totals from high-to-low', () => {
    const map: PriceMap = new Map([
      [97, 5],
      [98, 15],
      [99, 25],
    ]);
    const levels = buildQuoteLevels(map, 'buy', 3);

    expect(levels[0]!.price).toBe(99);
    expect(levels[0]!.total).toBe(25);
    expect(levels[2]!.price).toBe(97);
    expect(levels[2]!.total).toBe(45);
  });

  it('should limit the number of levels returned', () => {
    const map: PriceMap = new Map([
      [100, 10],
      [101, 20],
      [102, 30],
      [103, 40],
    ]);
    const levels = buildQuoteLevels(map, 'sell', 2);

    expect(levels.length).toBe(2);
    expect(levels[0]!.price).toBe(101);
    expect(levels[1]!.price).toBe(100);
  });

  it('should filter out zero-size entries', () => {
    const map: PriceMap = new Map([
      [100, 0],
      [101, 20],
    ]);
    const levels = buildQuoteLevels(map, 'sell', 8);

    expect(levels.length).toBe(1);
    expect(levels[0]!.price).toBe(101);
  });
});

describe('computeBarPercent', () => {
  it('should return rounded percentage to 1 decimal place', () => {
    expect(computeBarPercent(26911, 133693)).toBeCloseTo(20.1, 1);
  });

  it('should return 0 when sumTotals is 0', () => {
    expect(computeBarPercent(100, 0)).toBe(0);
  });

  it('should return 0 when sumTotals is negative', () => {
    expect(computeBarPercent(100, -1)).toBe(0);
  });
});

describe('buildSnapshot / computeIsNew / getPrevSize', () => {
  const asks = [
    { price: 100, size: 10, total: 10 },
    { price: 101, size: 20, total: 30 },
  ];
  const bids = [
    { price: 99, size: 5, total: 5 },
    { price: 98, size: 15, total: 20 },
  ];
  const snapshot = buildSnapshot(asks, bids);

  it('buildSnapshot should capture displayed prices and sizes', () => {
    expect(snapshot.displayedAskPrices.has(100)).toBe(true);
    expect(snapshot.displayedAskPrices.has(102)).toBe(false);
    expect(snapshot.askSizes.get(101)).toBe(20);
    expect(snapshot.bidSizes.get(99)).toBe(5);
  });

  it('computeIsNew should return true for new prices', () => {
    expect(computeIsNew(snapshot, 102, 'sell')).toBe(true);
    expect(computeIsNew(snapshot, 100, 'sell')).toBe(false);
    expect(computeIsNew(null, 100, 'sell')).toBe(false);
  });

  it('getPrevSize should return size for existing prices', () => {
    expect(getPrevSize(snapshot, 100, 'sell')).toBe(10);
    expect(getPrevSize(snapshot, 102, 'sell')).toBeUndefined();
    expect(getPrevSize(null, 100, 'sell')).toBeUndefined();
  });
});

describe('sumTotals', () => {
  it('should sum all total values', () => {
    const quotes = [
      { price: 100, size: 10, total: 100 },
      { price: 101, size: 20, total: 200 },
    ];
    expect(sumTotals(quotes)).toBe(300);
  });

  it('should return 0 for empty array', () => {
    expect(sumTotals([])).toBe(0);
  });
});
