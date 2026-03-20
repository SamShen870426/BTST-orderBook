# Order Book — 測試指南

> 本專案採用 **分層測試架構**，對應系統架構的 logic / hooks / components 三層，共 **98 個測試** 全數通過。**Lines 覆蓋率 100%**（執行 `npm run test -- --coverage` 可產生報告）。

---

## 1. 快速開始：如何執行測試

### 指令

```bash
# 執行全部測試（單次）
npm test

# 監聽模式：檔案變動時自動重跑
npm run test:watch
```

### 環境需求

- Node.js 20.10+（專案使用 Volta 鎖定版本）
- 已執行 `npm install`

### 預期輸出

```
 RUN  v4.1.0 C:/SBK/Frontend/order-book

 Test Files  10 passed (10)
      Tests  98 passed (98)
```

---

## 2. 測試分層架構

測試金字塔對應程式碼架構：

```
        ┌─────────────────────────────────────────────┐
        │  L3: Component Tests（元件渲染）              │
        │  OrderBookView / LastPrice / QuoteRow / OrderBook   │
        │  共 22 個測試                                   │
        └─────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────────────────────────────┐
        │  L2: Hook Tests（整合 + Mock WebSocket）     │
        │  useOrderBook / useLastPrice                 │
        │  共 35 個測試                                 │
        └─────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────────────────────────────┐
        │  L1: Unit Tests（純函數）                    │
        │  logic/*.logic.ts / utils.ts                 │
        │  共 41 個測試                                 │
        └─────────────────────────────────────────────┘
```

| 層級 | 目的 | 依賴 |
|------|------|------|
| **L1** | 驗證純邏輯正確性，無 React、無網路 | Vitest |
| **L2** | 驗證 hooks 與 WebSocket 互動、狀態流轉 | Vitest + MockWebSocket + renderHook |
| **L3** | 驗證 UI 渲染與使用者互動 | Vitest + React Testing Library |

**數量**：L1 共 41 個、L2 共 35 個、L3 共 22 個（合計 98）。

---

## 3. 測試目錄結構

```
src/__tests__/
├── setup.ts                    # 全域：引入 @testing-library/jest-dom
├── helpers/
│   └── MockWebSocket.ts         # L2/L3 共用：模擬 WebSocket 行為
│
├── logic/                       ← L1：純函數單元測試
│   ├── orderBook.logic.test.ts  # 18 tests：applyLevels, buildQuoteLevels, getDepthBarDenominator, applyDepthBarPercent, computeBarPercent...
│   ├── quoteRow.logic.test.ts   # 11 tests：areEqual, getRowFlashClass, getSizeFlashClass
│   ├── lastPrice.logic.test.ts  # 7 tests：computePriceDirection, getDirectionConfig
│   └── utils.test.ts            # 5 tests：formatNumber
│
├── hooks/                       ← L2：Hooks 整合測試（Mock WebSocket）
│   ├── useOrderBook.test.ts     # 22 tests：連線、seqNum、重連、金融級場景（seqNum 連續性、Snapshot Buffer、snapshot/delta、數據裁剪、活動偵測、visibility、onerror 等）
│   └── useLastPrice.test.ts     # 12 tests：價格更新、方向判定、邊界、重連、visibilitychange
│
└── components/                  ← L3：元件渲染測試
    ├── OrderBookView.test.tsx   # 8 tests：loading、資料顯示、grouping、onGroupChange
    ├── LastPrice.test.tsx       # 5 tests：null/價格、箭頭、格式化
    ├── QuoteRow.test.tsx        # 6 tests：price/size/total、格式化、flash、sell 顏色
    └── OrderBook.test.tsx       # 3 tests：Container 整合（與 Mock WS 互動）
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
| `utils.test.ts` | `formatNumber` 千分位格式化 | 5 |

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
| `useOrderBook.test.ts` | 連線、snapshot/delta、seqNum 不連續觸發 resubscribe、斷線；**金融級**：seqNum 跳號、Snapshot Buffer 回放、活動偵測逾時、visibility 恢復、onerror；數據裁剪、crossed orderbook、空數據防禦 | 22 |
| `useLastPrice.test.ts` | 初始 null、價格方向 up/down/same、邊界、onmessage 空數據、onclose 重連/已 unmount 不排程、onerror、visibilitychange | 13 |

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
| `OrderBookView.test.tsx` | connecting + 空資料 → Loading、有 asks/bids → 顯示 price/size/total、disconnected → Reconnecting badge、LastPrice 顯示 | 6 |
| `LastPrice.test.tsx` | price=null → "--"、有價格 → 格式化、direction up → ↑、down → ↓、same → 無箭頭 | 5 |
| `QuoteRow.test.tsx` | price/size/total、千分位格式化、bar 寬度、isNew flash（從 false→true、維持 false）、size flash、sell 側紅色 | 8 |
| `OrderBook.test.tsx` | Header、Loading 初始狀態、WS snapshot 後顯示資料 | 3 |

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

### 5.3 測試穩定性優化

- **移除 `vi.useFakeTimers()`**：原本在 hook 測試的 `beforeEach` 使用 fake timers 會導致 `afterEach` 逾時（10s+）。改為使用真實 `setTimeout`，需等待 batch 的測試改用 `act` + `await new Promise(r => setTimeout(r, 60))`。
- **確保 `cleanup()`**：QuoteRow 等 component 測試在 `afterEach` 呼叫 `cleanup()`，避免 DOM 殘留造成 `getByText` 找到多個元素。

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
4. **避免 `useFakeTimers` 與 `renderHook` 混用**：易造成 afterEach timeout；若需等待，改用真實 `setTimeout` + `act`。

---

## 8. 測試覆蓋率

執行 `npm run test -- --coverage` 可產生覆蓋率報告。

### 8.1 未覆蓋分支說明（可接受不測試）

以下分支因實務上難觸發或成本過高，保留為防禦性程式碼，不強求 100%：

| 檔案 | 行數 | 說明 |
|------|------|------|
| `useLastPrice.ts` | 21-23 | `connect` 內 `mountedRef.current === false` 時 early return。unmount 時已 clearTimeout(retryTimer)，retry 不會再呼叫 connect，此分支在正常流程下不會進入。 |
| `useLastPrice.ts` | 40-42 | `trade === undefined`：JSON 不支援 `undefined`，`msg.data[0]` 僅可能為 `null` 或有效值，此條件主要防範 sparse array 等罕見情況。 |
| `useLastPrice.ts` | 52-54, 55-77 | `onclose`/`onerror`/`handleVisibility` 的 `mountedRef`、`wsRef !== ws` 等 guard：多為競態防護，需精確模擬 unmount 時序，測試成本高。 |
| `utils.ts` | 3 | `formatNumber` 中 `n < 0` 的分支：本專案價量皆非負數，可視為防禦性分支。 |
