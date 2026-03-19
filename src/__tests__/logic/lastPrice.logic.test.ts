import { describe, it, expect } from 'vitest';
import { computePriceDirection, getDirectionConfig } from '../../logic/lastPrice.logic';

describe('computePriceDirection', () => {
  it('should return "same" when prev is null', () => {
    expect(computePriceDirection(null, 100)).toBe('same');
  });

  it('should return "up" when current > prev', () => {
    expect(computePriceDirection(99, 100)).toBe('up');
  });

  it('should return "down" when current < prev', () => {
    expect(computePriceDirection(100, 99)).toBe('down');
  });

  it('should return "same" when current === prev', () => {
    expect(computePriceDirection(100, 100)).toBe('same');
  });
});

describe('getDirectionConfig', () => {
  it('should return green config for up', () => {
    const config = getDirectionConfig('up');
    expect(config.arrow).toBe('↑');
    expect(config.color).toContain('00b15d');
  });

  it('should return red config for down', () => {
    const config = getDirectionConfig('down');
    expect(config.arrow).toBe('↓');
    expect(config.color).toContain('FF5B5A');
  });

  it('should return neutral config for same', () => {
    const config = getDirectionConfig('same');
    expect(config.arrow).toBe('');
  });
});
