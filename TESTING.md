# Order Book — 測試指南

> 本專案採用 **分層測試架構**，對應 logic / hooks / components（及 runtime context）。目前共定義 **131** 個案例：**124** 個預設執行且通過，**7** 個以 `describe.skip` 略過（`/socket-health` 診斷相關，見 **[TEST.md](./TEST.md)** §5）。覆蓋率請執行 `npm run test:coverage`；**ping/pong 與刻意不全測的效能權衡**亦見 **[TEST.md](./TEST.md)**。

---

## 1. 快速開始：如何執行測試

### 指令

```bash
# 執行全部測試（單次）
npm test

# 含 v8 覆蓋率（文字 + html）
npm run test:coverage

# 監聽模式：檔案變動時自動重跑
npm run test:watch
```

### 環境需求

- Node.js 20.10+（專案使用 Volta 鎖定版本）
- 已執行 `npm install`

### 預期輸出（節錄）

```
 RUN  v4.1.0 …/BTST-orderBook

 Test Files  12 passed | 3 skipped (15)
      Tests  124 passed | 7 skipped (131)
```

（通過／略過的檔案數會隨 `describe.skip` 與新增測試檔而變；**131 = 124 + 7** 為目前案例總數。）

---

## 2. 測試分層架構

測試金字塔對應程式碼架構：

```
        ┌─────────────────────────────────────────────┐
        │  L3: Component + Runtime Context             │
        │  OrderBookView / LastPrice / QuoteRow /      │
        │  OrderBook；OrderBookRuntimeContext（1）      │
        │  共 26 個測試（執行中）                         │
        └─────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────────────────────────────┐
        │  L2: Hook Tests（整合 + Mock WebSocket）     │
        │  useOrderBook / useLastPrice                 │
        │  共 41 個測試（執行中）                        │
        └─────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────────────────────────────┐
        │  L1: Unit Tests（純函數 + ws 工具）            │
        │  logic/*.logic.ts / utils.ts / wsAppPingPong │
        │  共 57 個測試（執行中，含 ws 單元）              │
        └─────────────────────────────────────────────┘
```

| 層級 | 目的 | 依賴 |
|------|------|------|
| **L1** | 驗證純邏輯正確性，無 React、無網路 | Vitest |
| **L2** | 驗證 hooks 與 WebSocket 互動、狀態流轉 | Vitest + MockWebSocket + renderHook |
| **L3** | 驗證 UI 渲染；`useOrderBookRuntime` 無 Provider 拋錯 | Vitest + React Testing Library + renderHook |

**數量（僅統計預設會跑的案例）**：L1 **57**、L2 **41**（`useOrderBook` 24 + `useLastPrice` 17）、L3 **26**（元件 25 + `context` 1）→ **合計 124**。另見 **[TEST.md](./TEST.md)** 略過的 7 例。

---

## 3. 測試目錄結構

```
src/__tests__/
├── setup.ts                    # 全域：引入 @testing-library/jest-dom、ResizeObserver stub
├── ws/
│   └── wsAppPingPong.test.ts   # 15 tests：pong 辨識、日誌旗標、setInterval mock 觸發 ping 週期
├── helpers/
│   └── MockWebSocket.ts        # L2 / L3 共用：模擬 WebSocket
│
├── logic/                      ← L1
│   ├── orderBook.logic.test.ts # 18 tests
│   ├── quoteRow.logic.test.ts  # 11 tests
│   ├── lastPrice.logic.test.ts # 7 tests
│   └── utils.test.ts           # 6 tests
│
├── hooks/                      ← L2（Mock WebSocket）
│   ├── useOrderBook.test.ts    # 24 tests：含 pong 早退、假時鐘批次／resubscribe、visibility、金融級場景
│   └── useLastPrice.test.ts    # 17 tests：價格方向、pong、重連假時鐘、舊 socket 早退、visibility
│
├── context/
│   └── OrderBookRuntimeContext.test.tsx  # 1 test：無 Provider 時 useOrderBookRuntime 拋錯
│
├── components/                 ← L3
│   ├── OrderBookView.test.tsx  # 6 tests：loading、價量、連線 badge、LastPrice
│   ├── LastPrice.test.tsx      # 5 tests
│   ├── QuoteRow.test.tsx       # 11 tests：含 sell 閃爍、假時鐘 + unmount
│   └── OrderBook.test.tsx      # 3 tests
│
├── pages/
│   └── SocketHealthPage.test.tsx   # describe.skip：診斷頁（見 TEST.md）
└── socketHealth/
    ├── socketHealthLabels.test.ts       # describe.skip
    └── buildLatencyChartData.test.ts    # describe.skip
```

---

## 4. 各層測試說明

### 4.1 L1：Logic 單元測試

**特點**：無需 mock，直接 `import` 純函數測試，執行速度最快。

| 檔案 | 覆蓋內容 | 測試數 |
|------|----------|--------|
| `orderBook.logic.test.ts` | `applyLevels`、`buildQuoteLevels`、`getDepthBarDenominator`、`applyDepthBarPercent`、`computeBarPercent`、`buildSnapshot`、`computeIsNew`、`getPrevSize`、`sumTotals` | 18 |
| `quoteRow.logic.test.ts` | `areEqual`（memo 比較）、`getRowFlashClass`、`getSizeFlashClass` | 11 |
| `lastPrice.logic.test.ts` | `computePriceDirection`、`getDirectionConfig` | 7 |
| `utils.test.ts` | `formatNumber` 千分位格式化、防禦性 `split` 空陣列 | 6 |
| `wsAppPingPong.test.ts` | `isWsAppPongMessage`、日誌（`DEV` / `VITE_WS_PING_LOG`）、`startWsAppPingInterval`（**mock `setInterval`** 觸發 tick，見 [TEST.md](./TEST.md)） | 15 |

**範例**：測試 `applyLevels` 正確處理 delta 更新與刪除

```typescript
it('should remove price levels when size is 0', () => {
  const map: PriceMap = new Map([[100.5, 10]]);
  applyLevels([['100.5', '0']], map);
  expect(map.has(100.5)).toBe(false);
});
```

---

### 4.2 L2：Hooks 整合測試

**特點**：使用 `MockWebSocket` 取代真實 WebSocket，可手動觸發 `onopen`、`onmessage`、`onclose`。

| 檔案 | 測試場景 | 測試數 |
|------|----------|--------|
| `useOrderBook.test.ts` | 連線、snapshot/delta、seqNum 不連續 resubscribe、斷線；金融級場景；**`simulateRawMessage('pong')` 早退**；活動逾時；**假時鐘**推進批次 flush／resubscribe 200ms；**visibility**（含 WS 已 OPEN 不另連）；onerror；空數據防禦 | 24 |
| `useLastPrice.test.ts` | 初始 null、價格方向、pong 早退、邊界、malformed JSON；10s 活動逾時；onclose **假時鐘重連**、unmount 不排程、**舊 socket 訊息早退**；onerror；**visibility**（含 WS 已 OPEN 不另連） | 17 |

**MockWebSocket 使用方式**：

```typescript
beforeEach(() => installMockWebSocket());
afterEach(() => {
  cleanup();
  cleanupMockWebSocket();
});

// 觸發連線成功
act(() => MockWebSocket.latest.simulateOpen());

// 模擬 snapshot 訊息
act(() => MockWebSocket.latest.simulateMessage({
  topic: 'update:BTCPFC_0',
  data: { bids: [['100', '10']], asks: [['101', '20']], seqNum: 1, ... }
}));
```

---

### 4.3 L3：Component 元件測試

**特點**：使用 React Testing Library 的 `render`、`screen`、`fireEvent`，驗證 UI 顯示與互動。

| 檔案 | 測試場景 | 測試數 |
|------|----------|--------|
| `OrderBookView.test.tsx` | connecting 且無資料 → Loading；價量與 total；disconnected → Reconnecting；connecting 但有資料 → Connecting badge；LastPrice 與箭頭 | 6 |
| `LastPrice.test.tsx` | price=null → "--"、有價格 → 格式化、direction up/down/same 與箭頭 | 5 |
| `QuoteRow.test.tsx` | price/size/total、千分位、bar、isNew／side 變更與 flash、size flash、sell 紅色、**sell + isNew 閃爍**、**假時鐘 + unmount** | 11 |
| `OrderBook.test.tsx` | Header、Loading 初始狀態、WS snapshot 後顯示資料 | 3 |
| `OrderBookRuntimeContext.test.tsx` | 無 `OrderBookRuntimeProvider` 時 `useOrderBookRuntime` 拋錯（stderr 靜音避免 jsdom 洗版） | 1 |

**範例**：驗證 LastPrice 依 direction 顯示箭頭

```typescript
it('should show up arrow when direction is up', () => {
  render(<LastPrice price={75000} direction="up" />);
  expect(screen.getByText('↑')).toBeInTheDocument();
});
```

---

## 5. 新增功能與優化紀錄

### 5.1 useOrderBook 金融級場景測試（2025/03）

針對核心 Hook `useOrderBook` 新增以下金融級場景：

- **seqNum 連續性**：seqNum 跳號（如 100→102）或 prevSeqNum 與 lastSeqNum 不符時觸發 resubscribe
- **Action 類型**：snapshot (partial) 清空並覆蓋、delta (update) 增量更新
- **數據裁剪**：bids/asks 超過 50 筆時驗證只顯示 `MAX_DISPLAY_ROWS`（8）筆；crossed orderbook 觸發 resubscribe
- **空數據防禦**：`data: null`、無 `type`、空 bids/asks、malformed JSON 皆不崩潰

### 5.2 整合測試分層（2025/03）

- **L2 Hooks 測試**：新增 `useOrderBook.test.ts`、`useLastPrice.test.ts`，透過 MockWebSocket 驗證 WebSocket 連線、snapshot/delta 處理、重連邏輯。
- **L3 Component 測試**：新增 `OrderBookView`、`LastPrice`、`QuoteRow`、`OrderBook` 完整元件測試。
- **MockWebSocket helper**：`helpers/MockWebSocket.ts` 提供 `simulateOpen`、`simulateMessage`、`simulateClose` 等 API，搭配 `installMockWebSocket()` / `cleanupMockWebSocket()` 管理全域 stub。

### 5.3 測試穩定性與跑速（與現況一致）

- **不在全域 `beforeEach` 開假時鐘**：過去在 hook 測試全域 `useFakeTimers()` 曾導致 teardown 逾時；**維持不用**。
- **區部假時鐘**：`useOrderBook`／`useLastPrice` 中需等待 **批次 flush（50ms）**、**重連 delay（1s）**、**resubscribe 200ms** 的案例，改在單一測試內 **`try { … vi.useFakeTimers() … } finally { vi.useRealTimers() }`**，縮短 CI 時間且避免汙染其他案例。
- **`cleanup()`**：QuoteRow 等 component 測試在 `afterEach` 呼叫 `cleanup()`，避免 DOM 殘留。

### 5.4 專案配置

- **`.gitignore`**：新增 `node_modules/`、`dist/`、`.env` 等，避免將依賴與建置產物上傳版本庫。
- **Vitest 設定**：`vite.config.ts` 已設定 `environment: 'jsdom'`、`globals: true`、`setupFiles` 引入 jest-dom matchers。

### 5.5 深度條與 UI 對齊（與測試對應）

- **分母**：`getDepthBarDenominator` 取買／賣兩側 8 筆累計總量之較大者；`applyDepthBarPercent` 對兩邊列套用同一分母。相關單元測試見 `orderBook.logic.test.ts`（`getDepthBarDenominator` describe）。
- **flush 整合**：`useOrderBook` 內 `buildQuoteLevels` → `getDepthBarDenominator` → `applyDepthBarPercent`，行為由 L2 hooks 測試覆蓋整體資料流。
- **QuoteLevel**：`barPercent` 由上述流程寫入；L3 `QuoteRow` / `OrderBookView` 測試使用含 `barPercent` 的 mock `quote`。

---

## 6. 技術棧與依賴

| 套件 | 用途 |
|------|------|
| **Vitest** | 測試執行器（與 Vite 整合） |
| **@testing-library/react** | `render`、`screen`、`fireEvent`、`renderHook`、`act` |
| **@testing-library/jest-dom** | `toBeInTheDocument`、`toHaveTextContent` 等 DOM matchers |
| **jsdom** | 模擬瀏覽器 DOM 環境 |

---

## 7. 撰寫新測試建議

1. **純函數** → 放 `logic/*.test.ts`，直接 import 測試。
2. **Hooks** → 放 `hooks/*.test.ts`，使用 `installMockWebSocket()`，`renderHook` + `act` 模擬事件。
3. **元件** → 放 `components/*.test.tsx`，用 `render`、`screen`、`fireEvent`，驗證文字、按鈕點擊、props 變化。
4. **Runtime context 守門** → 放 `context/*.test.tsx`，`renderHook` 驗證無 Provider 時是否拋錯（可參考現有 stderr 靜音寫法）。
5. **假時鐘**：與 `renderHook` 並用時，**僅在單一 `it` 內**開關，並以 **`try/finally` 還原 `useRealTimers()`**；勿在共用 `beforeEach` 全域啟用。若單例不需計時器，仍可用真實 `setTimeout` + `act`。

---

## 8. 測試覆蓋率

執行 `npm run test:coverage` 可產生 v8 報告（納入範圍見 `vite.config.ts` 的 `coverage.exclude`）。

**與效能／維護成本的權衡**（含為何不全用 fake timer 測 25s ping）：請讀 **[TEST.md](./TEST.md)**。

### 8.1 未覆蓋分支說明（可接受不測試）

以下類型分支因實務上難觸發或成本過高，保留為防禦性程式碼，不強求 100%；**行號僅供對照，以原始碼為準**：

| 檔案 | 說明 |
|------|------|
| `useLastPrice.ts` | `connect` 開頭 `!mountedRef.current` early return；`trade === undefined`（JSON 難表達）；`onclose` 其餘 `wsRef`／`mountedRef` 細部組合等。 |
| `useOrderBook.ts` | snapshot 緩衝迴圈極端 `prevSeqNum` 組合、`resubscribe` 內 `setTimeout(200)` 當下 socket 已非 `OPEN` 等。 |

已補測：**`wsRef !== ws` 舊 socket 訊息早退**、**visibility 且 WS 已 OPEN 不另連**（見 hooks 測試）。更完整的競態清單與取捨見 **[TEST.md](./TEST.md) §3**。

`utils.ts` 防禦分支已以 `split` mock 覆蓋；`wsAppPingPong.ts` 見 `wsAppPingPong.test.ts`。
