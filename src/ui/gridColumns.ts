// How many cards fit in a row. Bigger text means wider cards, so fewer columns (research R3).
export function columnsFor(width: number, fontScale: number): number {
  return Math.min(3, Math.max(1, Math.floor(width / (160 * fontScale))));
}
