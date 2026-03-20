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
  /** 深度條寬度百分比：當前行 total / 分母（買賣兩側 8 筆累計總量取較大者），由 applyDepthBarPercent 計算 */
  barPercent: number;
}

export type PriceDirection = 'up' | 'down' | 'same';

export interface RowFlash {
  type: 'new-row' | 'size-up' | 'size-down';
  key: string;
}
