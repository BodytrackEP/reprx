type Grouped = { supersetGroup?: number | null };

/**
 * Keeps groups valid after a reorder, removal or regroup, mirroring the database's rules:
 * a group needs 2+ adjacent rows, a lone row is ungrouped, and a group split by another
 * row becomes separate groups. Groups are renumbered 1, 2, 3… in display order.
 */
export function normaliseGroups<T extends Grouped>(rows: T[]): T[] {
  const runs: { group: number; start: number; end: number }[] = [];

  rows.forEach((row, index) => {
    const group = row.supersetGroup ?? null;
    const last = runs.at(-1);
    if (group === null) return;
    if (last && last.group === group && last.end === index - 1) last.end = index;
    else runs.push({ group, start: index, end: index });
  });

  const next = rows.map((row) => ({ ...row, supersetGroup: undefined as number | undefined }));
  let number = 0;
  for (const run of runs) {
    if (run.end === run.start) continue;
    number += 1;
    for (let index = run.start; index <= run.end; index++) next[index].supersetGroup = number;
  }
  return next;
}

/** True when the indexes are 2+ consecutive positions. */
export function isGroupable(indexes: number[]) {
  if (indexes.length < 2) return false;
  const sorted = [...indexes].sort((a, b) => a - b);
  return sorted.every((value, i) => i === 0 || value === sorted[i - 1] + 1);
}

// Light enough for black text, distinct in print, and never amber (reserved for overrides).
const PALETTE = [
  { band: "border-l-sky-500", fill: "bg-sky-50" },
  { band: "border-l-emerald-500", fill: "bg-emerald-50" },
  { band: "border-l-violet-500", fill: "bg-violet-50" },
  { band: "border-l-rose-500", fill: "bg-rose-50" },
  { band: "border-l-teal-500", fill: "bg-teal-50" },
  { band: "border-l-fuchsia-500", fill: "bg-fuchsia-50" },
];

export type SupersetStyle = (typeof PALETTE)[number];

/** A colour per group, assigned in the order groups first appear. */
export function supersetStyles(groups: (number | null | undefined)[]) {
  const styles = new Map<number, SupersetStyle>();
  for (const group of groups) {
    if (group == null || styles.has(group)) continue;
    styles.set(group, PALETTE[styles.size % PALETTE.length]);
  }
  return styles;
}
