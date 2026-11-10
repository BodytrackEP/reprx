import { describe, expect, it } from "vitest";
import { isGroupable, normaliseGroups, supersetStyles } from "./supersets";

const rows = (groups: (number | undefined)[]) =>
  groups.map((supersetGroup, index) => ({ id: index, supersetGroup }));
const groupsOf = (list: { supersetGroup?: number }[]) => list.map((row) => row.supersetGroup);

describe("normaliseGroups", () => {
  it("renumbers groups in display order", () => {
    expect(groupsOf(normaliseGroups(rows([7, 7, undefined, 3, 3])))).toEqual([
      1, 1, undefined, 2, 2,
    ]);
  });

  it("ungroups a lone row", () => {
    expect(groupsOf(normaliseGroups(rows([1, undefined, 2, 2])))).toEqual([
      undefined, undefined, 1, 1,
    ]);
  });

  it("splits a group broken by another row", () => {
    expect(groupsOf(normaliseGroups(rows([1, 1, undefined, 1, 1])))).toEqual([
      1, 1, undefined, 2, 2,
    ]);
  });

  it("allows groups of any size", () => {
    expect(groupsOf(normaliseGroups(rows([4, 4, 4, 4])))).toEqual([1, 1, 1, 1]);
  });
});

describe("isGroupable", () => {
  it("needs two or more adjacent rows", () => {
    expect(isGroupable([2, 3])).toBe(true);
    expect(isGroupable([4, 2, 3])).toBe(true);
    expect(isGroupable([1, 3])).toBe(false);
    expect(isGroupable([1])).toBe(false);
  });
});

describe("supersetStyles", () => {
  it("gives each group its own colour, in order of appearance", () => {
    const styles = supersetStyles([5, 5, null, 2, 2]);
    expect(styles.size).toBe(2);
    expect(styles.get(5)).not.toEqual(styles.get(2));
  });
});
