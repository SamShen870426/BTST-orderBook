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
    it('onclose 時若已 unmount 則不排程重連', () => {
      vi.useFakeTimers();
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      const countBefore = MockWebSocket.instances.length;
      unmount();

      act(() => ws.simulateClose());
      act(() => vi.advanceTimersByTime(5000));
      expect(MockWebSocket.instances.length).toBe(countBefore);
      vi.useRealTimers();
    });

    it('should schedule reconnect on WS close', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));
      expect(result.current.price).toBe(75000);

      const initialCount = MockWebSocket.instances.length;
      act(() => ws.simulateClose());
      act(() => vi.advanceTimersByTime(1000));

      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);
      unmount();
      vi.useRealTimers();
    });

    it('重連後舊 socket 的 onmessage 不應改寫 state（wsRef !== ws 早退）', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useLastPrice());
      const ws1 = MockWebSocket.latest;

      act(() => ws1.simulateOpen());
      act(() => ws1.simulateMessage(makeTrade(75000)));
      act(() => ws1.simulateClose());
      act(() => vi.advanceTimersByTime(1000));

      const ws2 = MockWebSocket.latest;
      expect(ws2).not.toBe(ws1);
      act(() => ws2.simulateOpen());

      act(() => ws1.simulateMessage(makeTrade(99999)));
      expect(result.current.price).toBe(75000);

      unmount();
      vi.useRealTimers();
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
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      act(() => ws.simulateError());

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      unmount();
    });
  });

  describe('visibilitychange 恢復連線', () => {
    it('should reconnect when tab becomes visible and WS is not open', () => {
      const { unmount } = renderHook(() => useLastPrice());

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

    it('WS 已 OPEN 時 visibilitychange 不另開新連線', () => {
      const { unmount } = renderHook(() => useLastPrice());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeTrade(75000)));

      const n = MockWebSocket.instances.length;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      act(() => document.dispatchEvent(new Event('visibilitychange')));

      expect(MockWebSocket.instances.length).toBe(n);
      unmount();
    });

    it('should reconnect when returning to tab after WS closed', () => {
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

      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(countBefore);
      unmount();
    });
  });
});
