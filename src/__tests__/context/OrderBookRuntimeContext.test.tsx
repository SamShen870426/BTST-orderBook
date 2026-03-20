import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrderBookRuntime } from '../../context/OrderBookRuntimeContext';

describe('useOrderBookRuntime', () => {
  it('在 Provider 外使用時拋錯', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(() => {
        renderHook(() => useOrderBookRuntime());
      }).toThrow(/useOrderBookRuntime must be used within OrderBookRuntimeProvider/);
    } finally {
      errSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
