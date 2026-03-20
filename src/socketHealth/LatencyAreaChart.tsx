import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import type { SocketHealthLatencyPoint } from './socketHealthStore';
import { buildHeartbeatChartSeries } from './buildLatencyChartData';
import { WS_APP_PING_INTERVAL_MS } from '../ws/wsAppPingPong';
import * as S from '../styles/socketHealth.style';

export interface LatencyAreaChartProps {
  slotId: 'orderbook' | 'trade';
  latencyHistory: SocketHealthLatencyPoint[];
  now: number;
}

/**
 * 類似工作管理員：淺格線、藍線 + 半透明填滿、60 秒寬度、0 基線上週期尖峰（資料來自真實 ping→pong RTT）。
 */
export const LatencyAreaChart = memo(function LatencyAreaChart({
  slotId,
  latencyHistory,
  now,
}: LatencyAreaChartProps) {
  const { rows, peakMs } = useMemo(
    () => buildHeartbeatChartSeries(latencyHistory, now, 60),
    [latencyHistory, now]
  );

  const gradId = `latency-fill-${slotId}`;

  if (latencyHistory.length === 0) {
    return (
      <S.ChartEmpty>
        <S.ChartEmptyInner>
          <p style={{ margin: '0 0 10px' }}>
            尚無 RTT 點：<strong style={{ color: S.TEXT_BRIGHT }}>ping／pong 已掛在 hooks</strong>
            （<code style={{ margin: '0 4px' }}>useOrderBook</code>／
            <code style={{ margin: '0 4px' }}>useLastPrice</code>），此圖只畫
            <strong style={{ color: S.ACCENT_OK }}>收到 pong 時</strong>算的往返毫秒。
          </p>
          <p style={{ margin: 0 }}>
            連線後會<strong style={{ color: S.ACCENT_LINK }}>立刻送第一次 ping</strong>
            ，之後約每 {WS_APP_PING_INTERVAL_MS / 1000} 秒一次；若仍全空請在 Network → WS 查看是否有純文字
            <code style={{ margin: '0 4px' }}>pong</code>。
          </p>
        </S.ChartEmptyInner>
      </S.ChartEmpty>
    );
  }

  return (
    <S.ChartFrame>
      <S.ChartHeader>
        <S.ChartHeaderLeft>RTT 相對強度（近 60 秒）</S.ChartHeaderLeft>
        <S.ChartHeaderRight>100%</S.ChartHeaderRight>
      </S.ChartHeader>
      <S.ChartPlot>
        <ResponsiveContainer width="100%" height={128} minHeight={112} minWidth={0}>
          <AreaChart
            data={rows}
            margin={{ top: 6, right: 8, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4da3ff" stopOpacity={0.42} />
                <stop offset="100%" stopColor="#4da3ff" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255, 255, 255, 0.07)"
              strokeDasharray="3 3"
              vertical
              horizontal
            />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, 59]}
              hide
            />
            <YAxis domain={[0, 100]} hide />
            <Area
              type="linear"
              dataKey="value"
              stroke="#58a6ff"
              strokeWidth={1.35}
              fill={`url(#${gradId})`}
              baseLine={0}
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </S.ChartPlot>
      <S.ChartFooter>
        <S.ChartFooterLeft>過去 60 秒</S.ChartFooterLeft>
        <S.ChartFooterRight>
          {peakMs > 0 ? `峰值 ${peakMs} ms` : '0'}
        </S.ChartFooterRight>
      </S.ChartFooter>
    </S.ChartFrame>
  );
});
