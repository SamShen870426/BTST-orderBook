import { describe, it, expect } from 'vitest';
import { formatNumber } from '../../utils';

describe('formatNumber', () => {
  it('should add commas to large integers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should handle decimal numbers', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });

  it('should not add commas to small numbers', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle numbers with many decimals', () => {
    expect(formatNumber(12345.678)).toBe('12,345.678');
  });
});
