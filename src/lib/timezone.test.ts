import { describe, it, expect } from "vitest";
import {
  zonedParts,
  startOfZonedDay,
  endOfZonedDay,
  addZonedDays,
  formatInTZ,
  zonedYmd,
  zonedHm,
} from "./timezone";

// This is the trustworthy oracle for the timezone rework.
//
// Every expected value below is hand-derived from fixed, checkable facts:
//   - Asia/Manila is UTC+8 all year (no DST, ever).
//   - America/New_York is UTC-5 (EST) before the 2026-03-08 02:00 spring-forward
//     and UTC-4 (EDT) after it.
//
// The assertions are absolute UTC ISO strings, so any function that leaks the
// runner's local timezone will fail. The verifier runs this suite under both
// TZ=UTC and TZ=America/New_York; both must be green.

const MANILA = "Asia/Manila";
const NY = "America/New_York";

describe("Asia/Manila (fixed UTC+8)", () => {
  // 17:30Z -> Manila 2026-08-20 01:30 (next calendar day in Manila).
  const A = new Date("2026-08-19T17:30:00.000Z");

  it("reports the Manila wall-clock parts", () => {
    expect(zonedParts(A, MANILA)).toMatchObject({
      year: 2026,
      month: 8,
      day: 20,
      hour: 1,
      minute: 30,
      second: 0,
    });
  });

  it("computes the day window as real UTC instants", () => {
    // Manila 2026-08-20 00:00:00.000 == 2026-08-19T16:00:00.000Z
    expect(startOfZonedDay(A, MANILA).toISOString()).toBe("2026-08-19T16:00:00.000Z");
    // Manila 2026-08-20 23:59:59.999 == 2026-08-20T15:59:59.999Z
    expect(endOfZonedDay(A, MANILA).toISOString()).toBe("2026-08-20T15:59:59.999Z");
  });

  it("shifts by whole zoned days for week windows", () => {
    expect(addZonedDays(A, 7, MANILA).getTime()).toBe(A.getTime() + 7 * 86_400_000);
    // end of the Manila day 7 days later: 2026-08-27 23:59:59.999 -> 2026-08-27T15:59:59.999Z
    expect(endOfZonedDay(addZonedDays(A, 7, MANILA), MANILA).toISOString()).toBe(
      "2026-08-27T15:59:59.999Z",
    );
  });

  it("formats display strings in Manila time", () => {
    expect(zonedYmd(A, MANILA)).toBe("2026-08-20");
    expect(zonedHm(A, MANILA)).toBe("01:30");
    expect(formatInTZ(A, { month: "short", day: "numeric", year: "numeric" }, MANILA)).toBe(
      "Aug 20, 2026",
    );
    expect(formatInTZ(A, { hour: "numeric", minute: "2-digit", hour12: true }, MANILA)).toBe(
      "1:30 AM",
    );
  });

  it("keeps a late-evening instant inside the same Manila day (the core bug)", () => {
    // 15:00Z -> Manila 2026-08-19 23:00, still the 19th.
    const B = new Date("2026-08-19T15:00:00.000Z");
    expect(zonedYmd(B, MANILA)).toBe("2026-08-19");
    const start = startOfZonedDay(B, MANILA);
    const end = endOfZonedDay(B, MANILA);
    expect(start.toISOString()).toBe("2026-08-18T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-19T15:59:59.999Z");
    // A task due at 15:00Z on the 19th must fall within "today" in Manila.
    expect(B.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(B.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("uses Asia/Manila as the default timezone", () => {
    const A2 = new Date("2026-08-19T17:30:00.000Z");
    expect(startOfZonedDay(A2).toISOString()).toBe(startOfZonedDay(A2, MANILA).toISOString());
    expect(zonedYmd(A2)).toBe(zonedYmd(A2, MANILA));
  });
});

describe("America/New_York (DST boundary 2026-03-08)", () => {
  // 12:00Z on spring-forward day -> 08:00 EDT (UTC-4).
  const C = new Date("2026-03-08T12:00:00.000Z");

  it("reports EDT wall-clock parts", () => {
    expect(zonedParts(C, NY)).toMatchObject({ year: 2026, month: 3, day: 8, hour: 8 });
  });

  it("uses the correct offset on each side of the transition", () => {
    // Start of day is 00:00 EST (UTC-5) -> 05:00Z.
    expect(startOfZonedDay(C, NY).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    // End of day is 23:59:59.999 EDT (UTC-4) -> next day 03:59:59.999Z.
    expect(endOfZonedDay(C, NY).toISOString()).toBe("2026-03-09T03:59:59.999Z");
  });
});

describe("America/New_York (DST fall-back 2026-11-01)", () => {
  // 12:00Z is after the 06:00Z fall-back -> 07:00 EST (UTC-5).
  const D = new Date("2026-11-01T12:00:00.000Z");

  it("reports EST wall-clock parts", () => {
    expect(zonedParts(D, NY)).toMatchObject({ year: 2026, month: 11, day: 1, hour: 7 });
  });

  it("uses EDT for start-of-day and EST for end-of-day", () => {
    // 00:00 local is still EDT (UTC-4) -> 04:00Z.
    expect(startOfZonedDay(D, NY).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    // 23:59:59.999 local is EST (UTC-5) -> next day 04:59:59.999Z.
    expect(endOfZonedDay(D, NY).toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });

  it("holds wall-clock time when adding a day across spring-forward", () => {
    // 2026-03-07 07:00 EST -> +1 zoned day -> 2026-03-08 07:00 EDT (23h later).
    const before = new Date("2026-03-07T12:00:00.000Z");
    const after = addZonedDays(before, 1, NY);
    expect(zonedParts(after, NY)).toMatchObject({ month: 3, day: 8, hour: 7 });
    expect(after.toISOString()).toBe("2026-03-08T11:00:00.000Z");
  });
});

describe("fixed fractional-offset zones", () => {
  const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST
  const KATHMANDU = "Asia/Kathmandu"; // UTC+5:45, no DST
  const E = new Date("2026-08-19T20:00:00.000Z");

  it("handles a half-hour offset (India, +5:30)", () => {
    expect(zonedYmd(E, KOLKATA)).toBe("2026-08-20");
    expect(zonedHm(E, KOLKATA)).toBe("01:30");
    expect(startOfZonedDay(E, KOLKATA).toISOString()).toBe("2026-08-19T18:30:00.000Z");
    expect(endOfZonedDay(E, KOLKATA).toISOString()).toBe("2026-08-20T18:29:59.999Z");
  });

  it("handles a quarter-hour offset (Nepal, +5:45)", () => {
    expect(zonedHm(E, KATHMANDU)).toBe("01:45");
    expect(startOfZonedDay(E, KATHMANDU).toISOString()).toBe("2026-08-19T18:15:00.000Z");
    expect(endOfZonedDay(E, KATHMANDU).toISOString()).toBe("2026-08-20T18:14:59.999Z");
  });
});
