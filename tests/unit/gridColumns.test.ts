import { columnsFor } from '@/ui/gridColumns';

describe('columnsFor', () => {
  it.each([
    [320, 1, 2],
    [320, 2, 1],
    [411, 1, 2],
    [1000, 1, 3],
  ])('%i wide at font scale %f gives %i columns', (width, scale, expected) => {
    expect(columnsFor(width, scale)).toBe(expected);
  });

  it('never goes below 1 or above 3', () => {
    expect(columnsFor(100, 3)).toBe(1);
    expect(columnsFor(5000, 1)).toBe(3);
  });
});
