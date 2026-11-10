import { describe, expect, it } from "vitest";
import { formatPrescription, isCurrent, toFraction, toPercent } from "./programs";

describe("formatPrescription", () => {
  it("renders text reps with the percentage", () => {
    expect(formatPrescription(3, "10 SL", 0.7)).toBe("3 × 10 SL @70%");
  });

  it("omits the percentage for unloaded exercises", () => {
    expect(formatPrescription(2, "8 each side", null)).toBe("2 × 8 each side");
  });

  it("keeps a decimal percentage", () => {
    expect(formatPrescription(3, "10", 0.675)).toBe("3 × 10 @67.5%");
  });
});

describe("percent conversion", () => {
  it("round-trips without float noise", () => {
    expect(toFraction(70)).toBe(0.7);
    expect(toPercent(0.7)).toBe(70);
    expect(toFraction(67.5)).toBe(0.675);
  });
});

describe("isCurrent", () => {
  const today = "2026-11-10";

  it("includes the start and end days", () => {
    expect(isCurrent({ start_date: today, end_date: today }, today)).toBe(true);
  });

  it("treats a missing end date as open", () => {
    expect(isCurrent({ start_date: "2026-01-01", end_date: null }, today)).toBe(true);
  });

  it("excludes queued and finished assignments", () => {
    expect(isCurrent({ start_date: "2026-11-11", end_date: null }, today)).toBe(false);
    expect(isCurrent({ start_date: "2026-01-01", end_date: "2026-11-09" }, today)).toBe(false);
  });
});
