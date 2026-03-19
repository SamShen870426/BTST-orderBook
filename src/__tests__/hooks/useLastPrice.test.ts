import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLastPrice } from '../../hooks/useLastPrice';
import {
  MockWebSocket,
  installMockWebSocket,
  cleanupMockWebSocket,
} from '../helpers/MockWebSocket';

function makeTrade(price: number) {
  return {
    topic: 'tradeHistoryApi',
    data: [
      {
        symbol: 'BTCPFC',
        side: 'BUY',
        size: 0.001,
        price,
        tradeId: Date.now(),
        timestamp: Date.now(),
      },
    ],
  };
}

describe('useLastPrice', () => {
  beforeEach(() => {
    installMockWebSocket();
  });

  afterEach(() => {
    cleanup();
    cleanupMockWebSocket();
  });

  it('should start with null price', () => {
    const { result, unmount } = renderHook(() => useLastPrice());
    expect(result.current.price).toBeNull();
    expect(result.current.direction).toBe('same');
    unmount();
  });

  it('should update price after trade message', () => {
    const { result, unmount } = renderHook(() => useLastPrice());
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(makeTrade(75000)));

    expect(result.current.price).toBe(75000);
    unmount();
  });

  it('should return direction up when price increases', () => {
    const { result, unmount } = renderHook(() => useLastPrice());
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(makeTrade(75000)));
    act(() => ws.simulateMessage(makeTrade(75100)));

    expect(result.current.direction).toBe('up');
    unmount();
  });

  it('should return direction down when price decreases', () => {
    const { result, unmount } = renderHook(() => useLastPrice());
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(makeTrade(75000)));
    act(() => ws.simulateMessage(makeTrade(74900)));

    expect(result.current.direction).toBe('down');
    unmount();
  });

  it('should return direction same when price unchanged', () => {
    const { result, unmount } = renderHook(() => useLastPrice());
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(makeTrade(75000)));
    act(() => ws.simulateMessage(makeTrade(75000)));

    expect(result.current.direction).toBe('same');
    unmount();
  });
});
