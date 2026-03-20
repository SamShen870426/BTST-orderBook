/**
 * BTSE 應用層 heartbeat（見官方 WebSocket 文件）：
 * 客戶端送純文字 `ping`，伺服器回 `pong`。
 * 與 WebSocket 協定層 Ping/Pong「幀」不同（瀏覽器會自動處理後者）。
 */

export const WS_APP_PING_INTERVAL_MS = 25_000;
export const WS_APP_PING_TEXT = 'ping';

function shouldLogWsPingPong(): boolean {
  if (import.meta.env.DEV) return true;
  return (
    typeof import.meta.env.VITE_WS_PING_LOG === 'string' &&
    import.meta.env.VITE_WS_PING_LOG === 'true'
  );
}

/** 判斷是否為應用層 pong（純文字或帶空白） */
export function isWsAppPongMessage(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const t = data.trim();
  return t === 'pong';
}

export function logWsAppPingSent(channel: string): void {
  if (shouldLogWsPingPong()) {
    console.info(`[BTSE WS][${channel}] → 已送出 ping`);
  }
}

export function logWsAppPongReceived(channel: string): void {
  if (shouldLogWsPingPong()) {
    console.info(`[BTSE WS][${channel}] ✓ 收到 pong（應用層 heartbeat 成功）`);
  }
}

export interface WsAppPingIntervalOptions {
  /** 每次嘗試送出 ping 後呼叫（不含 readyState 非 OPEN 的略過）；供診斷頁等 O(1) 記錄用 */
  onPingSent?: () => void;
}

/**
 * 週期送出 ping。請在 onclose / 換線時呼叫回傳的 dispose。
 */
export function startWsAppPingInterval(
  ws: WebSocket,
  channel: string,
  opts?: WsAppPingIntervalOptions
): () => void {
  const tick = () => {
    if (ws.readyState === WebSocket.OPEN) {
      logWsAppPingSent(channel);
      opts?.onPingSent?.();
      try {
        ws.send(WS_APP_PING_TEXT);
      } catch {
        /* ignore */
      }
    }
  };
  const id = window.setInterval(tick, WS_APP_PING_INTERVAL_MS);
  /** 連線後盡快送第一次 ping（原先僅 setInterval，首包需等 25s，診斷圖會長時間空白） */
  queueMicrotask(tick);
  return () => window.clearInterval(id);
}
