import styled from 'styled-components';
import { COLORS } from '../constants';

export const Wrapper = styled.div`
  background-color: ${COLORS.bg};
  border-radius: 8px;
  overflow: hidden;
  width: 392px;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.textDefault};
  border-bottom: 1px solid rgba(134, 152, 170, 0.15);
`;

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const TableHead = styled.div`
  display: flex;
  padding: 8px 16px;
  color: ${COLORS.textHead};
  font-size: 12px;
  border-bottom: 1px solid rgba(134, 152, 170, 0.1);
`;

export const QuoteSection = styled.div<{ $stale?: boolean }>`
  display: flex;
  flex-direction: column;
  opacity: ${({ $stale }) => ($stale ? 0.45 : 1)};
  transition: opacity 0.5s ease;
`;

export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 16px;
`;

export const LoadingText = styled.span`
  color: ${COLORS.textHead};
  font-size: 13px;
`;
