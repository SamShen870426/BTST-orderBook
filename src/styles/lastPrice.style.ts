import styled from 'styled-components';

export const Container = styled.div.attrs<{ $bg: string }>(
  ({ $bg }) => ({
    style: { backgroundColor: $bg },
  })
)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  transition: background-color 0.3s ease;
`;

export const PriceValue = styled.span.attrs<{ $color: string }>(
  ({ $color }) => ({
    style: { color: $color },
  })
)`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
`;

export const Arrow = styled.span`
  font-size: 14px;
`;
