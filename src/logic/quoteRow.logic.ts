import type { QuoteLevel } from '../types';
import type { FlashName } from '../styles/quoteRow.style';

export interface QuoteRowProps {
  quote: QuoteLevel;
  side: 'buy' | 'sell';
  barPercent: number;
  prevSize: number | undefined;
  isNew: boolean;
}

export function areEqual(prev: QuoteRowProps, next: QuoteRowProps): boolean {
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

export function getRowFlashClass(side: 'buy' | 'sell'): FlashName {
  return side === 'buy' ? 'flash-row-green' : 'flash-row-red';
}

export function getSizeFlashClass(
  currentSize: number,
  prevSize: number | undefined
): FlashName {
  if (prevSize === undefined || prevSize === currentSize) return '';
  return currentSize > prevSize ? 'flash-size-green' : 'flash-size-red';
}
