import { createContext, useContext, type ReactNode } from 'react';
import { useOrderBook, type OrderBookState } from '../hooks/useOrderBook';
import { useLastPrice, type LastPriceState } from '../hooks/useLastPrice';

export interface OrderBookRuntimeValue {
  orderBook: OrderBookState;
  lastPrice: LastPriceState;
}

const OrderBookRuntimeContext = createContext<OrderBookRuntimeValue | null>(null);

/**
 * 掛在 Router 內、Routes 外，使 `/` 與 `/socket-health` 共用同一組 WebSocket，切換路由不斷線。
 */
export function OrderBookRuntimeProvider({ children }: { children: ReactNode }) {
  const orderBook = useOrderBook();
  const lastPrice = useLastPrice();
  return (
    <OrderBookRuntimeContext.Provider value={{ orderBook, lastPrice }}>
      {children}
    </OrderBookRuntimeContext.Provider>
  );
}

export function useOrderBookRuntime(): OrderBookRuntimeValue {
  const v = useContext(OrderBookRuntimeContext);
  if (!v) {
    throw new Error('useOrderBookRuntime must be used within OrderBookRuntimeProvider');
  }
  return v;
}
