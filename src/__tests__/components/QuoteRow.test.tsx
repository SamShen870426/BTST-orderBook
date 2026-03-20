import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import QuoteRow from '../../components/QuoteRow';

const baseProps = {
  quote: { price: 100, size: 10, total: 50, barPercent: 20 },
  side: 'buy' as const,
  barPercent: 20,
  prevSize: undefined as number | undefined,
  isNew: false,
};

describe('QuoteRow', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render price, size, and total', () => {
    render(<QuoteRow {...baseProps} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should render formatted numbers', () => {
    render(
      <QuoteRow
        {...baseProps}
        quote={{ price: 75234.5, size: 1234, total: 56789, barPercent: 80 }}
      />
    );
    expect(screen.getByText('75,234.5')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('56,789')).toBeInTheDocument();
  });

  it('should render row with price cell', () => {
    const { container } = render(<QuoteRow {...baseProps} isNew={false} />);
    expect(container.querySelector('[style*="width: 20%"]')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render with isNew prop', () => {
    render(<QuoteRow {...baseProps} isNew={true} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should render size flash when prevSize differs', () => {
    render(
      <QuoteRow
        {...baseProps}
        quote={{ ...baseProps.quote, size: 15, barPercent: 25 }}
        prevSize={5}
      />
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should trigger row flash when isNew 從 false 變為 true', () => {
    const { rerender } = render(<QuoteRow {...baseProps} isNew={false} />);
    expect(screen.getByText('100')).toBeInTheDocument();

    act(() => {
      rerender(<QuoteRow {...baseProps} isNew={true} />);
    });
    act(() => {});

    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should not flash when isNew 維持 false 且非首次 render', () => {
    const { rerender } = render(<QuoteRow {...baseProps} isNew={false} />);
    act(() => {
      rerender(
        <QuoteRow {...baseProps} quote={{ ...baseProps.quote, total: 60, barPercent: 30 }} isNew={false} />
      );
    });
    act(() => {});
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('isNew 為 false 且 side 變更時列閃爍 effect 應早退（memo 下需改依賴觸發）', () => {
    const { rerender } = render(<QuoteRow {...baseProps} isNew={false} side="buy" />);
    act(() => {
      rerender(<QuoteRow {...baseProps} isNew={false} side="sell" />);
    });
    act(() => {});
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render with sell side (red color)', () => {
    const { container } = render(<QuoteRow {...baseProps} side="sell" />);
    const sellPriceCell = container.querySelector('[style*="rgb(255, 91, 90)"]');
    expect(sellPriceCell).toBeInTheDocument();
    expect(sellPriceCell).toHaveTextContent('100');
  });
});
