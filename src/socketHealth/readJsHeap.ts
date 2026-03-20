export interface JsHeapReading {
  usedMb: number;
  limitMb: number | null;
}

/** Chrome / Edge 等 Chromium；其餘回傳 null */
export function readJsHeap(): JsHeapReading | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit?: number };
  };
  const m = perf.memory;
  if (!m || typeof m.usedJSHeapSize !== 'number') return null;
  const usedMb = m.usedJSHeapSize / (1024 * 1024);
  const limitMb =
    typeof m.jsHeapSizeLimit === 'number' && m.jsHeapSizeLimit > 0
      ? m.jsHeapSizeLimit / (1024 * 1024)
      : null;
  return { usedMb, limitMb };
}

export function formatHeapMb(reading: JsHeapReading | null): string {
  if (!reading) return '—（此瀏覽器未暴露 memory）';
  const u = reading.usedMb.toFixed(1);
  if (reading.limitMb != null) {
    return `${u} MB / 上限約 ${reading.limitMb.toFixed(0)} MB`;
  }
  return `${u} MB`;
}
