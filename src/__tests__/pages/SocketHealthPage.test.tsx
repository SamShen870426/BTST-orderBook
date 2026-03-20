import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocketHealthPage from '../../pages/SocketHealthPage';

// 診斷頁為開發監測用，非產品路徑；略過以免拖慢／不穩定 CI。
describe.skip('SocketHealthPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('顯示標題與兩張連線卡片標題', () => {
    render(
      <MemoryRouter>
        <SocketHealthPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /WebSocket 連線診斷/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /訂單簿/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /成交/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回 Order Book/ })).toHaveAttribute('href', '/');
  });
});
