# Order Book — 系統架構與技術文件

> **技術棧**：React 18 + TypeScript + Vite + Styled-Components + Decimal.js + Vitest  
> **資料來源**：BTSE Futures WebSocket API  
> **市場代號**：BTCPFC（BTC 永續合約）

---

## 1. 系統架構總覽

```
┌──────────────────────────────────────────────────────────────┐
│                     WebSocket Layer                           │
│  ┌─────────────────────────┐  ┌────────────────────────┐     │
│  │ OrderBook WS            │  │ Trade History WS        │     │
│  │ wss://.../oss/futures   │  │ wss://.../futures       │     │
│  │ update:BTCPFC_0         │  │ tradeHistoryApi:BTCPFC  │     │
│  └────────┬────────────────┘  └──────────┬─────────────┘     │
│           │                              │                    │
│     ┌─────▼──────────┐            ┌──────▼──────┐            │
│     │  Snapshot/Delta │            │  Last Price  │            │
│     │  SeqNum 驗證    │            │  方向偵測    │            │
│     └─────┬──────────┘            └──────┬──────┘            │
│           │                              │                    │
│     ┌─────▼──────────┐                   │                    │
│     │ 50ms Batching   │                   │                    │
│     │ dirtyRef 機制   │                   │                    │
│     └─────┬──────────┘                   │                    │
│           │                              │                    │
│     ┌─────▼────────────────────────┐     │                    │
│     │ 連線韌性                      │     │                    │
│     │ • 活動偵測（10s 無訊息斷線） │     │                    │
│     │ • 指數退避重連（1s~30s）     │     │                    │
│     │ • Tab 切換自動恢復           │     │                    │
│     │ • Race condition 防護        │     │                    │
│     └─────┬────────────────────────┘     │                    │
└───────────┼──────────────────────────────┼────────────────────┘
            │                              │
┌───────────▼──────────────────────────────▼────────────────────┐
│                     State Layer                                │
│  ┌──────────────────────────────────────────────┐             │
│  │ OrderBook Component (容器)                    │             │
│  │  • committedRef：前一幀的顯示快照             │             │
│  │  • Diff 偵測：isNew / prevSize 計算           │             │
│  │  • barPercent 計算（精度截斷防 memo 失效）    │             │
│  │  • Decimal.js：浮點精度保證                   │             │
│  │  • 連線狀態 UI：Loading / Disconnected        │             │
│  └──────────────────┬───────────────────────────┘             │
└─────────────────────┼─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                     Render Layer                               │
│  ┌───────────────────────────────────────────┐                 │
│  │ OrderBookView (Presentation)              │                 │
│  │  ├─ QuoteRow (memo + areEqual) ×16        │                 │
│  │  └─ LastPrice (memo)                      │                 │
│  └───────────────────────────────────────────┘                 │
│                                                                │
│  ┌───────────────────────────────────────────┐                 │
│  │ styles/ (Styled-Components)               │                 │
│  │  ├─ orderBook.style.ts                    │                 │
│  │  ├─ quoteRow.style.ts (.attrs for perf)   │                 │
│  │  ├─ lastPrice.style.ts (.attrs for perf)  │                 │
│  │  └─ common.style.ts                       │                 │
│  └───────────────────────────────────────────┘                 │
│                                                                │
│  ┌───────────────────────────────────────────┐                 │
│  │ logic/ (Pure Functions, 100% Testable)    │                 │
│  │  ├─ orderBook.logic.ts                    │                 │
│  │  ├─ quoteRow.logic.ts                     │                 │
│  │  └─ lastPrice.logic.ts                    │                 │
│  └───────────────────────────────────────────┘                 │
│                                                                │
│  __tests__/ → 73 tests（L1 單元 + L2 Hooks + L3 Components）     │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. 核心技術要點

### 2.1 Snapshot + Delta 增量更新

**痛點**：如果每次都請求完整 order book，頻寬浪費巨大。

**解法**：
- 首次連線收到 `type: "snapshot"`（50 個價位的完整快照）
- 後續收到 `type: "delta"`（只有變動的價位）
- 用 `Map<price, size>` 維護本地完整狀態，delta 進來時做 upsert（size=0 則刪除）

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

**效果**：每秒最多 20 次 render（20Hz），遠低於原始的 50~100 次。50ms 介於 Bybit（20ms）和 Binance（100ms）之間。

### 2.4 幀間 Diff 偵測

**痛點**：需要偵測「新報價出現」和「Size 變動」來觸發對應動畫。

**解法**：
- 用 `committedRef` 在 `useEffect`（commit phase）儲存上一幀的顯示快照
- 避免在 render phase 更新 ref（StrictMode 會跑兩次 render，破壞比對）
- `isNew`：當前 price 不在上一幀**畫面顯示的 8 筆** `displayedPrices` Set 中
- `prevSize`：從上一幀的 `sizes` Map 中以 price 為 key 取得

### 2.5 React.memo + 自訂 areEqual + barPercent 精度截斷

**痛點**：16 個 QuoteRow 在每次 batch flush 時全部 re-render。

**解法**：
- 自訂 `areEqual` 逐欄位值比較（避免物件引用比較永遠 false）
- `barPercent` 四捨五入到 0.1%（`Math.round(x * 1000) / 10`），防止 `sumTotals` 微變導致所有行 barPercent 連動變化
- **效果**：如果只有 2 行有變動，只 re-render 2 個 QuoteRow 而非 16 個

### 2.6 Styled-Components 閃爍動畫 + `.attrs()` 效能優化

**痛點 1**：用 inline `backgroundColor` + CSS `transition` 的閃爍不夠明顯。

**解法**：
- 用 styled-components 的 `keyframes` helper 定義動畫
- 透過 `css` tagged template 插值 keyframes 物件（v4+ 要求，不能插入普通字串）
- 動畫從 `opacity 0.5` 的亮色瞬間出現，600ms 內漸退到 `transparent`

**痛點 2**：styled-components 為每個不同的 prop 值產生新 CSS class（如 `width: 21.7%` → 新 class），高頻更新時產生 200+ classes。

**解法**：對頻繁變動的 props 使用 `.attrs()` 將值轉為 inline style：
- `Bar`：`$width`、`$color` → `.attrs()` → `style={{ width, backgroundColor }}`
- `PriceCell`：`$color` → `.attrs()` → `style={{ color }}`
- `LastPrice Container/PriceValue`：`$bg`、`$color` → `.attrs()`

**原則**：不常變的樣式（layout、font-size）用 CSS class，頻繁變的值（width、color）用 `.attrs()` + inline style。

### 2.7 連線韌性（Resilience）

**痛點**：WS 斷線後用戶看到的資料是過期的，且無法自動恢復。

**解法 — 四層防護機制**：

| 機制 | 觸發條件 | 行為 |
|------|----------|------|
| **活動偵測** | 10s 內沒收到任何 WS 訊息 | 主動 `close()` 觸發重連（取代 ping/pong，因 OSS 端點不支援） |
| **指數退避重連** | WS `onclose` 事件 | 1s → 2s → 4s → ... → max 30s，成功後歸零 |
| **Tab 切換** | `visibilitychange` 事件 | 回到 tab 時，若 WS 已斷則立即重連（跳過退避等待） |
| **Race condition 防護** | `connect()` 建新連線時 | 舊 WS 的 `onclose`/`onmessage` 透過 `wsRef.current !== ws` 檢查直接忽略 |

**UI 狀態**：
- `connecting`（首次無資料）→ Spinner + "Loading order book..."
- `connecting`（有舊資料）→ Header badge「Connecting...」
- `connected` → 正常顯示
- `disconnected` → Header 紅色 badge「Reconnecting...」+ 資料 opacity 0.45

### 2.8 Decimal.js 浮點精度

**痛點**：JavaScript 的 `number` 使用 IEEE 754 雙精度浮點，金融計算會產生精度誤差。

**為什麼交易所必須用**：
- `0.1 + 0.2 = 0.30000000000000004`（不是 0.3）
- 累加 8 筆 size 時，誤差會逐層放大
- 在 Total 欄位顯示「不精確的數字」對交易所用戶而言是不可接受的

**解法**：用 `Decimal.js` 取代原生 `number` 做所有涉及金額/數量的加法運算，最終 `toNumber()` 輸出給 React 渲染。

### 2.9 Price Aggregation（價格聚合）

**痛點**：固定精度（0.1）的 order book 在價格劇烈波動時，前 8 筆可能分佈很密，看不出深度全貌。

**解法**：
- BTSE API 原生支援 grouping level 0~8（對 BTC：0.1 / 0.5 / 1 / 5 / 10 ...）
- topic 格式為 `update:BTCPFC_{level}`，切換 level 就能改變聚合精度
- 切換時不需重建 WS 連線：unsubscribe 舊 topic → 清空 Map → subscribe 新 topic
- 清空 `committedRef`，避免新舊精度的價格誤判為「新報價」觸發動畫

### 2.10 Snapshot Buffer（重訂閱空窗期防護）

**痛點**：seqNum 不連續 → unsubscribe → 等待 → re-subscribe → 新 snapshot 到達之前，可能有 delta 已經先飛進來但被忽略，造成資料缺口。

**解法**：
- 設 `awaitingSnapshotRef = true` 標記進入等待狀態
- 等待期間收到的 delta 暫存到 `pendingDeltasRef` 緩衝區
- 新 snapshot 到達後，從緩衝區中篩出 `prevSeqNum >= snapshot.seqNum` 的 delta
- 依 seqNum 排序後逐一套用，確保零資料丟失

```
時間線:
  seqNum 不連續 → resubscribe
  [─── 等待新 snapshot ───]
  收到 delta(seq=103) → 暫存
  收到 delta(seq=104) → 暫存
  收到 snapshot(seq=102) → 套用
    → 從暫存中找 prevSeqNum≥102 的 delta
    → 套用 delta(103)，再套用 delta(104)
    → 本地 seqNum = 104，資料完整 ✓
```

---

## 3. 資料流完整路徑

```
BTSE Server
  │
  ├─ OrderBook WS (wss://.../oss/futures)
  │    │
  │    ▼
  │  onmessage
  │    ├─ wsRef.current !== ws？→ 忽略（race condition 防護）
  │    ├─ 重置活動偵測計時器（10s）
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
  │    ├─ 計算 isNew / prevSize / barPercent（精度截斷）
  │    ├─ 產生 QuoteRow props
  │    └─ useEffect → 更新 committedRef（本幀快照）
  │         │
  │         ▼
  │  QuoteRow (×16, memo + areEqual)
  │    ├─ props 沒變 → 跳過 render
  │    └─ props 有變 → render
  │         ├─ isNew=true → flash-row-{color} class → 600ms 後移除
  │         └─ size 變動 → flash-size-{color} class → 600ms 後移除
  │
  │  onclose
  │    ├─ wsRef.current !== ws？→ 忽略
  │    ├─ setStatus('disconnected') → UI 變淡
  │    └─ setTimeout(connect, delay) → 指數退避重連
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

## 4. 檔案結構（三層分離架構）

```
order-book/
├── index.html
├── package.json
├── ARCHITECTURE.md              # 本文件：系統架構與技術說明
├── TESTING.md                   # 測試指南：如何使用、寫了哪些測試
├── tsconfig.json               # strict mode + noUncheckedIndexedAccess
├── vite.config.ts
└── src/
    ├── main.tsx                 # StrictMode 入口
    ├── App.tsx
    ├── index.css                # 精簡：只保留 CSS reset + body 基礎樣式
    ├── types.ts                 # OrderBookWsMessage / TradeData / QuoteLevel
    ├── constants.ts             # WS URL / Topic / COLORS / GROUPING_OPTIONS
    ├── utils.ts                 # formatNumber 千分位格式化
    │
    ├── styles/                  ← Styled-Components（對應 megatron-slicing 角色）
    │   ├── common.style.ts      # Spinner, StatusBadge
    │   ├── orderBook.style.ts   # Wrapper, Header, GroupingBar, QuoteSection, Loading...
    │   ├── quoteRow.style.ts    # Row, Bar(.attrs), PriceCell(.attrs), SizeCell, TotalCell + keyframes
    │   └── lastPrice.style.ts   # Container(.attrs), PriceValue(.attrs), Arrow
    │
    ├── logic/                   ← 純函數（100% 可單元測試，零 React 依賴）
    │   ├── orderBook.logic.ts   # buildQuoteLevels, applyLevels, computeBarPercent, buildSnapshot...
    │   ├── quoteRow.logic.ts    # areEqual, getRowFlashClass, getSizeFlashClass
    │   └── lastPrice.logic.ts   # computePriceDirection, getDirectionConfig
    │
    ├── hooks/                   ← 精簡：只負責 WS 連線 + state 管理
    │   ├── useOrderBook.ts      # WS + Map + batch + seqNum + 重連 + 活動偵測（import logic/）
    │   └── useLastPrice.ts      # WS + 方向判定 + 重連（import logic/）
    │
    ├── components/              ← Container / Presentation 分離
    │   ├── OrderBook.tsx        # Container：組合 hooks + logic → props 傳給 View（零 JSX）
    │   ├── OrderBookView.tsx    # Presentation：純 UI + styled-components（零業務邏輯）
    │   ├── QuoteRow.tsx         # Presentation：memo + areEqual + 閃爍動畫
    │   └── LastPrice.tsx        # Presentation：memo + 方向顏色
    │
    └── __tests__/               ← 分層測試（Vitest，73 tests）
        ├── setup.ts
        ├── helpers/MockWebSocket.ts
        ├── logic/                   # L1 單元：38 tests
        │   ├── orderBook.logic.test.ts
        │   ├── quoteRow.logic.test.ts
        │   ├── lastPrice.logic.test.ts
        │   └── utils.test.ts
        ├── hooks/                   # L2 整合：13 tests（Mock WS）
        │   ├── useOrderBook.test.ts
        │   └── useLastPrice.test.ts
        └── components/               # L3 元件：22 tests
            ├── OrderBookView.test.tsx
            ├── LastPrice.test.tsx
            ├── QuoteRow.test.tsx
            └── OrderBook.test.tsx
```

### 架構分離原則

| 層 | 職責 | 可測試性 | React 依賴 |
|----|------|----------|-----------|
| **styles/** | UI 外觀（顏色、佈局、動畫） | N/A | styled-components |
| **logic/** | 純函數（計算、比較、轉換） | 100% 可直接 `import` 測試 | 零 |
| **hooks/** | WS 連線、state 管理 | 需 mock WebSocket | React hooks |
| **components/** | Container 組合邏輯、View 渲染 | 需 render testing | React JSX |

**Container（OrderBook.tsx）**不直接渲染任何 HTML/styled 元件，只負責：
1. 呼叫 hooks 取得資料和狀態
2. 呼叫 logic/ 計算衍生值（barPercent、isNew、prevSize）
3. 把所有結果透過 props 傳給 View

**Presentation（OrderBookView.tsx）**不做任何計算，只負責：
1. 接收 props 渲染 UI
2. 使用 styles/ 的 styled-components

---

## 5. 如果要上線到真實交易所，還需要什麼？

### 5.1 效能與規模化

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **Web Worker** | JSON parse 和 Map 操作在主執行緒 | 將 WS 連線和資料處理移到 Worker，主執行緒只負責 render |
| **虛擬化** | 目前只顯示 8 筆不需要，但若擴展到 50 筆 | 用 `react-window` 做虛擬捲動 |

### 5.2 使用者體驗

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| **Grouping** | 只支援預設精度（`_0`） | 支援使用者選擇價格聚合精度（0.1 / 0.5 / 1 / 5 / 10） |
| **深度切換** | 固定 8 筆 | 讓使用者選擇顯示 8 / 15 / 25 筆 |
| **多市場切換** | 目前寫死 BTCPFC | 支援動態切換 symbol |
| **RWD** | 固定 392px 寬度 | 響應式設計，手機版可能只顯示 Price + Size |

### 5.3 測試與監控

| 缺口 | 說明 | 建議方案 |
|------|------|----------|
| ~~單元測試~~ | ~~無測試~~ | ✅ 已完成：logic/ 42 個純函數單元測試 |
| ~~整合測試~~ | ~~無法驗證 WS 互動~~ | ✅ 已完成：hooks/ 13 個測試，MockWebSocket 模擬 snapshot → delta → resubscribe |
| **元件測試** | UI 渲染驗證 | ✅ 已完成：components/ 18 個測試，覆蓋 OrderBookView、LastPrice、QuoteRow、OrderBook |
| **E2E 測試** | 無法驗證動畫效果 | Playwright 錄製關鍵路徑，搭配視覺回歸測試 |

### 5.4 安全與合規

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
| barPercent 為什麼要精度截斷？ | sumTotals 微變導致所有行 barPercent 連動變化，memo 全部失效 |
| 為什麼新報價比對用顯示的 8 筆而非整本 50 筆？ | 使用者關心的是「畫面上新出現的」，不是整本書的新增 |
| 動畫為什麼用 CSS class 而非 inline style？ | @keyframes 可以做漸退效果，inline style + transition 太柔和不明顯 |
| 為什麼 OSS 端點不用 ping/pong？ | OSS 端點不支援字串 ping/pong，改用活動偵測（有收到任何訊息=活著） |
| WS 重連時怎麼防止 race condition？ | `onclose`/`onmessage` 檢查 `wsRef.current !== ws`，被取代的舊連線事件一律忽略 |
| 為什麼用 Decimal.js？ | JS 浮點 `0.1+0.2≠0.3`，金融場景累加精度會逐層放大，交易所不能顯示不精確的數字 |
| Grouping 切換時為什麼不重建 WS？ | 同一條 WS 連線可以切換 topic，省去重新握手的延遲和資源浪費 |
| 重訂閱時如何確保零資料丟失？ | 用 Snapshot Buffer：暫存空窗期的 delta，snapshot 到達後依 seqNum 順序回放 |
| 為什麼用 Container/Presentation 分離？ | Container 負責 hooks + 計算、View 負責渲染，邏輯抽到 logic/ 後 100% 可單元測試 |
| styled-components 為什麼用 `.attrs()`？ | 頻繁變動的 props（width/color）若用 CSS-in-JS 會產生 200+ classes，`.attrs()` 改用 inline style 避免 class 堆積 |
| keyframes 為什麼要用 `css` helper 插值？ | styled-components v4+ 不允許在普通模板字串中插入 keyframes 物件，需在 `css` tagged template 中使用 |
