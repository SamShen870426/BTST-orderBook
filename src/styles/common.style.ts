import styled, { keyframes } from 'styled-components';
import { COLORS } from '../constants';

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid rgba(134, 152, 170, 0.2);
  border-top-color: ${COLORS.textHead};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

export const StatusBadge = styled.span<{ $variant: 'disconnected' | 'connecting' }>`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: 400;
  background-color: ${({ $variant }) =>
    $variant === 'disconnected' ? 'rgba(255, 91, 90, 0.2)' : 'rgba(134, 152, 170, 0.2)'};
  color: ${({ $variant }) =>
    $variant === 'disconnected' ? COLORS.sellPrice : COLORS.textHead};
`;
