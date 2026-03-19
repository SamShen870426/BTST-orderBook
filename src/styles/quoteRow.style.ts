import styled, { keyframes, css } from 'styled-components';
import { COLORS } from '../constants';

const rowFlashGreen = keyframes`
  0%   { background-color: ${COLORS.flashGreen}; }
  100% { background-color: transparent; }
`;

const rowFlashRed = keyframes`
  0%   { background-color: ${COLORS.flashRed}; }
  100% { background-color: transparent; }
`;

const sizeFlashGreen = keyframes`
  0%   { background-color: ${COLORS.flashGreen}; }
  100% { background-color: transparent; }
`;

const sizeFlashRed = keyframes`
  0%   { background-color: ${COLORS.flashRed}; }
  100% { background-color: transparent; }
`;

const FLASH_ANIMATIONS = {
  'flash-row-green': rowFlashGreen,
  'flash-row-red': rowFlashRed,
  'flash-size-green': sizeFlashGreen,
  'flash-size-red': sizeFlashRed,
} as const;

export type FlashName = keyof typeof FLASH_ANIMATIONS | '';

function flashAnimation($flash: FlashName | undefined) {
  if (!$flash || !FLASH_ANIMATIONS[$flash]) return css`animation: none;`;
  return css`animation: ${FLASH_ANIMATIONS[$flash]} 600ms ease-out;`;
}

export const Row = styled.div<{ $flash?: FlashName }>`
  display: flex;
  padding: 4px 16px;
  position: relative;
  align-items: center;
  min-height: 28px;
  cursor: default;
  ${({ $flash }) => flashAnimation($flash)}

  &:hover {
    background-color: ${COLORS.hoverBg} !important;
  }
`;

export const Bar = styled.div.attrs<{ $width: number; $color: string }>(
  ({ $width, $color }) => ({
    style: {
      width: `${$width}%`,
      backgroundColor: $color,
    },
  })
)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  transition: width 0.3s ease;
`;

const CellBase = styled.span`
  text-align: right;
  font-size: 13px;
  z-index: 1;
  position: relative;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
`;

export const PriceCell = styled(CellBase).attrs<{ $color: string }>(
  ({ $color }) => ({
    style: { color: $color },
  })
)`
  width: 120px;
  min-width: 120px;
  text-align: left;
`;

export const SizeCell = styled(CellBase)<{ $flash?: FlashName }>`
  width: 100px;
  min-width: 100px;
  border-radius: 2px;
  padding: 1px 4px;
  ${({ $flash }) => flashAnimation($flash)}
`;

export const TotalCell = styled(CellBase)`
  width: 120px;
  min-width: 120px;
`;

export const HeadCell = styled(CellBase)``;

export const HeadPriceCell = styled(HeadCell)`
  width: 120px;
  min-width: 120px;
  text-align: left;
`;

export const HeadSizeCell = styled(HeadCell)`
  width: 100px;
  min-width: 100px;
`;

export const HeadTotalCell = styled(HeadCell)`
  width: 120px;
  min-width: 120px;
`;
