# 測試與覆蓋率 — 效能權衡說明

本檔補充 [`TESTING.md`](./TESTING.md)：**為何某些路徑刻意不全測**、**ping/pong 怎麼測**、以及 **coverage 排除項目**。專案以**執行期效能**為優先，測試設計避免長假時鐘、過度動態匯入與脆弱競態劇本。

---

## 1. 應用層 ping／pong 測試策略

| 項目 | 作法 |
|------|------|
| **辨識 `pong`** | `isWsAppPongMessage` 單元測試（字串／空白／非字串）。 |
| **日誌** | `logWsAppPingSent` / `logWsAppPongReceived` 在 `VITE_WS_PING_LOG` 與 `import.meta.env.DEV` 各組合下以 `vi.stubEnv` + `vi.resetModules()` 動態載入模組驗證（不影響正式 bundle 的常數折疊）。 |
| **週期送 `ping`** | **不使用** `vi.advanceTimersByTime(25000)` 驅動真實 `setInterval`：在 Vitest 上可能因週期計時器反覆排程而**長時間迴圈或逾時**，拖慢 CI／本機。改為 **mock `setInterval`**，手動呼叫註冊的 callback，語意等同「某一個 ping 週期到期」，**零額外延遲、不改產品邏輯**。 |
| **與 hooks 整合** | `useOrderBook` / `useLastPrice` 以 `simulateRawMessage('pong')` 覆蓋 `onmessage` 內 **早退不解析 JSON** 的路徑（與正式環境行為一致）。 |

---

## 2. 未追求 100% 分支／函式覆蓋的原因（與效能一致）

### `useOrderBook.ts` / `useLastPrice.ts` 分支覆蓋率 &lt; 100%

- 內含大量 **競態防護**（`mountedRef`、`wsRef.current !== ws`、unmount 後不重連等）。
- 要「枝枝節節」補滿常需 **順序敏感的整合測試** 與 **更多假時鐘**，測試時間與維護成本上升，與「效能優先」目標不一致。
- **商業邏輯**、**pong 早退**、**活動逾時**、**重連／visibility** 等已由現有案例覆蓋。

### `QuoteRow.tsx` 函式覆蓋率 &lt; 100%

- `memo(QuoteRowInner, areEqual)` 會讓儀器化列出多個內部函式；部分 **effect cleanup／`setTimeout` 回呼** 若要强求全觸發，會增加假時鐘與 unmount 編排測試。
- **使用者可見行為**（價量顯示、flash、`isNew`／`side` 變更）已由元件測試覆蓋。

---

## 3. Coverage 排除的檔案（`vite.config.ts`）

| 檔案 | 原因 |
|------|------|
| `App.tsx`、`main.tsx` | 應用程式進入點，對 WS／訂單簿邏輯品質指標幫助有限。 |
| `types.ts` | 純型別，無執行期程式碼。 |
| `src/__tests__/**`、`**/*.test.*` | 測試碼本身。 |

---

## 4. 指令

```bash
npm test              # 全部單元／整合測試
npm run test:coverage # v8 覆蓋率（文字 + html）
```

`wsAppPingPong.ts` 在納入範圍內可達 **陳述／分支／行 100%**；整體儀表板若出現 hooks 或 `QuoteRow` 函式覆蓋非 100%，屬上列**刻意權衡**，而非漏測 ping/pong 核心路徑。
