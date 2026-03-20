import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderBookView from '../../components/OrderBookView';

const mockAskRows = [
  { quote: { price: 102, size: 30, total: 60, barPercent: 40 }, side: 'sell' as const, barPercent: 40, prevSize: undefined, isNew: false },
  { quote: { price: 101, size: 20, total: 30, barPercent: 20 }, side: 'sell' as const, barPercent: 20, prevSize: undefined, isNew: false },
];

const mockBidRows = [
  { quote: { price: 99, size: 25, total: 25, barPercent: 30 }, side: 'buy' as const, barPercent: 30, prevSize: undefined, isNew: false },
  { quote: { price: 98, size: 15, total: 40, barPercent: 50 }, side: 'buy' as const, barPercent: 50, prevSize: undefined, isNew: false },
];

const defaultProps = {
  askRows: mockAskRows,
  bidRows: mockBidRows,
  lastPrice: 100.5,
  lastPriceDirection: 'up' as const,
  status: 'connected' as const,
};

function renderView(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('OrderBookView', () => {
  it('should show loading spinner when connecting with no data', () => {
    renderView(
      <OrderBookView
        {...defaultProps}
        status="connecting"
        askRows={[]}
        bidRows={[]}
      />
    );
    expect(screen.getByText('Loading order book...')).toBeInTheDocument();
  });

  it('should render ask and bid prices', () => {
    renderView(<OrderBookView {...defaultProps} />);
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
  });

  it('should render sizes and totals', () => {
    renderView(<OrderBookView {...defaultProps} />);
    expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('should show Reconnecting badge when disconnected', () => {
    renderView(<OrderBookView {...defaultProps} status="disconnected" />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('should show Connecting badge when reconnecting with stale data', () => {
    renderView(<OrderBookView {...defaultProps} status="connecting" />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should show last price with arrow', () => {
    renderView(<OrderBookView {...defaultProps} />);
    expect(screen.getByText('100.5')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });
});
