import type { SocketHealthLatencyPoint } from './socketHealthStore';

/** 單秒資料：idx 0 = 約 60 秒前，59 = 現在這一秒 */
export interface HeartbeatChartRow {
  idx: number;
  /** 該秒內 pong RTT（毫秒），無則 0 → 圖上貼底形成「心跳尖峰」 */
  msRaw: number;
  /** 近窗內相對峰值 0–100，類似工作管理員「使用率」視覺 */
  value: number;
}

/**
 * 最近 60 秒、每秒一格；無樣本為 0（連續面積圖 + 週期尖峰）。
 * value 為相對強度：峰值 bucket = 100%，其餘非零依比例，便於小 RTT 也能「噴上去」。
 */
export function buildHeartbeatChartSeries(
  latencyHistory: SocketHealthLatencyPoint[],
  now: number,
  bucketCount = 60
): { rows: HeartbeatChartRow[]; peakMs: number } {
  const msPerBucket: number[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const secEnd = now - (bucketCount - 1 - i) * 1000;
    const secStart = secEnd - 1000;
    const inBucket = latencyHistory.filter((p) => p.t > secStart && p.t <= secEnd);
    const ms =
      inBucket.length > 0 ? Math.round(Math.max(...inBucket.map((p) => p.ms))) : 0;
    msPerBucket.push(ms);
  }

  const peakMs = Math.max(...msPerBucket, 0);
  const denom = peakMs > 0 ? peakMs : 1;

  const rows: HeartbeatChartRow[] = msPerBucket.map((msRaw, idx) => ({
    idx,
    msRaw,
    value: msRaw <= 0 ? 0 : (msRaw / denom) * 100,
  }));

  return { rows, peakMs };
}
