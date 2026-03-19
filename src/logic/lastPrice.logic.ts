import type { PriceDirection } from '../types';
import { COLORS } from '../constants';

export function computePriceDirection(
  prev: number | null,
  current: number
): PriceDirection {
  if (prev === null) return 'same';
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'same';
}

export interface DirectionConfig {
  color: string;
  bg: string;
  arrow: string;
}

const DIRECTION_MAP: Record<PriceDirection, DirectionConfig> = {
  up: { color: COLORS.buyPrice, bg: COLORS.priceUpBg, arrow: '↑' },
  down: { color: COLORS.sellPrice, bg: COLORS.priceDownBg, arrow: '↓' },
  same: { color: COLORS.textDefault, bg: COLORS.priceSameBg, arrow: '' },
};

export function getDirectionConfig(direction: PriceDirection): DirectionConfig {
  return DIRECTION_MAP[direction];
}
