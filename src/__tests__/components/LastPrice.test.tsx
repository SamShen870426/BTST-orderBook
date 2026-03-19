import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LastPrice from '../../components/LastPrice';

describe('LastPrice', () => {
  it('should show "--" when price is null', () => {
    render(<LastPrice price={null} direction="same" />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('should show formatted price', () => {
    render(<LastPrice price={75234.7} direction="same" />);
    expect(screen.getByText('75,234.7')).toBeInTheDocument();
  });

  it('should show up arrow when direction is up', () => {
    render(<LastPrice price={75000} direction="up" />);
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('should show down arrow when direction is down', () => {
    render(<LastPrice price={75000} direction="down" />);
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('should not show arrow when direction is same', () => {
    render(<LastPrice price={75000} direction="same" />);
    expect(screen.queryByText('↑')).not.toBeInTheDocument();
    expect(screen.queryByText('↓')).not.toBeInTheDocument();
  });
});
