# Order Book — 測試指南

> 本專案採用 **分層測試架構**，對應系統架構的 logic / hooks / components 三層，共 **73 個測試** 全數通過。

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
      Tests  73 passed (73)
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
        │  共 13 個測試                                 │
        └─────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────────────────────────────┐
        │  L1: Unit Tests（純函數）                    │
        │  logic/*.logic.ts / utils.ts                 │
        │  共 42 個測試                                 │
        └─────────────────────────────────────────────┘
```

| 層級 | 目的 | 依賴 |
|------|------|------|
| **L1** | 驗證純邏輯正確性，無 React、無網路 | Vitest |
| **L2** | 驗證 hooks 與 WebSocket 互動、狀態流轉 | Vitest + MockWebSocket + renderHook |
| **L3** | 驗證 UI 渲染與使用者互動 | Vitest + React Testing Library |

**數量**：L1 共 38 個、L2 共 13 個、L3 共 22 個。

---

## 3. 測試目錄結構

```
src/__tests__/
├── setup.ts                    # 全域：引入 @testing-library/jest-dom
├── helpers/
│   └── MockWebSocket.ts         # L2/L3 共用：模擬 WebSocket 行為
│
├── logic/                       ← L1：純函數單元測試
│   ├── orderBook.logic.test.ts  # 15 tests：applyLevels, buildQuoteLevels, computeBarPercent...
│   ├── quoteRow.logic.test.ts   # 11 tests：areEqual, getRowFlashClass, getSizeFlashClass
│   ├── lastPrice.logic.test.ts  # 7 tests：computePriceDirection, getDirectionConfig
│   └── utils.test.ts            # 5 tests：formatNumber
│
├── hooks/                       ← L2：Hooks 整合測試（Mock WebSocket）
│   ├── useOrderBook.test.ts     # 8 tests：連線、snapshot/delta、seqNum、重連、grouping
│   └── useLastPrice.test.ts     # 5 tests：價格更新、方向判定
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
| `orderBook.logic.test.ts` | `applyLevels`、`buildQuoteLevels`、`computeBarPercent`、`buildSnapshot`、`computeIsNew`、`getPrevSize`、`sumTotals` | 15 |
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
| `useOrderBook.test.ts` | 初始 connecting、連線後 connected、snapshot 有資料、delta 更新、size=0 移除、seqNum 不連續觸發 resubscribe、斷線 disconnected、grouping 切換送出 unsubscribe/subscribe | 8 |
| `useLastPrice.test.ts` | 初始 null、收到 trade 後 price 更新、上漲 direction=up、下跌 direction=down、價格不變 direction=same | 5 |

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
| `OrderBookView.test.tsx` | connecting + 空資料 → Loading、有 asks/bids → 顯示 price/size/total、disconnected → Reconnecting badge、點擊 grouping → onGroupChange、LastPrice 顯示 | 8 |
| `LastPrice.test.tsx` | price=null → "--"、有價格 → 格式化、direction up → ↑、down → ↓、same → 無箭頭 | 5 |
| `QuoteRow.test.tsx` | price/size/total、千分位格式化、bar 寬度、isNew、size flash、sell 側紅色 | 6 |
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

### 5.1 整合測試分層（2025/03）

- **L2 Hooks 測試**：新增 `useOrderBook.test.ts`、`useLastPrice.test.ts`，透過 MockWebSocket 驗證 WebSocket 連線、snapshot/delta 處理、重連邏輯。
- **L3 Component 測試**：新增 `OrderBookView`、`LastPrice`、`QuoteRow`、`OrderBook` 完整元件測試。
- **MockWebSocket helper**：`helpers/MockWebSocket.ts` 提供 `simulateOpen`、`simulateMessage`、`simulateClose` 等 API，搭配 `installMockWebSocket()` / `cleanupMockWebSocket()` 管理全域 stub。

### 5.2 測試穩定性優化

- **移除 `vi.useFakeTimers()`**：原本在 hook 測試的 `beforeEach` 使用 fake timers 會導致 `afterEach` 逾時（10s+）。改為使用真實 `setTimeout`，需等待 batch 的測試改用 `act` + `await new Promise(r => setTimeout(r, 60))`。
- **確保 `cleanup()`**：QuoteRow 等 component 測試在 `afterEach` 呼叫 `cleanup()`，避免 DOM 殘留造成 `getByText` 找到多個元素。

### 5.3 專案配置

- **`.gitignore`**：新增 `node_modules/`、`dist/`、`.env` 等，避免將依賴與建置產物上傳版本庫。
- **Vitest 設定**：`vite.config.ts` 已設定 `environment: 'jsdom'`、`globals: true`、`setupFiles` 引入 jest-dom matchers。

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

目前未啟用 coverage 報表，若要查看覆蓋率可於 `vite.config.ts` 新增：

```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    exclude: ['src/**/*.test.*', 'src/main.tsx'],
  },
},
```

執行 `npx vitest run --coverage` 即可產生覆蓋率報告。
