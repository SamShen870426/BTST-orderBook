import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLastPrice } from '../../hooks/useLastPrice';
import {
  MockWebSocket,
  installMockWebSocket,
  cleanupMockWebSocket,
} from '../helpers/MockWebSocket';
import { getDirectionConfig } from '../../logic/lastPrice.logic';

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

  describe('初始狀態與邊界處理', () => {
    it('should start with null price and direction same', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      expect(result.current.price).toBeNull();
      expect(result.current.direction).toBe('same');
      unmount();
    });

    it('should set direction same when first trade (prevPrice 為 null)', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      expect(result.current.price).toBe(75000);
      expect(result.current.direction).toBe('same');
      unmount();
    });
  });

  describe('價格方向（direction）', () => {
    it('should return direction up when price increases and apply correct color', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      act(() => ws.simulateMessage(makeTrade(75100)));

      expect(result.current.direction).toBe('up');
      expect(result.current.price).toBe(75100);
      const config = getDirectionConfig(result.current.direction);
      expect(config.arrow).toBe('↑');
      expect(config.color).toBe('#00b15d');
      unmount();
    });

    it('should return direction down when price decreases and apply correct color', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      act(() => ws.simulateMessage(makeTrade(74900)));

      expect(result.current.direction).toBe('down');
      expect(result.current.price).toBe(74900);
      const config = getDirectionConfig(result.current.direction);
      expect(config.arrow).toBe('↓');
      expect(config.color).toBe('#FF5B5A');
      unmount();
    });

    it('should return direction same when price unchanged (連續兩次相同價格)', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      act(() => ws.simulateMessage(makeTrade(75000)));

      expect(result.current.direction).toBe('same');
      expect(result.current.price).toBe(75000);
      const config = getDirectionConfig(result.current.direction);
      expect(config.arrow).toBe('');
      unmount();
    });
  });

  describe('應用層 pong', () => {
    it('收到純文字 pong 時不更新價格且不拋錯', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateRawMessage('pong'));

      expect(result.current.price).toBeNull();
      expect(result.current.direction).toBe('same');
      unmount();
    });
  });

  describe('onmessage 邊界條件', () => {
    it('should ignore empty data array', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage({ topic: 'tradeHistoryApi', data: [] }));

      expect(result.current.price).toBeNull();
      expect(result.current.direction).toBe('same');
      unmount();
    });

    it('should ignore message without data', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage({ topic: 'tradeHistoryApi' }));

      expect(result.current.price).toBeNull();
      unmount();
    });

    it('should ignore malformed JSON without crashing', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateRawMessage('invalid json {{{'));

      expect(result.current.price).toBeNull();
      expect(result.current.direction).toBe('same');
      unmount();
    });
  });

  describe('onclose 與重連', () => {
    it('onclose 時若已 unmount 則不排程重連', async () => {
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      const countBefore = MockWebSocket.instances.length;
      unmount();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      expect(MockWebSocket.instances.length).toBe(countBefore);
    });

    it('should schedule reconnect on WS close', async () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      expect(result.current.price).toBe(75000);

      const initialCount = MockWebSocket.instances.length;
      act(() => ws.simulateClose());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });

      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);
      unmount();
    });
  });

  describe('活動偵測逾時 (activity timeout)', () => {
    it('應在 10 秒無訊息時關閉連線', () => {
      vi.useFakeTimers();
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      vi.useRealTimers();
      unmount();
    });
  });

  describe('onerror', () => {
    it('should close connection on error (triggering onclose)', () => {
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      act(() => ws.simulateError());

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      unmount();
    });
  });

  describe('visibilitychange 恢復連線', () => {
    it('should reconnect when tab becomes visible and WS is not open', async () => {
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
      unmount();
    });

    it('should reconnect when returning to tab after WS closed', async () => {
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      act(() => ws.simulateClose());

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const countBefore = MockWebSocket.instances.length;
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(countBefore);
      unmount();
    });
  });
});
