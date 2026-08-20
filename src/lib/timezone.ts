export const DEFAULT_TIMEZONE = process.env.USER_TIMEZONE ?? "Asia/Manila";

// A curated shortlist for the settings dropdown. Values are IANA zone ids
// (DST-correct automatically — e.g. America/Los_Angeles is PDT in summer, PST
// in winter). Users can still store any valid IANA zone via the API.
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "Etc/UTC", label: "GMT / UTC" },
  { value: "America/Los_Angeles", label: "Pacific Time — PDT/PST (Los Angeles)" },
  { value: "America/Denver", label: "Mountain Time — MDT/MST (Denver)" },
  { value: "America/Chicago", label: "Central Time — CDT/CST (Chicago)" },
  { value: "America/New_York", label: "Eastern Time — EDT/EST (New York)" },
  { value: "Europe/London", label: "London — GMT/BST" },
  { value: "Europe/Paris", label: "Central Europe — CET/CEST (Paris)" },
  { value: "Asia/Dubai", label: "Gulf — GST (Dubai)" },
  { value: "Asia/Kolkata", label: "India — IST (Kolkata)" },
  { value: "Asia/Singapore", label: "Singapore — SGT" },
  { value: "Asia/Manila", label: "Philippines — PHT (Manila)" },
  { value: "Asia/Tokyo", label: "Japan — JST (Tokyo)" },
  { value: "Australia/Sydney", label: "Sydney — AEDT/AEST" },
  { value: "Pacific/Auckland", label: "Auckland — NZDT/NZST" },
];

// True if `tz` is a valid IANA timezone the runtime recognizes.
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function partsMap(instant: Date, timeZone: string, weekday: boolean): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(weekday ? { weekday: "short" as const } : {}),
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    map[part.type] = part.value;
  }
  return map;
}

// Offset (ms) such that: zoned-local-time = instant + offset.
function offsetAt(instant: Date, timeZone: string): number {
  const map = partsMap(instant, timeZone, false);
  // formatToParts only carries whole-second precision, so re-attach the
  // instant's own millisecond component (identical in both the zoned local
  // time and UTC, since real-world offsets are always whole minutes) to
  // avoid it leaking in as up-to-999ms of spurious offset error.
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
    instant.getUTCMilliseconds(),
  );
  return asUTC - instant.getTime();
}

// Converts a zoned wall-clock time back into a real UTC instant using a
// two-pass offset lookup: the first pass estimates the offset from the naive
// guess, the second pass recomputes it from the resulting candidate instant
// so DST transitions resolve correctly.
function wallTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offset1 = offsetAt(new Date(naiveUTC), timeZone);
  const candidate = naiveUTC - offset1;
  const offset2 = offsetAt(new Date(candidate), timeZone);
  return new Date(naiveUTC - offset2);
}

/**
 * Interpret a naive local date (+ optional time) as a real UTC instant in the
 * given zone. `date` is "YYYY-MM-DD"; `time` is "HH:mm" (defaults to midnight,
 * i.e. a date-only/all-day task). Returns null if the strings don't parse.
 *
 * This is how a user-picked "Aug 21, 3:00 PM" becomes a stored instant: the
 * wall-clock is anchored to the user's chosen timezone, not the server's or the
 * browser's — so a schedule set in one zone reads correctly from any device.
 */
export function wallTimeToInstant(
  date: string,
  time: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dm) return null;
  let hour = 0;
  let minute = 0;
  if (time) {
    const tm = /^(\d{2}):(\d{2})$/.exec(time);
    if (!tm) return null;
    hour = Number(tm[1]);
    minute = Number(tm[2]);
    if (hour > 23 || minute > 59) return null;
  }
  return wallTimeToUTC(
    Number(dm[1]),
    Number(dm[2]),
    Number(dm[3]),
    hour,
    minute,
    0,
    0,
    timeZone,
  );
}

// Wall-clock parts of an instant in the given IANA timezone.
export function zonedParts(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): ZonedParts {
  const map = partsMap(instant, timeZone, true);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday],
  };
}

// Real UTC Date for the start of the timezone-local calendar day containing 'instant'.
export function startOfZonedDay(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day } = zonedParts(instant, timeZone);
  return wallTimeToUTC(year, month, day, 0, 0, 0, 0, timeZone);
}

// Real UTC Date for the end of the timezone-local calendar day containing 'instant'.
export function endOfZonedDay(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day } = zonedParts(instant, timeZone);
  return wallTimeToUTC(year, month, day, 23, 59, 59, 999, timeZone);
}

// Instant 'days' calendar days later at the same wall-clock time in the zone.
export function addZonedDays(instant: Date, days: number, timeZone: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day, hour, minute, second } = zonedParts(instant, timeZone);
  const ms = instant.getUTCMilliseconds();
  // Let Date.UTC normalize month/day overflow from adding `days`.
  const naiveTarget = new Date(Date.UTC(year, month - 1, day + days, hour, minute, second, ms));
  return wallTimeToUTC(
    naiveTarget.getUTCFullYear(),
    naiveTarget.getUTCMonth() + 1,
    naiveTarget.getUTCDate(),
    naiveTarget.getUTCHours(),
    naiveTarget.getUTCMinutes(),
    naiveTarget.getUTCSeconds(),
    naiveTarget.getUTCMilliseconds(),
    timeZone,
  );
}

// Intl-based display formatting of an instant, rendered in the zone.
export function formatInTZ(
  instant: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(instant);
}

export function zonedYmd(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function zonedHm(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const { hour, minute } = zonedParts(instant, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}
