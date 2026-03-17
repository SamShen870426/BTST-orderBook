export const WS_ORDERBOOK_URL = 'wss://ws.btse.com/ws/oss/futures';
export const WS_TRADE_URL = 'wss://ws.btse.com/ws/futures';
export const ORDERBOOK_TOPIC = 'update:BTCPFC_0';
export const TRADE_TOPIC = 'tradeHistoryApi:BTCPFC';
export const MAX_DISPLAY_ROWS = 8;

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
