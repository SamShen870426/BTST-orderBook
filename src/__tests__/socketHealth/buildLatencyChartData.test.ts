import { describe, it, expect } from 'vitest';
import { buildHeartbeatChartSeries } from '../../socketHealth/buildLatencyChartData';

describe('buildHeartbeatChartSeries', () => {
  it('60 個 bucket；有 pong 的秒取最大 ms，並換算相對強度 0–100', () => {
    const now = 1_000_000;
    const history = [
      { t: now - 500, ms: 100 },
      { t: now - 400, ms: 200 },
    ];
    const { rows, peakMs } = buildHeartbeatChartSeries(history, now, 60);
    expect(rows).toHaveLength(60);
    expect(peakMs).toBe(200);
    const last = rows[59];
    expect(last).toBeDefined();
    expect(last!.msRaw).toBe(200);
    expect(last!.value).toBe(100);
    expect(rows[58]!.msRaw).toBe(0);
    expect(rows[58]!.value).toBe(0);
  });

  it('無歷史時全為 0、peakMs 為 0', () => {
    const now = 2_000_000;
    const { rows, peakMs } = buildHeartbeatChartSeries([], now, 60);
    expect(peakMs).toBe(0);
    expect(rows.every((r) => r.msRaw === 0 && r.value === 0)).toBe(true);
  });
});
