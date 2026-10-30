import { describe, expect, it } from "vitest";
import { formatDate, formatTime, todayDayOfWeek, todayIso } from "./time";

describe("practice dates", () => {
  // 22:00 UTC on Sunday is 08:00 Monday in Brisbane.
  const mondayMorning = new Date("2026-11-01T22:00:00Z");

  it("uses the Brisbane date, not the UTC date", () => {
    expect(todayIso(mondayMorning)).toBe("2026-11-02");
  });

  it("matches day_of_week numbering", () => {
    expect(todayDayOfWeek(mondayMorning)).toBe(1);
    expect(todayDayOfWeek(new Date("2026-11-01T02:00:00Z"))).toBe(0);
  });
});

describe("formatting", () => {
  it("trims seconds from times", () => {
    expect(formatTime("09:30:00")).toBe("09:30");
  });

  it("shows Australian dates", () => {
    expect(formatDate("2026-03-09")).toBe("09/03/2026");
  });
});
