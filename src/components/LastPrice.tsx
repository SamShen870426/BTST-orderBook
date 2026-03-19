import { memo } from 'react';
import type { PriceDirection } from '../types';
import { formatNumber } from '../utils';
import { getDirectionConfig } from '../logic/lastPrice.logic';
import * as S from '../styles/lastPrice.style';

interface LastPriceProps {
  price: number | null;
  direction: PriceDirection;
}

function LastPriceInner({ price, direction }: LastPriceProps) {
  const config = getDirectionConfig(direction);

  if (price === null) {
    return <S.Container $bg={config.bg}>--</S.Container>;
  }

  return (
    <S.Container $bg={config.bg}>
      <S.PriceValue $color={config.color}>
        {formatNumber(price)}
        {config.arrow && <S.Arrow> {config.arrow}</S.Arrow>}
      </S.PriceValue>
    </S.Container>
  );
}

export default memo(LastPriceInner);
