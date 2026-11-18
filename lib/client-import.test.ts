import { describe, expect, it } from "vitest";
import { parseCsv, planImport } from "./client-import";

describe("parseCsv", () => {
  it("handles quotes, embedded commas and line breaks, CRLF and a BOM", () => {
    const text = '﻿First name,Last name\r\n"Mary, Jo","O""Brien"\r\n"Multi\nline",Smith\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["First name", "Last name"],
      ["Mary, Jo", 'O"Brien'],
      ["Multi\nline", "Smith"],
    ]);
  });

  it("keeps a last row with no newline", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

const classes = [
  { id: 1, name: "Wed 6am Toowong" },
  { id: 2, name: "Thu PM Strength" },
];
const existing = [
  { id: 10, first_name: "Ann", last_name: "Lee" },
  { id: 11, first_name: "Sam", last_name: "Twin" },
  { id: 12, first_name: "sam", last_name: "twin" },
];

describe("planImport", () => {
  it("creates new clients, matches existing ones and ignores other columns", () => {
    const plan = planImport(
      parseCsv(
        [
          "Surname,Given name,DOB,Class",
          "Brown,Joe,1960-01-01,wed 6am toowong",
          "Brown,Joe,1960-01-01,Thu PM Strength",
          "Lee,Ann,,Thu PM Strength",
          "Day,Kim,,",
        ].join("\n"),
      ),
      existing,
      classes,
    );
    expect(plan.error).toBeUndefined();
    expect(plan.ignoredColumns).toEqual(["DOB"]);
    expect(plan.newClients).toEqual([
      { first_name: "Joe", last_name: "Brown", preferred_name: null, class_ids: [1, 2] },
      { first_name: "Kim", last_name: "Day", preferred_name: null, class_ids: [] },
    ]);
    expect(plan.existing).toEqual([{ client_id: 10, class_ids: [2] }]);
    expect(plan.rows.map((row) => row.status)).toEqual(["new", "new", "existing", "new"]);
  });

  it("skips classes an existing client is already in", () => {
    const plan = planImport(
      parseCsv("First name,Last name,Class\nAnn,Lee,Wed 6am Toowong; Thu PM Strength"),
      [{ id: 10, first_name: "Ann", last_name: "Lee", class_ids: [1] }],
      classes,
    );
    expect(plan.existing).toEqual([{ client_id: 10, class_ids: [2] }]);
    expect(plan.rows[0].message).toBe("Already a client: will be added to Thu PM Strength.");
  });

  it("flags missing names, unknown classes and ambiguous matches", () => {
    const plan = planImport(
      parseCsv(
        [
          "First name,Last name,Class",
          ",Nobody,",
          "Al,Bee,Pilates",
          "Sam,Twin,",
          "Cy,Dee,Wed 6am Toowong; Thu PM Strength",
        ].join("\n"),
      ),
      existing,
      classes,
    );
    expect(plan.rows.map((row) => row.status)).toEqual(["error", "error", "error", "new"]);
    expect(plan.rows[1].message).toBe('No class named "Pilates".');
    expect(plan.newClients).toEqual([
      { first_name: "Cy", last_name: "Dee", preferred_name: null, class_ids: [1, 2] },
    ]);
  });

  it("needs name columns", () => {
    expect(planImport(parseCsv("Name,Class\nJoe,"), [], classes).error).toMatch(/First name/);
  });
});
