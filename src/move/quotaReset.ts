// YouTube's daily quota resets at midnight Pacific Time (research R7).
// US daylight saving: second Sunday of March to first Sunday of November, switching at 2:00 local.

const HOUR = 3_600_000;

// Day of month of the nth Sunday (1-based) in a month (month is 1-12).
function nthSunday(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

function dstRange(year: number) {
  return {
    startDay: nthSunday(year, 3, 2),
    endDay: nthSunday(year, 11, 1),
  };
}

// Is daylight time in effect at this instant?
function isDstAt(utc: Date): boolean {
  const y = utc.getUTCFullYear();
  const { startDay, endDay } = dstRange(y);
  const start = Date.UTC(y, 2, startDay, 10); // 2:00 PST = 10:00 UTC
  const end = Date.UTC(y, 10, endDay, 9); // 2:00 PDT = 09:00 UTC
  return utc.getTime() >= start && utc.getTime() < end;
}

// Is daylight time in effect at 00:00 local on this date? The switch happens at 2:00,
// so midnight on the March switch day is still PST and on the November switch day still PDT.
function isDstAtMidnight(year: number, month: number, day: number): boolean {
  const { startDay, endDay } = dstRange(year);
  const ord = month * 100 + day;
  return ord > 3 * 100 + startDay && ord <= 11 * 100 + endDay;
}

export function nextQuotaReset(now: Date): Date {
  const offset = isDstAt(now) ? -7 : -8;
  const local = new Date(now.getTime() + offset * HOUR); // read with getUTC* as Pacific wall time
  const next = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1));
  const y = next.getUTCFullYear();
  const m = next.getUTCMonth() + 1;
  const d = next.getUTCDate();
  const midnightOffset = isDstAtMidnight(y, m, d) ? -7 : -8;
  return new Date(next.getTime() - midnightOffset * HOUR);
}
