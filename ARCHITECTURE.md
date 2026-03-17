# Order Book — 系統架構與技術文件

> **技術棧**：React 18 + TypeScript + Vite  
> **資料來源**：BTSE Futures WebSocket API  
> **市場代號**：BTCPFC（BTC 永續合約）

---

## 1. 系統架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                    WebSocket Layer                       │
│  ┌────────────────────┐  ┌────────────────────────┐     │
│  │ OrderBook WS       │  │ Trade History WS        │     │
│  │ wss://.../oss/     │  │ wss://.../futures       │     │
│  │ update:BTCPFC_0    │  │ tradeHistoryApi:BTCPFC  │     │
│  └────────┬───────────┘  └──────────┬─────────────┘     │
│           │                         │                    │
│     ┌─────▼──────────┐        ┌─────▼──────┐            │
│     │  Snapshot/Delta │        │  Last Price │            │
│     │  SeqNum 驗證    │        │  方向偵測   │            │
│     └─────┬──────────┘        └─────┬──────┘            │
│           │                         │                    │
│     ┌─────▼──────────┐              │                    │
│     │ 50ms Batching   │              │                    │
│     │ dirtyRef 機制   │              │                    │
│     └─────┬──────────┘              │                    │
└───────────┼─────────────────────────┼────────────────────┘
            │                         │
┌───────────▼─────────────────────────▼────────────────────┐
│                    State Layer                            │
│  ┌──────────────────────────────────────────────┐        │
│  │ OrderBook Component (容器)                    │        │
│  │  • committedRef：前一幀的顯示快照             │        │
│  │  • Diff 偵測：isNew / prevSize 計算           │        │
│  │  • barPercent 計算                            │        │
│  └──────────────────┬───────────────────────────┘        │
└─────────────────────┼────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────┐
│                    Render Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ QuoteRow  │  │ QuoteRow  │  │ LastPrice │                │
│  │ memo +    │  │ memo +    │  │ memo      │                │
│  │ areEqual  │  │ areEqual  │  │           │                │
│  │ ×16       │  │           │  │           │                │
│  └──────────┘  └──────────┘  └──────────┘                │
│  CSS @keyframes 動畫：row-flash / size-flash              │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 核心技術要點

### 2.1 Snapshot + Delta 增量更新

**痛點**：如果每次都請求完整 order book，頻寬浪費巨大。

**解法**：
- 首次連線收到 `type: "snapshot"`（50 個價位的完整快照）
- 後續收到 `type: "delta"`（只有變動的價位）
- 用 `Map<price, size>` 維護本地完整狀態，delta 進來時做 upsert（size=0 則刪除）

```typescript
// delta 的 size=0 代表該價位已被撤單
if (size === 0) {
  map.delete(price);
} else {
  map.set(price, size);
}
```

### 2.2 SeqNum 序號驗證 + 自動恢復

**痛點**：網路不穩定可能導致 delta 丟失，本地狀態與伺服器不一致。

**解法**：
- 每個 delta 帶有 `seqNum` 和 `prevSeqNum`
- 驗證 `prevSeqNum === 上一次收到的 seqNum`
- 不匹配時自動 unsubscribe → 清空本地 Map → 重新 subscribe 取得新 snapshot
- 同時偵測 crossed orderbook（bestBid >= bestAsk），觸發重訂閱

### 2.3 50ms Micro-Batching

**痛點**：WebSocket delta 每秒可達 50~100 次，每次都 `setState` 會導致 UI 卡頓。

**解法**：Write-Then-Poll 模式
1. `onmessage` 只更新 `Map`（O(1) 寫入）並標記 `dirtyRef = true`
2. `setInterval(50ms)` 輪詢 `dirtyRef`，為 true 才 flush 到 React state
3. 多條 delta 被合併成一次 render

```
WebSocket:  d1 d2 d3 d4 d5 d6 d7 d8 d9 d10 ...
            ↓  ↓  ↓                ↓  ↓
Map 寫入:   ✓  ✓  ✓                ✓  ✓
            [── 50ms ──]           [── 50ms ──]
Render:     flush(d1~d3合併)       flush(d9~d10合併)
```

**效果**：每秒最多 20 次 render（20Hz），遠低於原始的 50~100 次。

### 2.4 幀間 Diff 偵測

**痛點**：需要偵測「新報價出現」和「Size 變動」來觸發對應動畫。

**解法**：
- 用 `committedRef` 在 `useEffect`（commit phase）儲存上一幀的顯示快照
- 避免在 render phase 更新 ref（StrictMode 會跑兩次 render，破壞比對）
- `isNew`：當前 price 不在上一幀的 8 筆 `displayedPrices` Set 中
- `prevSize`：從上一幀的 `sizes` Map 中以 price 為 key 取得

### 2.5 React.memo + 自訂 areEqual

**痛點**：16 個 QuoteRow 在每次 batch flush 時全部 re-render。

**解法**：
```typescript
function areEqual(prev, next) {
  return (
    prev.quote.price === next.quote.price &&
    prev.quote.size === next.quote.size &&
    prev.quote.total === next.quote.total &&
    prev.barPercent === next.barPercent &&
    prev.prevSize === next.prevSize &&
    prev.isNew === next.isNew
  );
}
export default memo(QuoteRowInner, areEqual);
```

- 預設 `memo` 對 `quote` 物件做 shallow compare 永遠 `false`（新物件引用）
- 自訂 `areEqual` 做值比較，只有 price/size/total 真正變了才 re-render
- **效果**：如果只有 2 行有變動，只 re-render 2 個 QuoteRow 而非 16 個

### 2.6 CSS @keyframes 閃爍動畫

**痛點**：用 inline `backgroundColor` + CSS `transition` 的閃爍不夠明顯。

**解法**：
- 用 CSS class 切換觸發 `@keyframes` 動畫
- 動畫從 `opacity 0.5` 的亮色瞬間出現，600ms 內漸退到 `transparent`
- 閃爍結束後移除 class（透過 `setTimeout`），避免動畫殘留

```css
@keyframes size-flash-green {
  0%   { background-color: rgba(0, 177, 93, 0.5); }
  100% { background-color: transparent; }
}
```

---

## 3. 資料流完整路徑

```
BTSE Diffusion Server
  │
  ├─ OrderBook WS (wss://.../oss/futures)
  │    │
  │    ▼
  │  onmessage → parse JSON
  │    │
  │    ├─ type=snapshot → 清空 Map → applyLevels → 立即 flush()
  │    │
  │    └─ type=delta
  │         ├─ seqNum 驗證 → 失敗 → resubscribe()
  │         ├─ applyLevels → 更新 Map
  │         ├─ crossed book 偵測 → 失敗 → resubscribe()
  │         └─ dirtyRef = true（等待 batch timer）
  │
  │  setInterval(50ms)
  │    └─ dirtyRef === true → flush() → setOrderBook()
  │         │
  │         ▼
  │  OrderBook 元件 render
  │    ├─ 讀取 committedRef（上一幀快照）
  │    ├─ 計算 isNew / prevSize / barPercent
  │    ├─ 產生 QuoteRow props
  │    └─ useEffect → 更新 committedRef（本幀快照）
  │         │
  │         ▼
  │  QuoteRow (×16, memo + areEqual)
  │    ├─ props 沒變 → 跳過 render
  │    └─ props 有變 → render
  │         ├─ isNew=true → 加 flash-row-{color} class → 600ms 後移除
  │         └─ size 變動 → 加 flash-size-{color} class → 600ms 後移除
  │
  └─ Trade History WS (wss://.../futures)
       │
       ▼
     onmessage → data[0].price
       ├─ 比較 prevPriceRef → 判定方向 (up/down/same)
       └─ setState({ price, direction })
            │
            ▼
       LastPrice 元件 (memo)
         └─ 顯示價格 + 箭頭 + 對應顏色/背景
```

---

## 4. 檔案結構

```
order-book/
├── index.html
├── package.json
├── tsconfig.json            # strict mode + noUncheckedIndexedAccess
├── vite.config.ts
└── src/
    ├── main.tsx              # StrictMode 入口
    ├── App.tsx
    ├── index.css             # Design Token + @keyframes 動畫
    ├── types.ts              # OrderBookWsMessage / TradeData / QuoteLevel
    ├── constants.ts          # WS URL / Topic / 顏色常數
    ├── utils.ts              # 千分位格式化
    ├── hooks/
    │   ├── useOrderBook.ts   # WS 連線 + Map 狀態 + batch + seqNum
    │   └── useLastPrice.ts   # WS 連線 + 方向判定
    └── components/
        ├── OrderBook.tsx     # 容器：diff 偵測 + barPercent 計算
        ├── QuoteRow.tsx      # memo + areEqual + 閃爍動畫
        └── LastPrice.tsx     # memo + 方向顏色
```

---

## 5. 如果要上線到真實交易所，還需要什麼？

### 5.1 連線韌性（Resilience）

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **自動重連** | 目前 WS 斷線後不會重連 | 指數退避重連（1s → 2s → 4s → max 30s），搭配 `navigator.onLine` 偵測 |
| **心跳檢測** | 無法偵測「靜默斷線」（TCP 連線在但伺服器不送資料） | 定時發送 `ping`，超時未收到 `pong` 則主動斷開重連 |
| **多市場切換** | 目前寫死 BTCPFC | 支援動態切換 symbol，切換時 unsubscribe 舊 topic + 清空 Map |

### 5.2 效能與規模化

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **Web Worker** | JSON parse 和 Map 操作在主執行緒 | 將 WS 連線和資料處理移到 Worker，主執行緒只負責 render |
| **虛擬化** | 目前只顯示 8 筆不需要，但若擴展到 50 筆 | 用 `react-window` 做虛擬捲動 |
| **crossed book 偵測** | `Math.max(...Array.from(map.keys()))` 在 50 個 key 時 OK，但萬級價位會慢 | 維護排序陣列或用 `SortedMap` |

### 5.3 資料正確性

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **浮點精度** | `parseFloat("0.1") + parseFloat("0.2") !== 0.3` | 用 `Decimal.js` 或整數運算（乘以精度倍數） |
| **REST fallback** | WS 長時間無 snapshot 時無法驗證本地狀態 | 定時用 REST API 拉取 orderbook 做校正 |
| **seqNum 溢位** | seqNum 持續增長，理論上可能溢位 | 實務上 Number.MAX_SAFE_INTEGER 足夠（9×10¹⁵），但需知道此邊界 |

### 5.4 使用者體驗

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **Loading 狀態** | 首次連線時無資料顯示空白 | 加 skeleton loading 或 spinner |
| **錯誤狀態** | WS 連線失敗無視覺提示 | 頂部 banner 顯示「連線中...」/「已斷線」 |
| **Grouping** | 只支援預設精度（`_0`） | 支援使用者選擇價格聚合精度（0.1 / 0.5 / 1 / 5 / 10） |
| **深度切換** | 固定 8 筆 | 讓使用者選擇顯示 8 / 15 / 25 筆 |
| **RWD** | 固定 392px 寬度 | 響應式設計，手機版可能只顯示 Price + Size |

### 5.5 測試與監控

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **單元測試** | 無測試 | 對 `buildQuoteLevels`、`applyLevels`、`formatNumber` 寫 Jest 測試 |
| **整合測試** | 無法驗證 WS 互動 | 用 `mock-socket` 模擬 WS server，測試 snapshot → delta → resubscribe 流程 |
| **E2E 測試** | 無法驗證動畫效果 | Playwright 錄製關鍵路徑，搭配視覺回歸測試 |
| **效能監控** | 無指標 | 追蹤 render 次數、batch 命中率、WS 延遲等 metrics |

### 5.6 安全與合規

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **WS 認證** | 目前用公開 API，無需認證 | 若涉及私有資料，需實作 HMAC 簽名認證 |
| **Rate Limit** | 未處理 429 回應 | 收到 429 時暫停重連，讀取 `Retry-After` header |
| **CSP** | 無 Content Security Policy | 限制只能連到 `wss://ws.btse.com` |

---

## 6. 面試亮點速查

| 問題 | 回答要點 |
|------|----------|
| 為什麼用 Map 而非陣列？ | O(1) 的 upsert/delete，delta 更新不需遍歷 |
| 為什麼 50ms 而非 requestAnimationFrame？ | rAF 是 16ms，batch 效果差；50ms 介於 Bybit(20ms) 和 Binance(100ms) |
| StrictMode 下 ref 更新有什麼陷阱？ | render 跑兩次，ref 在第一次被改寫，第二次讀到的是當前值而非前一幀 |
| memo 的 areEqual 為什麼不直接比較 quote 物件？ | quote 每次 flush 都是新物件（新引用），shallow compare 永遠 false |
| 為什麼新報價比對用顯示的 8 筆而非整本 50 筆？ | 使用者關心的是「畫面上新出現的」，不是整本書的新增 |
| 動畫為什麼用 CSS class 而非 inline style？ | @keyframes 可以做漸退效果，inline style + transition 太柔和不明顯 |
