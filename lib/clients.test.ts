import { describe, expect, it } from "vitest";
import { abbreviateNames } from "./clients";

const person = (id: number, first_name: string, last_name: string) => ({
  id,
  first_name,
  last_name,
});

describe("abbreviateNames", () => {
  it("uses the first name and surname initial", () => {
    expect(abbreviateNames([person(1, "Sarah", "Mitchell")]).get(1)).toBe("Sarah M.");
  });

  it("takes more of the surname to tell people apart", () => {
    const names = abbreviateNames([
      person(1, "Sarah", "Mitchell"),
      person(2, "Sarah", "Moore"),
      person(3, "Tom", "Moore"),
    ]);
    expect(names.get(1)).toBe("Sarah Mi.");
    expect(names.get(2)).toBe("Sarah Mo.");
    expect(names.get(3)).toBe("Tom M.");
  });

  it("goes as far as needed, and drops the full stop for a full surname", () => {
    const names = abbreviateNames([person(1, "Ann", "Lee"), person(2, "Ann", "Leeds")]);
    expect(names.get(1)).toBe("Ann Lee");
    expect(names.get(2)).toBe("Ann Leed.");
  });

  it("numbers identical names", () => {
    const names = abbreviateNames([person(5, "Jo", "Smith"), person(2, "Jo", "Smith")]);
    expect(names.get(2)).toBe("Jo Smith (1)");
    expect(names.get(5)).toBe("Jo Smith (2)");
  });
});
