import { describe, expect, it } from "vitest";
import { changedFields } from "./audit";

describe("changedFields", () => {
  it("lists the fields that differ", () => {
    expect(changedFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });

  it("ignores updated_at", () => {
    expect(changedFields({ updated_at: "x" }, { updated_at: "y" })).toEqual([]);
  });

  it("returns nothing for an insert or delete", () => {
    expect(changedFields(null, { a: 1 })).toEqual([]);
    expect(changedFields({ a: 1 }, null)).toEqual([]);
  });
});
