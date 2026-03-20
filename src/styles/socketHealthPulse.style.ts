import styled, { keyframes } from 'styled-components';

const breathe = keyframes`
  0%,
  100% {
    opacity: 0.65;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
`;

const flashBurst = keyframes`
  0% {
    transform: scale(0.6);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(46, 212, 138, 0.95);
  }
  100% {
    transform: scale(2.4);
    opacity: 0;
    box-shadow: 0 0 0 14px rgba(46, 212, 138, 0);
  }
`;

export const PulseRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
`;

export const DotWrap = styled.span`
  position: relative;
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
`;

/** 常態呼吸 */
export const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #6ef3a8, #1fa855);
  animation: ${breathe} 2.2s ease-in-out infinite;
`;

/** 新訊息時以 key 重掛載，播放單次擴散 */
export const FlashBurst = styled.span`
  position: absolute;
  width: 8px;
  height: 8px;
  left: 50%;
  top: 50%;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: rgba(110, 243, 168, 0.95);
  pointer-events: none;
  animation: ${flashBurst} 0.5s ease-out forwards;
`;
