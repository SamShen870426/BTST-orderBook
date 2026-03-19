import { describe, it, expect } from 'vitest';
import { areEqual, getRowFlashClass, getSizeFlashClass } from '../../logic/quoteRow.logic';
import type { QuoteRowProps } from '../../logic/quoteRow.logic';

const baseProps: QuoteRowProps = {
  quote: { price: 100, size: 10, total: 50 },
  side: 'buy',
  barPercent: 20.1,
  prevSize: 8,
  isNew: false,
};

describe('areEqual', () => {
  it('should return true when all fields match', () => {
    expect(areEqual(baseProps, { ...baseProps })).toBe(true);
  });

  it('should return false when price changes', () => {
    const next = { ...baseProps, quote: { ...baseProps.quote, price: 101 } };
    expect(areEqual(baseProps, next)).toBe(false);
  });

  it('should return false when size changes', () => {
    const next = { ...baseProps, quote: { ...baseProps.quote, size: 15 } };
    expect(areEqual(baseProps, next)).toBe(false);
  });

  it('should return false when barPercent changes', () => {
    const next = { ...baseProps, barPercent: 25.0 };
    expect(areEqual(baseProps, next)).toBe(false);
  });

  it('should return false when isNew changes', () => {
    const next = { ...baseProps, isNew: true };
    expect(areEqual(baseProps, next)).toBe(false);
  });
});

describe('getRowFlashClass', () => {
  it('should return green for buy side', () => {
    expect(getRowFlashClass('buy')).toBe('flash-row-green');
  });

  it('should return red for sell side', () => {
    expect(getRowFlashClass('sell')).toBe('flash-row-red');
  });
});

describe('getSizeFlashClass', () => {
  it('should return empty when prevSize is undefined', () => {
    expect(getSizeFlashClass(10, undefined)).toBe('');
  });

  it('should return empty when size unchanged', () => {
    expect(getSizeFlashClass(10, 10)).toBe('');
  });

  it('should return green when size increases', () => {
    expect(getSizeFlashClass(15, 10)).toBe('flash-size-green');
  });

  it('should return red when size decreases', () => {
    expect(getSizeFlashClass(5, 10)).toBe('flash-size-red');
  });
});
