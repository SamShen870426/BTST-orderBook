<div align="center">

# Order Book — 即時委託簿

**交易所前端面試作業** · 連線 **BTSE Futures** 公開 WebSocket，呈現 **BTC 永續（BTCPFC）** 買賣盤、最新成交價與連線診斷。

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-125%20passed-6E9F18?logo=vitest)](https://vitest.dev/)

</div>

---

<div align="center">
  <video src="https://github.com/user-attachments/assets/96d15f22-ec32-46c2-a027-c58e2541d8db" width="800px" autoplay loop muted playsinline></video>
</div>


## 給審閱者的重點（TL;DR）

| 面向 | 說明 |
|------|------|
| **領域** | 真實行情 WS：`snapshot` / `delta`、`seqNum` 連續性、重訂閱與空窗期緩衝 |
| **效能** | 50ms batching(可動態調整 useOrderBook.ts <img width="218" height="27" alt="image" src="https://github.com/user-attachments/assets/89e4bce7-2d52-4f50-a0ff-11e9dd929ab5" />)、`memo` + 自訂 `areEqual`、深度條分母與 `barPercent` 在 flush 內一次算完 |
| **正確性** | `Decimal.js` 處理價量；crossed book / seq 斷裂觸發恢復流程 |
| **韌性** | 應用層 ping/pong、活動偵測、指數退避重連、Tab 可見性、`wsRef` race 防護 |
| **可測試性** | `logic/` 純函數與 React 分層；**125** 則測試（Vitest + Testing Library） |
| **可維護性** | [ARCHITECTURE.md](./ARCHITECTURE.md) 系統設計、[TESTING.md](./TESTING.md) 測試策略 |

> 若時間有限：請先看 **功能截圖／實際跑 `npm run dev`**，再翻 **架構 §2（技術要點）** 與 **`npm test`** 結果。

---

## 功能一覽

- **委託簿** — 買／賣各 8 檔，價格、單檔量、累計量與深度視覺化；新價位與量變閃爍提示  
- **價格聚合** — 多組 grouping（API topic `update:BTCPFC_{level}`），切換不需重建 WS  
- **最新價** — 獨立 Trade History 頻道；漲跌方向與配色  
- **連線狀態** — Loading / Disconnected、可導向 **`/socket-health` 診斷頁**（Throughput、JS Heap、**RTT 心跳圖**）  
- **程式碼分割** — 診斷頁與圖表以 `React.lazy` 載入，減輕首屏 bundle  

---

### 🛡️ WebSocket 健康診斷 (Tool Page  **/socket-health**)
<div align="center">
  <video src="https://github.com/user-attachments/assets/d29f4a32-3192-4e37-9e1f-e9494c964bd2" width="600px" autoplay loop muted playsinline></video>
  <p><em>內建遠測監控：即時追蹤 Throughput、JS Heap 記憶體足跡與 RTT 心跳延遲趨勢。</em></p>
</div>

## 技術棧

```
React 18 · TypeScript · Vite 6
Styled-Components · React Router · Recharts · Decimal.js
Vitest · Testing Library · jsdom
```

| 項目 | 選型理由（簡述） |
|------|------------------|
| **Vite** | 開發體驗與 build 速度 |
| **Styled-Components** | 元件級樣式、`.attrs` 穩定化動態 props |
| **Decimal.js** | 金融數值避免浮點誤差 |
| **Recharts** | 診斷頁 60 秒 RTT 面積圖（lazy） |

**Node 版本**：建議 **20.10+**（專案以 Volta 鎖定 `20.10.0`）。

---

## 快速開始

```bash
# 安裝依賴
npm install

# 開發模式（預設 http://localhost:5173）
npm run dev

# 正式編譯
npm run build

# 預覽 production build
npm run preview
```

開啟後：

- **`/`** — 主畫面（委託簿 + 最新價）  
- **`/socket-health`** — WebSocket 診斷（需主流程已建立連線；Provider 掛在路由外，切頁不斷線）  

---

## 測試

```bash
npm test                 # 單次全跑（目前 125 則，14 個檔案）
npm run test:watch       # 監聽模式
npm run test:coverage    # 覆蓋率報告
```

測試分層（單元 logic → hooks → components）與命名規範見 **[TESTING.md](./TESTING.md)**；刻意未全覆蓋的邊界見 **[TEST.md](./TEST.md)**。

---

## 文件導覽

| 文件 | 內容 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架構圖、資料流、檔案樹、Snapshot buffer、診斷頁與心跳圖語意 |
| [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) | WebSocket / 委託簿概念入門（若審閱者不熟悉領域） |
| [WS_APP_HEARTBEAT.md](./WS_APP_HEARTBEAT.md) | 應用層 ping/pong 與 RTT 圖說明 |
| [TESTING.md](./TESTING.md) | 測試指令與金字塔 |

---

## 專案結構（精簡）

```
order-book/
├── src/
│   ├── logic/           # 純函數：orderBook / quoteRow / lastPrice
│   ├── hooks/           # useOrderBook、useLastPrice（WS + 狀態）
│   ├── components/      # OrderBook(View)、QuoteRow、LastPrice
│   ├── context/         # OrderBookRuntimeProvider（Routes 外）
│   ├── socketHealth/    # 診斷 store、圖表資料、LatencyAreaChart…
│   ├── pages/           # SocketHealthPage
│   └── __tests__/       # 對應分層測試
├── ARCHITECTURE.md
├── TESTING.md
└── package.json
```

完整樹狀圖與模組說明以 **ARCHITECTURE.md §4** 為準。

---

## 資料來源與聲明

- 行情來自 **BTSE** 公開 **Futures WebSocket**（無 API Key 之前端訂閱）。  
- 本作業僅供學習與面試展示，**非** BTSE 官方產品；連線品質與欄位行為以當下 API 為準。  

---

## 授權

本 repository 為 **面試作業展示用**；原始碼之使用範圍請依徵才方與作者約定為準。

---

<div align="center">

**若審閱上有任何想深挖的段落（例如 seqNum 恢復或 batching 邊界），歡迎在 PR／面試中直接點名檔案與測試案例對照。**

</div>
