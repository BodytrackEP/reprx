import { describe, expect, it } from "vitest";
import { calculateWeight, estimate1Rm, roundToIncrement } from "./calc";

describe("estimate1Rm", () => {
  it("gives 33.00 kg for a 3RM at 30 kg", () => {
    expect(estimate1Rm(30, 3)).toBe(33);
  });

  it("returns the weight itself for a true 1RM", () => {
    expect(estimate1Rm(50, 1)).toBe(50);
  });

  it("rounds to two decimal places", () => {
    expect(estimate1Rm(42.5, 7)).toBe(52.42);
  });
});

describe("roundToIncrement", () => {
  it("rounds down below the half-way point", () => {
    expect(roundToIncrement(40.25, 2.5)).toBe(40);
  });

  it("rounds half away from zero", () => {
    expect(roundToIncrement(41.25, 2.5)).toBe(42.5);
  });

  it("leaves an exact multiple alone", () => {
    expect(roundToIncrement(40, 2.5)).toBe(40);
  });
});

describe("calculateWeight", () => {
  it("gives 40.0 kg at 70% of a 57.5 kg 1RM", () => {
    expect(calculateWeight(57.5, 0.7, 2.5)).toBe(40);
  });

  it("is exact where binary floats are not", () => {
    // 82.5 * 0.65 = 53.625 -> 21.45 steps; 55 * 0.75 = 41.25 -> exactly half.
    expect(calculateWeight(82.5, 0.65, 2.5)).toBe(52.5);
    expect(calculateWeight(55, 0.75, 2.5)).toBe(42.5);
  });
});
