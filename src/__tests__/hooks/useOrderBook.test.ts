import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useOrderBook } from '../../hooks/useOrderBook';
import {
  MockWebSocket,
  installMockWebSocket,
  cleanupMockWebSocket,
} from '../helpers/MockWebSocket';
import { MAX_DISPLAY_ROWS } from '../../constants';

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

/** 產生大量價位，用於驗證裁剪邏輯 */
function makeManyLevels(count: number, basePrice: number, step: number): [string, string][] {
  return Array.from({ length: count }, (_, i) => [
    String(basePrice + i * step),
    String(10 + i),
  ]) as [string, string][];
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
    const { result, unmount } = renderHook(() => useOrderBook());
    expect(result.current.status).toBe('connecting');
    unmount();
  });

  it('should become connected after WS opens', () => {
    const { result, unmount } = renderHook(() => useOrderBook());
    act(() => MockWebSocket.latest.simulateOpen());
    expect(result.current.status).toBe('connected');
    unmount();
  });

  it('should have asks/bids after snapshot', () => {
    const { result, unmount } = renderHook(() => useOrderBook());
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
    const { result, unmount } = renderHook(() => useOrderBook());
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
    const { result, unmount } = renderHook(() => useOrderBook());
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
    const { unmount } = renderHook(() => useOrderBook());
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
    const { result, unmount } = renderHook(() => useOrderBook());
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    act(() => ws.simulateClose());

    expect(result.current.status).toBe('disconnected');
    unmount();
  });

  // ─── 金融級場景測試 ─────────────────────────────────────────────

  describe('seqNum 連續性驗證', () => {
    it('應在 seqNum 不連續時觸發 resubscribe（例：100 跳至 102，遺失 101）', () => {
      const { unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 100));
      });

      ws.sentMessages = [];
      act(() => {
        ws.simulateMessage(makeDelta([['100', '12']], [], 102, 99));
      });

      const unsub = ws.sentMessages.find((m) => m.includes('unsubscribe'));
      expect(unsub).toBeDefined();
      unmount();
    });

    it('應在 prevSeqNum 與 lastSeqNum 不符時觸發 resubscribe', () => {
      const { unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
      });

      ws.sentMessages = [];
      act(() => {
        ws.simulateMessage(makeDelta([['100', '15']], [], 5, 3));
      });

      const unsub = ws.sentMessages.find((m) => m.includes('unsubscribe'));
      expect(unsub).toBeDefined();
      unmount();
    });
  });

  describe('Action 類型：snapshot (partial) vs delta (update)', () => {
    it('snapshot 應清空 Map 並完全覆蓋（partial 行為）', async () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(
          makeSnapshot([['100', '10'], ['99', '5']], [['101', '20'], ['102', '30']], 1)
        );
      });

      expect(result.current.bids.length).toBe(2);
      expect(result.current.asks.length).toBe(2);
      expect(result.current.bids[0]!.price).toBe(100);

      act(() => {
        ws.simulateMessage(
          makeSnapshot([['98', '50'], ['97', '25']], [['103', '40'], ['104', '60']], 2)
        );
      });

      expect(result.current.bids[0]!.price).toBe(98);
      expect(result.current.bids[1]!.price).toBe(97);
      expect(result.current.asks[0]!.price).toBe(104);
      expect(result.current.asks[1]!.price).toBe(103);
      expect(result.current.bids.some((b) => b.price === 100)).toBe(false);
      unmount();
    });

    it('delta 應增量更新，保留未變動價位', async () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(
          makeSnapshot([['100', '10'], ['99', '5']], [['101', '20'], ['102', '30']], 1)
        );
      });

      act(() => {
        ws.simulateMessage(makeDelta([['100', '25']], [], 2, 1));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(result.current.bids[0]!.price).toBe(100);
      expect(result.current.bids[0]!.size).toBe(25);
      expect(result.current.bids[1]!.price).toBe(99);
      expect(result.current.bids[1]!.size).toBe(5);
      unmount();
    });
  });

  describe('數據裁剪 (Slicing)', () => {
    it('bids/asks 超過 limit 時應只顯示 MAX_DISPLAY_ROWS 筆', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      const manyBids = makeManyLevels(20, 100, -1);
      const manyAsks = makeManyLevels(20, 101, 1);

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot(manyBids, manyAsks, 1));
      });

      expect(result.current.bids.length).toBe(MAX_DISPLAY_ROWS);
      expect(result.current.asks.length).toBe(MAX_DISPLAY_ROWS);
      expect(result.current.bids.length).toBeLessThanOrEqual(20);
      unmount();
    });

    it('crossed orderbook（bestBid >= bestAsk）時應觸發 resubscribe', () => {
      const { unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
      });

      ws.sentMessages = [];
      act(() => {
        ws.simulateMessage(makeDelta([['101', '5']], [['100', '10']], 2, 1));
      });

      const unsub = ws.sentMessages.find((m) => m.includes('unsubscribe'));
      expect(unsub).toBeDefined();
      unmount();
    });
  });

  describe('Snapshot Buffer 回放', () => {
    it('應在收到新 snapshot 後正確回放空窗期暫存的 delta', async () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
      });

      act(() => {
        ws.simulateMessage(makeDelta([], [], 5, 3));
      });
      act(() => {
        ws.simulateMessage(makeDelta([['100', '25']], [], 3, 2));
      });
      act(() => {
        ws.simulateMessage(makeDelta([['100', '99']], [], 4, 3));
      });
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 2));
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(result.current.bids[0]!.price).toBe(100);
      expect(result.current.bids[0]!.size).toBe(99);
      unmount();
    });
  });

  describe('活動偵測逾時 (activity timeout)', () => {
    it('應在 10 秒無訊息時關閉連線', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1)));

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      expect(result.current.status).toBe('disconnected');
      vi.useRealTimers();
      unmount();
    });
  });

  describe('resubscribe 200ms 後 subscribe', () => {
    it('應在 resubscribe 後 200ms 送出 subscribe', async () => {
      const { unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
      });
      ws.sentMessages = [];
      act(() => {
        ws.simulateMessage(makeDelta([], [], 5, 3));
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
      });

      const sub = ws.sentMessages.find((m) => m.includes('subscribe'));
      expect(sub).toBeDefined();
      unmount();
    });
  });

  describe('visibilitychange 恢復連線', () => {
    it('應在 tab 變為 visible 且 WS 非 OPEN 時重新 connect', async () => {
      const { unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1)));
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

      expect(MockWebSocket.instances.length).toBeGreaterThan(countBefore);
      unmount();
    });
  });

  describe('onerror', () => {
    it('應在 onerror 時關閉連線', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1)));

      act(() => ws.simulateError());

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      expect(result.current.status).toBe('disconnected');
      unmount();
    });
  });

  describe('空數據防禦', () => {
    it('msg.data 為 null 時不應崩潰', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage({ topic: 'update:BTCPFC_0', data: null });
      });

      expect(result.current.asks).toEqual([]);
      expect(result.current.bids).toEqual([]);
      unmount();
    });

    it('msg.data 無 type 時不應崩潰', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage({
          topic: 'update:BTCPFC_0',
          data: { bids: [], asks: [], seqNum: 1, prevSeqNum: 0, symbol: 'BTCPFC', timestamp: 0 },
        });
      });

      expect(result.current.asks).toEqual([]);
      expect(result.current.bids).toEqual([]);
      unmount();
    });

    it('snapshot 傳回空 bids/asks 時應正確清空', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateMessage(makeSnapshot([['100', '10']], [['101', '20']], 1));
      });
      expect(result.current.bids.length).toBe(1);

      act(() => {
        ws.simulateMessage(makeSnapshot([], [], 2));
      });
      expect(result.current.bids).toEqual([]);
      expect(result.current.asks).toEqual([]);
      unmount();
    });

    it('malformed JSON 不應導致 Hook 崩潰', () => {
      const { result, unmount } = renderHook(() => useOrderBook());
      const ws = MockWebSocket.latest;

      act(() => ws.simulateOpen());
      act(() => {
        ws.simulateRawMessage('invalid json {{{');
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.asks).toEqual([]);
      expect(result.current.bids).toEqual([]);
      unmount();
    });
  });
});
