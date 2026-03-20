/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/vite-env.d.ts',
        // 啟動／純型別：納入會拉低儀表板且與 WS 心跳無關
        'src/App.tsx',
        'src/main.tsx',
        'src/types.ts',
        // 工程師用 /socket-health 診斷頁與其模組，不計入產品覆蓋率
        'src/pages/SocketHealthPage.tsx',
        'src/socketHealth/**',
        'src/styles/socketHealth*.style.ts',
      ],
    },
  },
});
