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

/** Total 欄位容器：深度條僅在此區域內顯示，不延伸至 Price/Size */
export const TotalCellWrapper = styled.div`
  position: relative;
  flex: 0 0 120px;
  width: 120px;
  min-width: 120px;
  padding-left: 8px;
  box-sizing: border-box;
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
  display: block;
  flex: 0 0 120px;
  width: 120px;
  min-width: 120px;
  box-sizing: border-box;
  text-align: left;
`;

export const SizeCell = styled(CellBase)<{ $flash?: FlashName }>`
  display: block;
  flex: 0 0 100px;
  width: 100px;
  min-width: 100px;
  box-sizing: border-box;
  border-radius: 2px;
  padding: 1px 4px;
  text-align: right;
  ${({ $flash }) => flashAnimation($flash)}
`;

export const TotalCell = styled(CellBase)`
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  text-align: right;
`;

export const HeadCell = styled(CellBase)``;

export const HeadPriceCell = styled(HeadCell)`
  display: block;
  flex: 0 0 120px;
  width: 120px;
  min-width: 120px;
  box-sizing: border-box;
  text-align: left;
`;

export const HeadSizeCell = styled(HeadCell)`
  display: block;
  flex: 0 0 100px;
  width: 100px;
  min-width: 100px;
  box-sizing: border-box;
  text-align: right;
`;

export const HeadTotalCell = styled(HeadCell)`
  display: block;
  flex: 0 0 120px;
  width: 120px;
  min-width: 120px;
  padding-left: 8px;
  box-sizing: border-box;
  text-align: right;
`;
