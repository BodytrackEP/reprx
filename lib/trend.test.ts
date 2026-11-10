import { describe, expect, it } from "vitest";
import { formatRate, linearTrend } from "./trend";

describe("linearTrend", () => {
  it("needs 3 sessions", () => {
    expect(
      linearTrend(
        [
          { date: "2026-01-01", value: 50 },
          { date: "2026-02-01", value: 55 },
        ],
        "2026-03-01",
      ),
    ).toBeNull();
  });

  it("recovers an exact line", () => {
    // +1 kg per week, starting at 50 kg.
    const trend = linearTrend(
      [
        { date: "2026-01-01", value: 50 },
        { date: "2026-01-08", value: 51 },
        { date: "2026-01-15", value: 52 },
      ],
      "2026-01-22",
    )!;
    expect(trend.slopePerWeek).toBeCloseTo(1, 10);
    expect(trend.estimateToday).toBeCloseTo(53, 10);
    expect(trend.slopePerMonth).toBeCloseTo((365.25 / 12) / 7, 10);
  });

  it("fits the least-squares line through scattered results", () => {
    // y = 40, 44, 42, 48 at days 0, 10, 20, 30: slope 110/500 = 0.22/day, intercept 40.2.
    const trend = linearTrend(
      [
        { date: "2026-01-01", value: 40 },
        { date: "2026-01-11", value: 44 },
        { date: "2026-01-21", value: 42 },
        { date: "2026-01-31", value: 48 },
      ],
      "2026-01-01",
    )!;
    expect(trend.slopePerDay).toBeCloseTo(0.22, 10);
    expect(trend.estimateToday).toBeCloseTo(40.2, 10);
  });

  it("has no trend when every session is on the same day", () => {
    const sameDay = [50, 52, 54].map((value) => ({ date: "2026-01-01", value }));
    expect(linearTrend(sameDay, "2026-01-01")).toBeNull();
  });
});

describe("formatRate", () => {
  it("shows the sign", () => {
    expect(formatRate(1.234, "week")).toBe("+1.23 kg/week");
    expect(formatRate(-0.5, "month")).toBe("-0.5 kg/month");
    expect(formatRate(0, "week")).toBe("0 kg/week");
  });
});
