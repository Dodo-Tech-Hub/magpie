import { palettes, parseChoice } from '@/theme/theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('parseChoice', () => {
  it('keeps the three known words', () => {
    expect(parseChoice('light')).toBe('light');
    expect(parseChoice('dark')).toBe('dark');
    expect(parseChoice('system')).toBe('system');
  });

  it('treats a missing or unknown saved value as Auto', () => {
    expect(parseChoice(null)).toBe('system');
    expect(parseChoice('blue')).toBe('system');
    expect(parseChoice('')).toBe('system');
  });
});

describe.each(['light', 'dark'] as const)('%s colors', (look) => {
  const c = palettes[look];

  it.each(['text', 'muted', 'primary', 'success', 'danger', 'warning'] as const)(
    '%s is readable on the background (FR-014)',
    (name) => {
      expect(contrast(c[name], c.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('text on a filled primary button is readable', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('text is readable on the picked-row tint', () => {
    expect(contrast(c.text, c.primarySoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('platform card text is readable (FR-018): name and label on the background, note on its tint', () => {
    expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.muted, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, c.primarySoft)).toBeGreaterThanOrEqual(4.5);
  });
});
