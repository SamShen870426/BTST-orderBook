import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const PAGE_BG = '#0d1117';
export const PAGE_CARD_BG = 'rgba(22, 27, 34, 0.92)';
export const PAGE_BORDER = 'rgba(48, 54, 61, 0.95)';
export const TEXT_MUTED = '#8b949e';
export const TEXT_BRIGHT = '#e6edf3';
export const ACCENT_OK = '#3fb950';
export const ACCENT_LINK = '#58a6ff';
export const ACCENT_WARN = '#d29922';

export const Page = styled.div`
  min-height: 100vh;
  box-sizing: border-box;
  width: 100%;
  max-width: min(720px, 100%);
  margin: 0 auto;
  padding: clamp(16px, 3vw, 28px) clamp(14px, 3vw, 24px) 48px;
  background: ${PAGE_BG};
  color: ${TEXT_BRIGHT};
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
`;

export const BackLink = styled(Link)`
  display: inline-block;
  margin-bottom: 18px;
  font-size: 13px;
  color: ${ACCENT_LINK};
  text-decoration: none;
  font-weight: 500;
  &:hover {
    color: #79c0ff;
    text-decoration: underline;
  }
`;

export const Title = styled.h1`
  margin: 0 0 6px;
  font-size: clamp(1.15rem, 2.5vw, 1.35rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  color: ${TEXT_BRIGHT};
`;

export const Intro = styled.p`
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.55;
  color: ${TEXT_MUTED};
`;

export const GlobalMetrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 18px;
  border-radius: 8px;
  border: 1px solid ${PAGE_BORDER};
  background: ${PAGE_CARD_BG};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  color: ${TEXT_MUTED};
`;

export const MetricStrong = styled.span`
  color: ${ACCENT_OK};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;

export const MetricLabel = styled.span`
  color: ${TEXT_MUTED};
  margin-right: 6px;
`;

export const Card = styled.section`
  border: 1px solid ${PAGE_BORDER};
  border-radius: 10px;
  padding: clamp(12px, 2vw, 16px) clamp(14px, 2.5vw, 18px);
  margin-bottom: 16px;
  background: ${PAGE_CARD_BG};
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.4);
  min-width: 0;
`;

export const CardTitle = styled.h2<{ $status: 'ok' | 'stale' | 'down' | 'connecting' }>`
  margin: 0 0 12px;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
  font-weight: 650;
  color: ${({ $status }) => {
    switch ($status) {
      case 'ok':
        return ACCENT_OK;
      case 'stale':
        return ACCENT_WARN;
      case 'connecting':
        return TEXT_MUTED;
      case 'down':
      default:
        return '#f85149';
    }
  }};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

export const Badge = styled.span<{ $variant: 'ok' | 'stale' | 'down' | 'connecting' }>`
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  ${({ $variant }) => {
    switch ($variant) {
      case 'ok':
        return `background: rgba(63, 185, 80, 0.18); color: ${ACCENT_OK}; border: 1px solid rgba(63, 185, 80, 0.35);`;
      case 'stale':
        return `background: rgba(210, 153, 34, 0.12); color: #e3b341; border: 1px solid rgba(210, 153, 34, 0.28);`;
      case 'connecting':
        return `background: rgba(139, 148, 158, 0.12); color: ${TEXT_MUTED}; border: 1px solid ${PAGE_BORDER};`;
      case 'down':
      default:
        return `background: rgba(248, 81, 73, 0.12); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3);`;
    }
  }}
`;

export const MetaGrid = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(100px, 130px) 1fr;
  gap: 8px 12px;
  font-size: 12px;
  min-width: 0;
`;

export const Dt = styled.dt`
  margin: 0;
  color: ${TEXT_MUTED};
  font-weight: 500;
`;

export const Dd = styled.dd`
  margin: 0;
  word-break: break-word;
  min-width: 0;
  color: ${TEXT_BRIGHT};
  font-variant-numeric: tabular-nums;
`;

export const DdWithPulse = styled.dd`
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
  color: ${TEXT_BRIGHT};
  font-variant-numeric: tabular-nums;
`;

export const ChartBlock = styled.div`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid ${PAGE_BORDER};
  min-width: 0;
`;

export const ChartCaption = styled.div`
  font-size: 11px;
  color: ${TEXT_MUTED};
  margin-bottom: 6px;
  font-weight: 500;
`;

/** 任務管理員式外框 */
export const ChartFrame = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid ${PAGE_BORDER};
  border-radius: 6px;
  overflow: hidden;
  background: rgba(1, 4, 9, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
`;

export const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px 4px;
  font-size: 11px;
  color: ${TEXT_MUTED};
  border-bottom: 1px solid ${PAGE_BORDER};
`;

export const ChartHeaderLeft = styled.span`
  font-weight: 600;
  color: ${TEXT_BRIGHT};
`;

export const ChartHeaderRight = styled.span`
  font-weight: 600;
  color: ${ACCENT_LINK};
  font-variant-numeric: tabular-nums;
`;

export const ChartPlot = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 112px;
  padding: 4px 4px 0;
`;

export const ChartFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px 8px;
  font-size: 10px;
  color: ${TEXT_MUTED};
`;

export const ChartFooterLeft = styled.span``;

export const ChartFooterRight = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${ACCENT_OK};
  font-weight: 600;
`;

/**
 * 勿用 flex + 多個直接子節點（文字／strong／br 會變成多個 flex item → 重新整理時直排、重疊破版）
 */
export const ChartEmpty = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 120px;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px dashed ${PAGE_BORDER};
  background: rgba(1, 4, 9, 0.45);
  font-size: 11px;
  line-height: 1.55;
  color: ${TEXT_MUTED};
`;

/** 空狀態說明：單一 flow 根，正常換行 */
export const ChartEmptyInner = styled.div`
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
  word-break: normal;
  overflow-wrap: break-word;
`;

export const Note = styled.p`
  margin: 22px 0 0;
  font-size: 11px;
  color: ${TEXT_MUTED};
  line-height: 1.5;
`;
