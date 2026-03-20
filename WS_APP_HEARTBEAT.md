# BTSE 應用層 Ping / Pong（本專案實作說明）

對照官方文件：客戶端送純文字 **`ping`**，伺服器回 **`pong`**。  
此為**應用層**字串，與 WebSocket **協定層** Ping/Pong 幀不同。

**實測**：訂單簿（`/ws/oss/futures`）與成交（`/ws/futures`）兩端皆會回 `pong`，故兩條連線**皆啟用心跳**；另設 `WS_ACTIVITY_TIMEOUT_MS`（10 秒無**任何** `onmessage` 則重連）作為補強（見 `LEARNING_GUIDE.md` §5.7）。

## Web 診斷頁（`/socket-health`）

- 路徑：**`/socket-health`**（與首頁共用同一組 WebSocket，由 `OrderBookRuntimeProvider` 掛在 Router 外，**切換路由不斷線**）。
- 顯示：協定 `readyState`、Throughput（每秒訊息數）、JS Heap（Chromium `performance.memory`）、最後收到訊息／pong／ping、Ping→Pong RTT 走勢圖（recharts `AreaChart`，路由 **lazy** 拆 chunk）、綠點 Pulse（200ms 輪詢 `inboundSeq` 觸發閃爍，非 60fps rAF）。畫面**每秒**自 `socketHealthStore` 讀快照；store 仍為 O(1) 寫入。
- 部署：若使用靜態託管，需將所有路徑 **fallback 到 `index.html`**（SPA），否則直接重新整理 `/socket-health` 可能 404。

## 程式位置

| 連線 | URL | Hook | Console 通道名稱 |
|------|-----|------|------------------|
| 訂單簿 | `wss://ws.btse.com/ws/oss/futures` | `useOrderBook` | `orderbook OSS (/ws/oss/futures)` |
| 成交價 | `wss://ws.btse.com/ws/futures` | `useLastPrice` | `futures trade (/ws/futures)` |

- 間隔：`src/ws/wsAppPingPong.ts` 的 `WS_APP_PING_INTERVAL_MS`（預設 25 秒）；**連線後會 `queueMicrotask` 立刻送第一次 ping**，之後每 25 秒一次（避免診斷圖長時間無 RTT 點）。
- 送出內容：純文字 `ping`（非 JSON）

## 如何驗證（瀏覽器 Console）

1. 執行 `npm run dev`，開啟頁面。
2. 開啟 DevTools → **Console**。
3. 篩選關鍵字：`BTSE WS`（可選）。
4. **成功時**約每 25 秒會看到：
   - `[BTSE WS][…] → 已送出 ping`
   - `[BTSE WS][…] ✓ 收到 pong（應用層 heartbeat 成功）`
5. 若**只有「已送出 ping」、沒有「收到 pong」**：請用 **Network → WS → Messages** 確認原始內容是否非純文字 `pong`（若格式不同需調整 `isWsAppPongMessage`）。

## 正式環境也要看日誌

在 `.env` 或建置環境變數設定：

```env
VITE_WS_PING_LOG=true
```

重新建置後，非 `dev` 模式也會輸出上述 `console.info`。

## 手動單連線測試（不依賴本專案）

在 Console 貼上（僅示範 **futures** 線；訂單簿請改 URL）：

```javascript
const u = 'wss://ws.btse.com/ws/futures';
const w = new WebSocket(u);
w.onopen = () => {
  console.log('open');
  w.send(JSON.stringify({ op: 'subscribe', args: ['tradeHistoryApi:BTCPFC'] }));
  w.send('ping');
};
w.onmessage = (e) => console.log('msg:', e.data);
```

若看到 `msg: pong`（或僅 `pong`），即應用層 heartbeat 正常。
