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

export const GroupingBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px;
  border-bottom: 1px solid rgba(134, 152, 170, 0.1);
`;

export const GroupingLabel = styled.span`
  font-size: 11px;
  color: ${COLORS.textHead};
  margin-right: 4px;
`;

export const GroupingButton = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? 'rgba(16, 186, 104, 0.15)' : 'none')};
  border: 1px solid ${({ $active }) => ($active ? COLORS.buyPrice : 'rgba(134, 152, 170, 0.2)')};
  color: ${({ $active }) => ($active ? COLORS.buyPrice : COLORS.textHead)};
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ $active }) => ($active ? COLORS.buyPrice : 'rgba(134, 152, 170, 0.5)')};
    color: ${({ $active }) => ($active ? COLORS.buyPrice : COLORS.textDefault)};
  }
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
