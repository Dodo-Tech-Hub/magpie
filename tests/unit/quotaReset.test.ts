import { nextQuotaReset } from '@/move/quotaReset';

const iso = (s: string) => new Date(s);

describe('nextQuotaReset (midnight Pacific Time)', () => {
  it.each([
    ['winter (PST, UTC-8)', '2026-01-15T10:00:00Z', '2026-01-16T08:00:00Z'],
    ['summer (PDT, UTC-7)', '2026-07-01T12:00:00Z', '2026-07-02T07:00:00Z'],
    ['exactly at midnight gives the next midnight', '2026-07-02T07:00:00Z', '2026-07-03T07:00:00Z'],
    ['evening in Pacific rolls to the next UTC day', '2026-07-01T23:30:00Z', '2026-07-02T07:00:00Z'],
    ['day before spring forward (Mar 7 2026)', '2026-03-07T20:00:00Z', '2026-03-08T08:00:00Z'],
    ['spring forward day, after the switch', '2026-03-08T12:00:00Z', '2026-03-09T07:00:00Z'],
    ['day before fall back (Oct 31 2026)', '2026-10-31T20:00:00Z', '2026-11-01T07:00:00Z'],
    ['fall back day, after the switch', '2026-11-01T12:00:00Z', '2026-11-02T08:00:00Z'],
    ['year end', '2026-12-31T20:00:00Z', '2027-01-01T08:00:00Z'],
  ])('%s', (_name, now, expected) => {
    expect(nextQuotaReset(iso(now)).toISOString()).toBe(iso(expected).toISOString());
  });
});
