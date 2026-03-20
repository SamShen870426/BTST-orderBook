/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 設為 "true" 時在非 dev 也輸出 WS ping/pong 日誌 */
  readonly VITE_WS_PING_LOG?: string;
}
