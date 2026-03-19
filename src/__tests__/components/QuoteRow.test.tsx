import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import QuoteRow from '../../components/QuoteRow';

const baseProps = {
  quote: { price: 100, size: 10, total: 50 },
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
        quote={{ price: 75234.5, size: 1234, total: 56789 }}
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
      <QuoteRow {...baseProps} quote={{ ...baseProps.quote, size: 15 }} prevSize={5} />
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should render with sell side (red color)', () => {
    const { container } = render(<QuoteRow {...baseProps} side="sell" />);
    const sellPriceCell = container.querySelector('[style*="rgb(255, 91, 90)"]');
    expect(sellPriceCell).toBeInTheDocument();
    expect(sellPriceCell).toHaveTextContent('100');
  });
});
