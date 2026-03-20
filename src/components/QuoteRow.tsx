import { memo, useEffect, useRef, useState } from 'react';
import { formatNumber } from '../utils';
import { COLORS } from '../constants';
import { areEqual, getRowFlashClass, getSizeFlashClass } from '../logic/quoteRow.logic';
import type { QuoteRowProps } from '../logic/quoteRow.logic';
import * as S from '../styles/quoteRow.style';
import type { FlashName } from '../styles/quoteRow.style';

function QuoteRowInner({ quote, side, barPercent, prevSize, isNew }: QuoteRowProps) {
  const [rowFlash, setRowFlash] = useState<FlashName>('');
  const [sizeFlash, setSizeFlash] = useState<FlashName>('');
  const rowTimer = useRef<ReturnType<typeof setTimeout>>();
  const sizeTimer = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isNew) return;

    setRowFlash(getRowFlashClass(side));
    clearTimeout(rowTimer.current);
    rowTimer.current = setTimeout(() => setRowFlash(''), 600);
  }, [isNew, side]);

  useEffect(() => {
    const cls = getSizeFlashClass(quote.size, prevSize);
    if (!cls) return;

    setSizeFlash(cls);
    clearTimeout(sizeTimer.current);
    sizeTimer.current = setTimeout(() => setSizeFlash(''), 600);
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
    <S.Row $flash={rowFlash}>
      <S.PriceCell $color={priceColor}>{formatNumber(quote.price)}</S.PriceCell>
      <S.SizeCell $flash={sizeFlash}>{formatNumber(quote.size)}</S.SizeCell>
      <S.TotalCellWrapper>
        <S.Bar $width={barPercent} $color={barColor} />
        <S.TotalCell>{formatNumber(quote.total)}</S.TotalCell>
      </S.TotalCellWrapper>
    </S.Row>
  );
}

export default memo(QuoteRowInner, areEqual);
