import { rowHeight } from '@/ui/ItemRow';

describe('rowHeight', () => {
  it.each([
    [1, 56],
    [2, 112],
    [0.85, 56],
  ])('at font scale %f is %i points', (scale, expected) => {
    expect(rowHeight(scale)).toBe(expected);
  });
});
