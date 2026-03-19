import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useOrderBook } from '../../hooks/useOrderBook';
import {
  MockWebSocket,
  installMockWebSocket,
  cleanupMockWebSocket,
} from '../helpers/MockWebSocket';

function makeSnapshot(bids: [string, string][], asks: [string, string][], seqNum = 1) {
  return {
    topic: 'update:BTCPFC_0',
    data: {
      bids,
      asks,
      seqNum,
      prevSeqNum: seqNum - 1,
      type: 'snapshot' as const,
      timestamp: Date.now(),
      symbol: 'BTCPFC',
    },
  };
}

function makeDelta(
  bids: [string, string][],
  asks: [string, string][],
  seqNum: number,
  prevSeqNum: number
) {
  return {
    topic: 'update:BTCPFC_0',
    data: {
      bids,
      asks,
      seqNum,
      prevSeqNum,
      type: 'delta' as const,
      timestamp: Date.now(),
      symbol: 'BTCPFC',
    },
  };
}

describe('useOrderBook', () => {
  beforeEach(() => {
    installMockWebSocket();
  });

  afterEach(() => {
    cleanup();
    cleanupMockWebSocket();
  });

  it('should start with connecting status', () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    expect(result.current.status).toBe('connecting');
    unmount();
  });

  it('should become connected after WS opens', () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    act(() => MockWebSocket.latest.simulateOpen());
    expect(result.current.status).toBe('connected');
    unmount();
  });

  it('should have asks/bids after snapshot', () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => {
      ws.simulateMessage(
        makeSnapshot(
          [['100', '10'], ['99', '5']],
          [['101', '20'], ['102', '30']],
          1
        )
      );
    });

    expect(result.current.asks.length).toBe(2);
    expect(result.current.bids.length).toBe(2);
    expect(result.current.asks[0]!.price).toBe(102);
    expect(result.current.bids[0]!.price).toBe(100);
    unmount();
  });

  it('should update data after delta', async () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => {
      ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
    });
    act(() => {
      ws.simulateMessage(makeDelta([['100', '15']], [], 2, 1));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(result.current.bids[0]!.size).toBe(15);
    unmount();
  });

  it('should remove price level when delta size is 0', async () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => {
      ws.simulateMessage(
        makeSnapshot([['100', '10'], ['99', '5']], [['101', '20']], 1)
      );
    });
    act(() => {
      ws.simulateMessage(makeDelta([['100', '0']], [], 2, 1));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(result.current.bids.length).toBe(1);
    expect(result.current.bids[0]!.price).toBe(99);
    unmount();
  });

  it('should resubscribe on seqNum mismatch', () => {
    const { unmount } = renderHook(() => useOrderBook(0));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => {
      ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
    });

    ws.sentMessages = [];
    act(() => {
      ws.simulateMessage(makeDelta([], [], 5, 3));
    });

    const unsub = ws.sentMessages.find((m) => m.includes('unsubscribe'));
    expect(unsub).toBeDefined();
    unmount();
  });

  it('should set disconnected status on WS close', () => {
    const { result, unmount } = renderHook(() => useOrderBook(0));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateClose());

    expect(result.current.status).toBe('disconnected');
    unmount();
  });

  it('should switch topic when groupLevel changes', () => {
    const { unmount, rerender } = renderHook(
      ({ level }: { level: number }) => useOrderBook(level),
      { initialProps: { level: 0 } }
    );
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());

    ws.sentMessages = [];
    rerender({ level: 2 });

    const unsub = ws.sentMessages.find((m) => m.includes('unsubscribe') && m.includes('BTCPFC_0'));
    const sub = ws.sentMessages.find((m) => m.includes('subscribe') && m.includes('BTCPFC_2'));
    expect(unsub).toBeDefined();
    expect(sub).toBeDefined();
    unmount();
  });
});
