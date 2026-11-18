/**
 * CSV client import. Reads names and an optional class only (§3): every other column, such
 * as a date of birth or phone number in a Cliniko export, is ignored and never stored.
 */

export const MAX_IMPORT_ROWS = 500;

/** RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no client.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

const HEADERS = {
  firstName: ["first name", "firstname", "first_name", "given name", "given names"],
  lastName: ["last name", "lastname", "last_name", "surname", "family name"],
  preferredName: ["preferred name", "preferredname", "preferred_name", "known as"],
  className: ["class", "class name", "class_name", "classes"],
} as const;

type Column = keyof typeof HEADERS;

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export type ExistingClient = {
  id: number;
  first_name: string;
  last_name: string;
  class_ids?: number[];
};
export type ClassOption = { id: number; name: string };

export type PreviewRow = {
  line: number;
  firstName: string;
  lastName: string;
  preferredName: string;
  classNames: string[];
  status: "new" | "existing" | "error";
  message?: string;
};

export type ImportPlan = {
  rows: PreviewRow[];
  newClients: {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    class_ids: number[];
  }[];
  existing: { client_id: number; class_ids: number[] }[];
  ignoredColumns: string[];
  error?: string;
};

/**
 * Turns a parsed CSV into a preview and the import payload. Rows with the same name are one
 * client (so a client can be listed once per class). A name that matches exactly one existing
 * client adds that client to the listed classes; two or more matches can't be told apart.
 */
export function planImport(
  table: string[][],
  existingClients: ExistingClient[],
  classes: ClassOption[],
): ImportPlan {
  const empty: ImportPlan = { rows: [], newClients: [], existing: [], ignoredColumns: [] };
  if (table.length < 2) return { ...empty, error: "The file has no client rows under its header." };

  const header = table[0].map(normalise);
  const index = {} as Record<Column, number>;
  for (const column of Object.keys(HEADERS) as Column[]) {
    index[column] = header.findIndex((name) =>
      (HEADERS[column] as readonly string[]).includes(name),
    );
  }
  if (index.firstName < 0 || index.lastName < 0) {
    return {
      ...empty,
      error: 'The header row needs "First name" and "Last name" columns.',
    };
  }
  const used = new Set(Object.values(index));
  const ignoredColumns = table[0].filter((name, i) => !used.has(i) && name.trim() !== "");

  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { ...empty, ignoredColumns, error: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` };
  }

  const classByName = new Map(classes.map((option) => [normalise(option.name), option]));
  const existingByName = new Map<string, ExistingClient[]>();
  for (const client of existingClients) {
    const key = `${normalise(client.first_name)}|${normalise(client.last_name)}`;
    existingByName.set(key, [...(existingByName.get(key) ?? []), client]);
  }

  const rows: PreviewRow[] = [];
  const groups = new Map<string, { row: PreviewRow; classIds: Set<number> }>();
  const cell = (cells: string[], column: Column) =>
    index[column] >= 0 ? (cells[index[column]] ?? "").trim() : "";

  table.slice(1).forEach((cells, i) => {
    const row: PreviewRow = {
      line: i + 2,
      firstName: cell(cells, "firstName"),
      lastName: cell(cells, "lastName"),
      preferredName: cell(cells, "preferredName"),
      // Several classes can share a cell, separated by semicolons.
      classNames: cell(cells, "className")
        .split(";")
        .map((name) => name.trim())
        .filter(Boolean),
      status: "new",
    };
    rows.push(row);

    if (!row.firstName || !row.lastName) {
      row.status = "error";
      row.message = "First and last name are both needed.";
      return;
    }
    if ([row.firstName, row.lastName, row.preferredName].some((value) => value.length > 100)) {
      row.status = "error";
      row.message = "Names are limited to 100 characters.";
      return;
    }
    const unknown = row.classNames.filter((name) => !classByName.has(normalise(name)));
    if (unknown.length) {
      row.status = "error";
      row.message = `No class named ${unknown.map((name) => `"${name}"`).join(", ")}.`;
      return;
    }

    const key = `${normalise(row.firstName)}|${normalise(row.lastName)}`;
    const matches = existingByName.get(key) ?? [];
    if (matches.length > 1) {
      row.status = "error";
      row.message = "More than one existing client has this name. Add them to classes by hand.";
      return;
    }
    if (matches.length === 1) {
      const current = new Set(matches[0].class_ids ?? []);
      const joins = row.classNames.filter(
        (name) => !current.has(classByName.get(normalise(name))!.id),
      );
      row.status = "existing";
      row.message = joins.length
        ? `Already a client: will be added to ${joins.join(", ")}.`
        : "Already a client: nothing to do.";
    }

    const group = groups.get(key) ?? { row, classIds: new Set<number>() };
    for (const name of row.classNames) group.classIds.add(classByName.get(normalise(name))!.id);
    groups.set(key, group);
  });

  const newClients: ImportPlan["newClients"] = [];
  const existing: ImportPlan["existing"] = [];
  for (const [key, { row, classIds }] of groups) {
    const match = existingByName.get(key)?.[0];
    if (match) {
      const current = new Set(match.class_ids ?? []);
      const joins = [...classIds].filter((id) => !current.has(id));
      if (joins.length) existing.push({ client_id: match.id, class_ids: joins });
    } else {
      newClients.push({
        first_name: row.firstName,
        last_name: row.lastName,
        preferred_name: row.preferredName || null,
        class_ids: [...classIds],
      });
    }
  }

  return { rows, newClients, existing, ignoredColumns };
}
