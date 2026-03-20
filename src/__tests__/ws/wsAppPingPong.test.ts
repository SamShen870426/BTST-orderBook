import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isWsAppPongMessage,
  WS_APP_PING_INTERVAL_MS,
  WS_APP_PING_TEXT,
  startWsAppPingInterval,
} from '../../ws/wsAppPingPong';
import { MockWebSocket, installMockWebSocket, cleanupMockWebSocket } from '../helpers/MockWebSocket';

describe('isWsAppPongMessage', () => {
  it('accepts plain pong', () => {
    expect(isWsAppPongMessage('pong')).toBe(true);
  });

  it('accepts pong with surrounding whitespace', () => {
    expect(isWsAppPongMessage('  pong  ')).toBe(true);
  });

  it('rejects non-string', () => {
    expect(isWsAppPongMessage(null)).toBe(false);
    expect(isWsAppPongMessage({})).toBe(false);
  });

  it('rejects other strings', () => {
    expect(isWsAppPongMessage('ping')).toBe(false);
    expect(isWsAppPongMessage('{"topic":"x"}')).toBe(false);
  });
});

describe('logWsAppPingPong（需啟用日誌旗標才會 console）', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WS_PING_LOG', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logWsAppPongReceived 在 VITE_WS_PING_LOG=true 時會呼叫 console.info', async () => {
    vi.resetModules();
    const { logWsAppPongReceived } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPongReceived('test-channel');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain('test-channel');
    expect(String(spy.mock.calls[0]?.[0])).toContain('pong');
  });

  it('logWsAppPingSent 在 VITE_WS_PING_LOG=true 時會呼叫 console.info', async () => {
    vi.resetModules();
    const { logWsAppPingSent } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPingSent('test-channel');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain('ping');
  });
});

/** 覆蓋 `import.meta.env.DEV` 為 false 時改走 VITE_WS_PING_LOG 的短路分支 */
describe('shouldLogWsPingPong（DEV=false 時的 OR 右側）', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('PROD + VITE_WS_PING_LOG=true 時 logWsAppPongReceived 仍會 console', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_WS_PING_LOG', 'true');
    vi.resetModules();
    const { logWsAppPongReceived } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPongReceived('prod-ch');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('PROD + VITE_WS_PING_LOG=true 時 logWsAppPingSent 仍會 console', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_WS_PING_LOG', 'true');
    vi.resetModules();
    const { logWsAppPingSent } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPingSent('prod-ch');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('PROD 且未開日誌旗標時 logWsAppPongReceived 不呼叫 console', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_WS_PING_LOG', 'false');
    vi.resetModules();
    const { logWsAppPongReceived } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPongReceived('silent');
    expect(spy).not.toHaveBeenCalled();
  });

  it('PROD 且未開日誌旗標時 logWsAppPingSent 不呼叫 console', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_WS_PING_LOG', 'false');
    vi.resetModules();
    const { logWsAppPingSent } = await import('../../ws/wsAppPingPong');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWsAppPingSent('silent');
    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * 不以 fake timers 快轉 25s：Vitest 對 setInterval 的 advance 可能長時間迴圈。
 * 改為攔截 setInterval，手動觸發 tick（等同「某一週期到期」），零額外延遲、不影響產品效能。
 */
describe('startWsAppPingInterval', () => {
  let intervalHandler: (() => void) | undefined;
  let intervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    installMockWebSocket();
    intervalHandler = undefined;
    intervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation((fn: TimerHandler) => {
      intervalHandler = typeof fn === 'function' ? (fn as () => void) : () => {};
      return 777 as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {
      intervalHandler = undefined;
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupMockWebSocket();
    vi.restoreAllMocks();
  });

  function firePingTick(): void {
    intervalHandler?.();
  }

  it('週期邏輯：OPEN 時 tick 會送出 ping', () => {
    const ws = new MockWebSocket('ws://test');
    ws.simulateOpen();
    const dispose = startWsAppPingInterval(ws, 'ch');
    expect(ws.sentMessages).toHaveLength(0);
    firePingTick();
    expect(ws.sentMessages).toContain(WS_APP_PING_TEXT);
    dispose();
  });

  it('連線非 OPEN 時 tick 不送 ping', () => {
    const ws = new MockWebSocket('ws://test');
    const dispose = startWsAppPingInterval(ws, 'ch');
    firePingTick();
    expect(ws.sentMessages).toHaveLength(0);
    dispose();
  });

  it('send 拋錯時 tick 不拋出（try/catch）', () => {
    const ws = new MockWebSocket('ws://test');
    ws.simulateOpen();
    vi.spyOn(ws, 'send').mockImplementation(() => {
      throw new Error('send failed');
    });
    const dispose = startWsAppPingInterval(ws, 'ch');
    expect(() => firePingTick()).not.toThrow();
    dispose();
  });

  it('dispose 後 clearInterval，再觸發 tick 不應再送', () => {
    const ws = new MockWebSocket('ws://test');
    ws.simulateOpen();
    const dispose = startWsAppPingInterval(ws, 'ch');
    firePingTick();
    const n = ws.sentMessages.filter((m) => m === WS_APP_PING_TEXT).length;
    dispose();
    expect(intervalHandler).toBeUndefined();
    firePingTick();
    expect(ws.sentMessages.filter((m) => m === WS_APP_PING_TEXT).length).toBe(n);
  });

  it('使用官方 ping 間隔常數註冊 setInterval', () => {
    const ws = new MockWebSocket('ws://test');
    ws.simulateOpen();
    const dispose = startWsAppPingInterval(ws, 'ch');
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), WS_APP_PING_INTERVAL_MS);
    dispose();
  });
});
