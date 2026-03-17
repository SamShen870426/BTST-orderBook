export function formatNumber(num: number): string {
  const parts = num.toString().split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1];
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}
