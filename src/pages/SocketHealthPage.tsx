import { memo, useEffect, useMemo, useState } from 'react';
import {
  socketHealthGetSnapshot,
  SOCKET_HEALTH_STALE_MS,
  type SocketHealthSlotSnapshot,
} from '../socketHealth/socketHealthStore';
import {
  formatAgo,
  socketHealthReadyStateLabel,
  socketHealthUiStatus,
} from '../socketHealth/socketHealthLabels';
import { MessagePulse } from '../socketHealth/MessagePulse';
import { LatencyAreaChart } from '../socketHealth/LatencyAreaChart';
import { formatHeapMb, readJsHeap } from '../socketHealth/readJsHeap';
import { WS_APP_PING_INTERVAL_MS } from '../ws/wsAppPingPong';
import * as S from '../styles/socketHealth.style';

const POLL_MS = 1000;

function statusBadgeText(status: ReturnType<typeof socketHealthUiStatus>): string {
  switch (status) {
    case 'ok':
      return '活躍';
    case 'stale':
      return '久無訊息';
    case 'connecting':
      return '連線中';
    case 'down':
      return '未連線';
    default:
      return '';
  }
}

const SlotCard = memo(function SlotCard({
  slot,
  now,
}: {
  slot: SocketHealthSlotSnapshot;
  now: number;
}) {
  const ui = socketHealthUiStatus(slot, now);

  return (
    <S.Card>
      <S.CardTitle $status={ui}>
        {slot.label}
        <S.Badge $variant={ui}>{statusBadgeText(ui)}</S.Badge>
      </S.CardTitle>
      <S.MetaGrid>
        <S.Dt>協定狀態</S.Dt>
        <S.Dd>
          <strong style={{ color: slot.readyState === 1 ? S.ACCENT_OK : undefined }}>
            {socketHealthReadyStateLabel(slot.readyState)}
          </strong>
          <span style={{ color: S.TEXT_MUTED }}> （{slot.readyState}）</span>
        </S.Dd>
        <S.Dt>每秒訊息數</S.Dt>
        <S.Dd>
          <span style={{ color: S.ACCENT_OK, fontWeight: 600 }}>{slot.throughputMps}</span>
          <span style={{ color: S.TEXT_MUTED }}> frames/s</span>
        </S.Dd>
        <S.Dt>端點</S.Dt>
        <S.Dd>{slot.url}</S.Dd>
        <S.Dt>Subscribe</S.Dt>
        <S.Dd>{slot.subscribeTopic}</S.Dd>
        <S.Dt>最後收到訊息</S.Dt>
        <S.DdWithPulse>
          <MessagePulse slotId={slot.id} />
          {formatAgo(slot.lastMessageAt, now)}
        </S.DdWithPulse>
        <S.Dt>最後 pong</S.Dt>
        <S.Dd>{formatAgo(slot.lastPongAt, now)}</S.Dd>
        <S.Dt>最後送出 ping</S.Dt>
        <S.Dd>{formatAgo(slot.lastPingSentAt, now)}</S.Dd>
        <S.Dt>最近開啟</S.Dt>
        <S.Dd>{formatAgo(slot.lastOpenAt, now)}</S.Dd>
        <S.Dt>斷線次數（累計）</S.Dt>
        <S.Dd>{slot.closeCount}</S.Dd>
      </S.MetaGrid>
      <S.ChartBlock>
        <S.ChartCaption>
          心跳圖：近 60 秒、每秒一格；成功 pong 時會在對應秒數「噴」出尖峰（約每{' '}
          {WS_APP_PING_INTERVAL_MS / 1000} 秒一次 ping）。曲線高度為
          <strong>該窗內相對峰值（0–100%）</strong>，右下為真實 RTT 毫秒。
        </S.ChartCaption>
        <LatencyAreaChart slotId={slot.id} latencyHistory={slot.latencyHistory} now={now} />
      </S.ChartBlock>
    </S.Card>
  );
});

export default function SocketHealthPage() {
  const [now, setNow] = useState(() => Date.now());
  const [snap, setSnap] = useState(() => socketHealthGetSnapshot());
  const [heap, setHeap] = useState(() => readJsHeap());

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      setSnap(socketHealthGetSnapshot());
      setHeap(readJsHeap());
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const totalMps = useMemo(
    () => snap.orderbook.throughputMps + snap.trade.throughputMps,
    [snap.orderbook.throughputMps, snap.trade.throughputMps]
  );

  return (
    <S.Page>
      <S.BackLink to="/">← 返回 Order Book</S.BackLink>
      <S.Title>WebSocket 連線診斷</S.Title>
      <S.Intro>
        與首頁共用同一組 WebSocket，不另開連線。若行情異常，先確認是否<strong style={{ color: S.ACCENT_OK }}> 已連線</strong>
        且「最後收到訊息」約 <strong>{SOCKET_HEALTH_STALE_MS / 1000}s</strong> 內有更新。圖表為應用層 ping/pong 往返延遲（採樣較稀疏屬正常）。
      </S.Intro>

      <S.GlobalMetrics>
        <span>
          <S.MetricLabel>合計 Throughput</S.MetricLabel>
          <S.MetricStrong>{totalMps}</S.MetricStrong>
          <span style={{ color: S.TEXT_MUTED }}> msg/s</span>
        </span>
        <span>
          <S.MetricLabel>JS Heap（used）</S.MetricLabel>
          <span
            style={{
              color: S.ACCENT_LINK,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatHeapMb(heap)}
          </span>
        </span>
      </S.GlobalMetrics>

      <SlotCard slot={snap.orderbook} now={now} />
      <SlotCard slot={snap.trade} now={now} />

      <S.Note>
        Pulse 以 200ms 輪詢序號觸發閃爍；圖表與數值每秒更新。Recharts 已關閉動畫以降低 CPU。若部署在 iframe／側欄，版面會隨容器寬度收合。
      </S.Note>
    </S.Page>
  );
}
