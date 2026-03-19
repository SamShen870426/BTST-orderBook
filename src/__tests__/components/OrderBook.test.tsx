import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import OrderBook from '../../components/OrderBook';
import {
  MockWebSocket,
  installMockWebSocket,
  cleanupMockWebSocket,
} from '../helpers/MockWebSocket';

function makeSnapshot() {
  return {
    topic: 'update:BTCPFC_0',
    data: {
      bids: [['100', '10'], ['99', '5']] as [string, string][],
      asks: [['101', '20'], ['102', '30']] as [string, string][],
      seqNum: 1,
      prevSeqNum: 0,
      type: 'snapshot' as const,
      timestamp: Date.now(),
      symbol: 'BTCPFC',
    },
  };
}

function makeTrade(price: number) {
  return {
    topic: 'tradeHistoryApi',
    data: [
      { symbol: 'BTCPFC', side: 'BUY', size: 0.001, price, tradeId: 1, timestamp: Date.now() },
    ],
  };
}

describe('OrderBook (Container Integration)', () => {
  beforeEach(() => {
    installMockWebSocket();
  });

  afterEach(() => {
    cleanup();
    cleanupMockWebSocket();
  });

  it('should show Order Book header', () => {
    render(<OrderBook />);
    expect(screen.getAllByText('Order Book').length).toBeGreaterThanOrEqual(1);
  });

  it('should show loading state initially', () => {
    render(<OrderBook />);
    expect(screen.getAllByText('Loading order book...').length).toBeGreaterThanOrEqual(1);
  });

  it('should render order book data after WS snapshot', () => {
    render(<OrderBook />);

    act(() => {
      for (const ws of MockWebSocket.instances) {
        if (ws.url.includes('oss')) {
          ws.simulateOpen();
          ws.simulateMessage(makeSnapshot());
        }
        if (ws.url.includes('/futures') && !ws.url.includes('oss')) {
          ws.simulateOpen();
          ws.simulateMessage(makeTrade(100.5));
        }
      }
    });

    expect(screen.getAllByText('102').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('99').length).toBeGreaterThanOrEqual(1);
  });
});
