const DAY_MS = 24 * 60 * 60 * 1000;

type ParsedYmd = {
  midnightUtc: Date;
};

function parseYyyyMmDd(value: string): ParsedYmd | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yyyy, mm, dd] = value.split("-").map((part) => Number(part));
  if (!yyyy || !mm || !dd) return null;
  const midnightUtc = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    midnightUtc.getUTCFullYear() !== yyyy ||
    midnightUtc.getUTCMonth() !== mm - 1 ||
    midnightUtc.getUTCDate() !== dd
  ) {
    return null;
  }
  return { midnightUtc };
}

export type DateRangeResult =
  | {
      ok: true;
      sinceIso: string;
      untilIso: string;
    }
  | { ok: false; error: string };

export function buildDateRangeFromPreset(days: 7 | 30 | 60): DateRangeResult {
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  return { ok: true, sinceIso: since.toISOString(), untilIso: now.toISOString() };
}

export function buildDateRangeFromYmd(
  sinceYmd: string,
  untilYmd: string,
  maxDaysInclusive: number,
): DateRangeResult {
  const sinceParsed = parseYyyyMmDd(sinceYmd);
  if (!sinceParsed) return { ok: false, error: "Invalid `since` (expected YYYY-MM-DD)." };
  const untilParsed = parseYyyyMmDd(untilYmd);
  if (!untilParsed) return { ok: false, error: "Invalid `until` (expected YYYY-MM-DD)." };

  const sinceMidnight = sinceParsed.midnightUtc;
  const untilMidnight = untilParsed.midnightUtc;

  const daysInclusive =
    Math.floor((untilMidnight.getTime() - sinceMidnight.getTime()) / DAY_MS) + 1;
  if (daysInclusive < 1) return { ok: false, error: "`until` must be on/after `since`." };
  if (daysInclusive > maxDaysInclusive) {
    return { ok: false, error: `Date range must be ${maxDaysInclusive} days or less.` };
  }

  const untilEndOfDay = new Date(untilMidnight.getTime() + DAY_MS - 1);
  return {
    ok: true,
    sinceIso: sinceMidnight.toISOString(),
    untilIso: untilEndOfDay.toISOString(),
  };
}

