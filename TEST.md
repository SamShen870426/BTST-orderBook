# 測試與覆蓋率 — 效能權衡說明

本檔補充 [`TESTING.md`](./TESTING.md)：**為何某些路徑刻意不全測**、**ping/pong 怎麼測**、**coverage 排除項目**，以及**報表上黃字／紅字代表什麼**。專案以**執行期效能**與**測試跑速**為優先：優先 `MockWebSocket` + **`vi.useFakeTimers()`** 取代長時間 `setTimeout` / `sleep`。

---

## 1. 覆蓋率報表上的黃字／紅字與 socket health 無關

在終端機／HTML 報表中，**分支（Branch）或函式（Funcs）百分比變黃、未覆蓋行號變紅**，來自 **v8 覆蓋率工具**標記「該指標未達滿覆蓋」。

- **`/socket-health` 診斷頁**相關原始碼已自 coverage **排除**（見 §4），**不會**出現在報表裡，也**不是**你看到的 `useOrderBook` / `useLastPrice` / `QuoteRow` 黃紅字來源。
- 目前報表上仍可能偏黃的區塊，主要是 **`useOrderBook.ts` / `useLastPrice.ts` 的 WebSocket 競態與防禦分支**（見 §3），以及 **`QuoteRow.tsx` 經 `memo` 儀器化後的函式計數**（見 §3）。

---

## 2. 測試檔案一覽（掌握全專案測試狀況）

| 路徑 | 內容 |
|------|------|
| `src/__tests__/setup.ts` | `jest-dom`、ResizeObserver stub |
| `src/__tests__/helpers/MockWebSocket.ts` | 假 WebSocket，供 hooks 測試 |
| `src/__tests__/components/*.test.tsx` | 元件 |
| `src/__tests__/context/OrderBookRuntimeContext.test.tsx` | `useOrderBookRuntime` 無 Provider 時拋錯 |
| `src/__tests__/hooks/*.test.ts` | `useOrderBook`、`useLastPrice` |
| `src/__tests__/logic/*.test.ts` | 純邏輯 |
| `src/__tests__/pages/SocketHealthPage.test.tsx` | **略過**（`describe.skip`，見 §5） |
| `src/__tests__/socketHealth/*.test.ts` | **略過**（診斷頁輔助邏輯） |
| `src/__tests__/ws/wsAppPingPong.test.ts` | 應用層 ping／pong |

---

## 3. 未追求部分分支／函式 100% 的原因（與效能一致）

### `useOrderBook.ts` / `useLastPrice.ts`

以下路徑**仍有儀器化缺口**，若要硬補常需 **極窄競態編排**（例如：`connect()` 在 `mountedRef === false` 時早退、`onclose` 裡 `wsRef` 與舊 socket 的組合、`resubscribe` 內 `setTimeout(200)` 當下 socket 已非 `OPEN` 等），**測試脆、收益低、易拖慢 CI**。

| 區段（約略） | 說明 |
|--------------|------|
| `useLastPrice` 開頭 `connect` 內 `if (!mountedRef.current) return` | 需在 unmount 與排程重連交錯時才會走到。 |
| `onmessage` 內 `trade === undefined` | 正常 JSON 難以產生「陣列有長度但元素為 `undefined`」；屬防禦性分支。 |
| `onclose` 內多組 `wsRef`／`mountedRef` 判斷 | 已測「重連」「unmount 不重連」「舊 socket 訊息忽略」；其餘為細部競態。 |
| `useOrderBook` snapshot 緩衝迴圈中部分 `prevSeqNum` 組合 | 已有「緩衝回放」整合案例；再補邊角對維護成本敏感。 |

**已用低成本方式加強的項目：** `visibilitychange` 在 **WS 已是 OPEN** 時不另開連線、**重連後舊 socket 的 `onmessage` 早退**，以及將多處 **`await sleep(60~250ms)` 改為假時鐘**，縮短單次跑測時間。

### `QuoteRow.tsx`

`memo(QuoteRowInner, areEqual)` 會讓 v8 **函式（Funcs）**列出多個內部單位；**比對器 `areEqual` 本體**在 `quoteRow.logic.ts` 已單測。元件測試已含 **sell／`isNew` 閃爍、假時鐘推進 `setTimeout`、unmount cleanup**。若 Funcs 仍非 100%，多屬 **儀器化粒度**，不影響已驗證的使用者可見行為。

---

## 4. Coverage 排除的檔案（`vite.config.ts` → `test.coverage.exclude`）

| 路徑 | 原因 |
|------|------|
| `App.tsx`、`main.tsx` | 進入點，對 WS／訂單簿邏輯指標幫助有限。 |
| `types.ts` | 純型別。 |
| `src/__tests__/**`、`**/*.test.*` | 測試碼本身。 |
| `src/pages/SocketHealthPage.tsx` | 工程師用診斷頁，非產品主路徑。 |
| `src/socketHealth/**` | 診斷頁專用模組（含 store／圖表等）。 |
| `src/styles/socketHealth*.style.ts` | 診斷頁樣式。 |

---

## 5. 刻意略過的測試（`describe.skip`）

以下檔內為 **`describe.skip`**，**預設不執行**，避免診斷 UI 拖累跑速或穩定度；日後若要啟用，將 `describe.skip` 改回 `describe` 即可。

- `src/__tests__/pages/SocketHealthPage.test.tsx`
- `src/__tests__/socketHealth/socketHealthLabels.test.ts`
- `src/__tests__/socketHealth/buildLatencyChartData.test.ts`

---

## 6. 應用層 ping／pong 測試策略

| 項目 | 作法 |
|------|------|
| **辨識 `pong`** | `isWsAppPongMessage` 單元測試（字串／空白／非字串）。 |
| **日誌** | `logWsAppPingSent` / `logWsAppPongReceived` 在 `VITE_WS_PING_LOG` 與 `import.meta.env.DEV` 各組合下以 `vi.stubEnv` + `vi.resetModules()` 動態載入模組驗證（不影響正式 bundle 的常數折疊）。 |
| **週期送 `ping`** | **不使用** `vi.advanceTimersByTime(25000)` 驅動真實 `setInterval`：在 Vitest 上可能因週期計時器反覆排程而**長時間迴圈或逾時**。改為 **mock `setInterval`**，手動呼叫註冊的 callback（見 `wsAppPingPong.test.ts`）。 |
| **與 hooks 整合** | `useOrderBook` / `useLastPrice` 以 `simulateRawMessage('pong')` 覆蓋 `onmessage` 內 **早退不解析 JSON** 的路徑。 |

---

## 7. 指令

```bash
npm test              # 全部單元／整合測試
npm run test:coverage # v8 覆蓋率（文字 + html）
```

`wsAppPingPong.ts` 在納入範圍內可達 **陳述／分支／行 100%**。整體儀表板若 **Branch** 或 **QuoteRow Funcs** 未滿，請對照 **§1（與診斷頁無關）** 與 **§3（刻意權衡）**；**§2、§5** 則對應實際有哪些測試在跑、哪些略過。
