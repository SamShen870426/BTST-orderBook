import { memo } from 'react';
import type { PriceDirection } from '../types';
import { formatNumber } from '../utils';
import { COLORS } from '../constants';

interface LastPriceProps {
  price: number | null;
  direction: PriceDirection;
}

const directionConfig = {
  up: { color: COLORS.buyPrice, bg: COLORS.priceUpBg, arrow: '↑' },
  down: { color: COLORS.sellPrice, bg: COLORS.priceDownBg, arrow: '↓' },
  same: { color: COLORS.textDefault, bg: COLORS.priceSameBg, arrow: '' },
} as const;

function LastPriceInner({ price, direction }: LastPriceProps) {
  if (price === null) {
    return <div className="last-price-container">--</div>;
  }

  const config = directionConfig[direction];

  return (
    <div className="last-price-container" style={{ backgroundColor: config.bg }}>
      <span className="last-price-value" style={{ color: config.color }}>
        {formatNumber(price)}
        {config.arrow && <span className="last-price-arrow"> {config.arrow}</span>}
      </span>
    </div>
  );
}

export default memo(LastPriceInner);
