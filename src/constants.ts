export const WS_ORDERBOOK_URL = 'wss://ws.btse.com/ws/oss/futures';
export const WS_TRADE_URL = 'wss://ws.btse.com/ws/futures';

/** 兩條 WS 共用：長時間未收到任何 onmessage（含 pong／行情）則主動 close，觸發重連 */
export const WS_ACTIVITY_TIMEOUT_MS = 10_000;
export const ORDERBOOK_SYMBOL = 'BTCPFC';
export const TRADE_TOPIC = 'tradeHistoryApi:BTCPFC';
export const MAX_DISPLAY_ROWS = 8;

export const GROUPING_OPTIONS = [
  { level: 0, label: '0.1', step: 0.1 },
  { level: 1, label: '0.5', step: 0.5 },
  { level: 2, label: '1', step: 1 },
  { level: 3, label: '5', step: 5 },
  { level: 4, label: '10', step: 10 },
] as const;

export function getOrderBookTopic(groupLevel: number): string {
  return `update:${ORDERBOOK_SYMBOL}_${groupLevel}`;
}

export const COLORS = {
  bg: '#131B29',
  textDefault: '#F0F4F8',
  textHead: '#8698aa',
  buyPrice: '#00b15d',
  sellPrice: '#FF5B5A',
  hoverBg: '#1E3059',
  buyBar: 'rgba(16, 186, 104, 0.12)',
  sellBar: 'rgba(255, 90, 90, 0.12)',
  flashGreen: 'rgba(0, 177, 93, 0.5)',
  flashRed: 'rgba(255, 91, 90, 0.5)',
  priceUpBg: 'rgba(16, 186, 104, 0.12)',
  priceDownBg: 'rgba(255, 90, 90, 0.12)',
  priceSameBg: 'rgba(134, 152, 170, 0.12)',
} as const;
