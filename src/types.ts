export interface OrderBookWsMessage {
  topic: string;
  data: OrderBookData;
}

export interface OrderBookData {
  bids: [string, string][];
  asks: [string, string][];
  seqNum: number;
  prevSeqNum: number;
  type: 'snapshot' | 'delta';
  timestamp: number;
  symbol: string;
}

export interface TradeHistoryWsMessage {
  topic: string;
  data: TradeData[];
}

export interface TradeData {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  tradeId: number;
  timestamp: number;
}

export interface QuoteLevel {
  price: number;
  size: number;
  total: number;
}

export type PriceDirection = 'up' | 'down' | 'same';

export interface RowFlash {
  type: 'new-row' | 'size-up' | 'size-down';
  key: string;
}
