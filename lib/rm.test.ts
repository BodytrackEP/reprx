import { describe, expect, it } from "vitest";
import { summariseRmTests } from "./rm";

const test_ = (
  overrides: Partial<Parameters<typeof summariseRmTests>[0][number]>,
) => ({
  exercise_id: 1,
  exercise_name: "Press",
  test_date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
  estimated_1rm_kg: 50,
  voided_at: null,
  ...overrides,
});

describe("summariseRmTests", () => {
  it("reports the latest test and the change from the one before", () => {
    const [row] = summariseRmTests([
      test_({ test_date: "2026-01-01", estimated_1rm_kg: 50 }),
      test_({ test_date: "2026-03-01", estimated_1rm_kg: 57.5 }),
    ]);
    expect(row.latest1Rm).toBe(57.5);
    expect(row.change).toBe(7.5);
    expect(row.tests).toBe(2);
  });

  it("breaks same-day ties by creation time, like the database", () => {
    const [row] = summariseRmTests([
      test_({ created_at: "2026-01-01T09:00:00Z", estimated_1rm_kg: 40 }),
      test_({ created_at: "2026-01-01T10:00:00Z", estimated_1rm_kg: 45 }),
    ]);
    expect(row.latest1Rm).toBe(45);
  });

  it("ignores voided tests", () => {
    const [row] = summariseRmTests([
      test_({ test_date: "2026-01-01", estimated_1rm_kg: 50 }),
      test_({ test_date: "2026-03-01", estimated_1rm_kg: 200, voided_at: "2026-03-02" }),
    ]);
    expect(row.latest1Rm).toBe(50);
    expect(row.change).toBeNull();
    expect(row.tests).toBe(1);
  });

  it("drops an exercise whose only test was voided", () => {
    expect(summariseRmTests([test_({ voided_at: "2026-03-02" })])).toEqual([]);
  });
});
