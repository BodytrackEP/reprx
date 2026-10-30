type Row = Record<string, unknown> | null;

// updated_at changes on every write, so listing it is only noise.
const IGNORED = new Set(["updated_at"]);

/** Field names that differ between two audited rows. */
export function changedFields(oldRow: Row, newRow: Row): string[] {
  if (!oldRow || !newRow) return [];
  return Object.keys({ ...oldRow, ...newRow }).filter(
    (key) =>
      !IGNORED.has(key) && JSON.stringify(oldRow[key]) !== JSON.stringify(newRow[key]),
  );
}
