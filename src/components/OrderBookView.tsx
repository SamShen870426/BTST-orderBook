import type { QuoteLevel, PriceDirection } from '../types';
import type { ConnectionStatus } from '../hooks/useOrderBook';
import QuoteRow from './QuoteRow';
import LastPrice from './LastPrice';
import { Spinner, StatusBadge } from '../styles/common.style';
import * as S from '../styles/orderBook.style';
import * as Q from '../styles/quoteRow.style';

interface QuoteRowData {
  quote: QuoteLevel;
  side: 'buy' | 'sell';
  barPercent: number;
  prevSize: number | undefined;
  isNew: boolean;
}

interface OrderBookViewProps {
  askRows: QuoteRowData[];
  bidRows: QuoteRowData[];
  lastPrice: number | null;
  lastPriceDirection: PriceDirection;
  status: ConnectionStatus;
}

export default function OrderBookView({
  askRows,
  bidRows,
  lastPrice,
  lastPriceDirection,
  status,
}: OrderBookViewProps) {
  const isLoading = status === 'connecting' && askRows.length === 0;
  const isDisconnected = status === 'disconnected';

  return (
    <S.Wrapper>
      <S.Header>
        <S.HeaderLeft>
          <span>Order Book</span>
        </S.HeaderLeft>
        <S.HeaderRight>
          {isDisconnected && (
            <StatusBadge $variant="disconnected">Reconnecting...</StatusBadge>
          )}
          {status === 'connecting' && askRows.length > 0 && (
            <StatusBadge $variant="connecting">Connecting...</StatusBadge>
          )}
        </S.HeaderRight>
      </S.Header>

      {isLoading ? (
        <S.LoadingContainer>
          <Spinner />
          <S.LoadingText>Loading order book...</S.LoadingText>
        </S.LoadingContainer>
      ) : (
        <>
          <S.TableHead>
            <Q.HeadPriceCell>Price (USD)</Q.HeadPriceCell>
            <Q.HeadSizeCell>Size</Q.HeadSizeCell>
            <Q.HeadTotalCell>Total</Q.HeadTotalCell>
          </S.TableHead>
          <S.QuoteSection $stale={isDisconnected}>
            {askRows.map((row) => (
              <QuoteRow key={row.quote.price} {...row} />
            ))}
          </S.QuoteSection>
          <LastPrice price={lastPrice} direction={lastPriceDirection} />
          <S.QuoteSection $stale={isDisconnected}>
            {bidRows.map((row) => (
              <QuoteRow key={row.quote.price} {...row} />
            ))}
          </S.QuoteSection>
        </>
      )}
    </S.Wrapper>
  );
}
