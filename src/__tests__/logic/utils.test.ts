import { describe, it, expect, vi } from 'vitest';
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

  it('當 split 回傳空陣列時 intPart 退回 0（防禦分支）', () => {
    const splitSpy = vi.spyOn(String.prototype, 'split').mockImplementation(function (this: string, sep?: string) {
      if (sep === '.') return [];
      const orig = String.prototype.split as (this: string, separator?: string) => string[];
      return orig.call(this, sep);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vitest + TS 對 String#split 重載過嚴
    } as any);
    expect(formatNumber(42)).toBe('0');
    splitSpy.mockRestore();
  });
});
