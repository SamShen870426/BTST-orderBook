import { memo, useEffect, useRef, useState } from 'react';
import type { QuoteLevel } from '../types';
import { formatNumber } from '../utils';
import { COLORS } from '../constants';

interface QuoteRowProps {
  quote: QuoteLevel;
  side: 'buy' | 'sell';
  barPercent: number;
  prevSize: number | undefined;
  isNew: boolean;
}

function QuoteRowInner({ quote, side, barPercent, prevSize, isNew }: QuoteRowProps) {
  const [rowFlashClass, setRowFlashClass] = useState('');
  const [sizeFlashClass, setSizeFlashClass] = useState('');
  const rowTimer = useRef<ReturnType<typeof setTimeout>>();
  const sizeTimer = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isNew) return;

    const cls = side === 'buy' ? 'flash-row-green' : 'flash-row-red';
    setRowFlashClass(cls);
    clearTimeout(rowTimer.current);
    rowTimer.current = setTimeout(() => setRowFlashClass(''), 600);
  }, [isNew, side]);

  useEffect(() => {
    if (prevSize === undefined || prevSize === quote.size) return;

    const cls = quote.size > prevSize ? 'flash-size-green' : 'flash-size-red';
    setSizeFlashClass(cls);
    clearTimeout(sizeTimer.current);
    sizeTimer.current = setTimeout(() => setSizeFlashClass(''), 600);
  }, [quote.size, prevSize]);

  useEffect(() => {
    return () => {
      clearTimeout(rowTimer.current);
      clearTimeout(sizeTimer.current);
    };
  }, []);

  const priceColor = side === 'buy' ? COLORS.buyPrice : COLORS.sellPrice;
  const barColor = side === 'buy' ? COLORS.buyBar : COLORS.sellBar;

  return (
    <div className={`quote-row ${rowFlashClass}`}>
      <div
        className="quote-bar"
        style={{
          width: `${barPercent}%`,
          backgroundColor: barColor,
        }}
      />
      <span className="quote-cell price" style={{ color: priceColor }}>
        {formatNumber(quote.price)}
      </span>
      <span className={`quote-cell size ${sizeFlashClass}`}>
        {formatNumber(quote.size)}
      </span>
      <span className="quote-cell total">{formatNumber(quote.total)}</span>
    </div>
  );
}

function areEqual(prev: QuoteRowProps, next: QuoteRowProps): boolean {
  return (
    prev.quote.price === next.quote.price &&
    prev.quote.size === next.quote.size &&
    prev.quote.total === next.quote.total &&
    prev.side === next.side &&
    prev.barPercent === next.barPercent &&
    prev.prevSize === next.prevSize &&
    prev.isNew === next.isNew
  );
}

export default memo(QuoteRowInner, areEqual);
