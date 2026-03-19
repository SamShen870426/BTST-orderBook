import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderBookView from '../../components/OrderBookView';

const mockAskRows = [
  { quote: { price: 102, size: 30, total: 60 }, side: 'sell' as const, barPercent: 40, prevSize: undefined, isNew: false },
  { quote: { price: 101, size: 20, total: 30 }, side: 'sell' as const, barPercent: 20, prevSize: undefined, isNew: false },
];

const mockBidRows = [
  { quote: { price: 99, size: 25, total: 25 }, side: 'buy' as const, barPercent: 30, prevSize: undefined, isNew: false },
  { quote: { price: 98, size: 15, total: 40 }, side: 'buy' as const, barPercent: 50, prevSize: undefined, isNew: false },
];

const defaultProps = {
  askRows: mockAskRows,
  bidRows: mockBidRows,
  lastPrice: 100.5,
  lastPriceDirection: 'up' as const,
  status: 'connected' as const,
  groupLevel: 0,
  onGroupChange: vi.fn(),
};

describe('OrderBookView', () => {
  it('should show loading spinner when connecting with no data', () => {
    render(
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
    render(<OrderBookView {...defaultProps} />);
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
  });

  it('should render sizes and totals', () => {
    render(<OrderBookView {...defaultProps} />);
    expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('should show Reconnecting badge when disconnected', () => {
    render(<OrderBookView {...defaultProps} status="disconnected" />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('should show Connecting badge when reconnecting with stale data', () => {
    render(<OrderBookView {...defaultProps} status="connecting" />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should render grouping buttons', () => {
    render(<OrderBookView {...defaultProps} />);
    expect(screen.getByText('0.1')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });

  it('should call onGroupChange when grouping button clicked', () => {
    const onGroupChange = vi.fn();
    render(<OrderBookView {...defaultProps} onGroupChange={onGroupChange} />);

    fireEvent.click(screen.getByText('0.5'));
    expect(onGroupChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('10'));
    expect(onGroupChange).toHaveBeenCalledWith(4);
  });

  it('should show last price with arrow', () => {
    render(<OrderBookView {...defaultProps} />);
    expect(screen.getByText('100.5')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });
});
