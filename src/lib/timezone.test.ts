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
