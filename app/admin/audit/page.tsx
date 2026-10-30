import Link from "next/link";
import { z } from "zod";
import { changedFields } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

const PAGE_SIZE = 50;

const TABLES = [
  "app_settings",
  "class_members",
  "classes",
  "clients",
  "exercises",
  "program_exercises",
  "programs",
  "rm_tests",
  "staff",
  "weight_overrides",
];

const filterClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const params = await searchParams;
  const table = param(params.table);
  const actor = param(params.actor);
  const row = param(params.row).trim();
  const from = param(params.from);
  const to = param(params.to);
  const page = Math.max(Number(param(params.page)) || 1, 1);

  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (TABLES.includes(table)) query = query.eq("table_name", table);
  if (z.uuid().safeParse(actor).success) query = query.eq("actor", actor);
  if (row) query = query.eq("row_pk", row);
  if (z.iso.date().safeParse(from).success) query = query.gte("occurred_at", from);
  if (z.iso.date().safeParse(to).success) {
    query = query.lte("occurred_at", `${to}T23:59:59.999Z`);
  }

  const [{ data, error }, { data: staff }] = await Promise.all([
    query,
    supabase.from("staff").select("id, display_name").order("display_name"),
  ]);
  if (error) throw new Error("Could not load the audit log.");

  const names = new Map(staff?.map((member) => [member.id, member.display_name]));
  const entries = data.slice(0, PAGE_SIZE);
  const hasMore = data.length > PAGE_SIZE;

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ table, actor, row, from, to })) {
      if (value) next.set(key, value);
    }
    next.set("page", String(target));
    return `/admin/audit?${next}`;
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Audit Log</h1>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <select name="table" aria-label="Table" defaultValue={table} className={filterClass}>
          <option value="">All tables</option>
          {TABLES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select name="actor" aria-label="Actor" defaultValue={actor} className={filterClass}>
          <option value="">All staff</option>
          {staff?.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
        <input
          name="row"
          aria-label="Row ID"
          placeholder="Row ID"
          defaultValue={row}
          className={`${filterClass} w-32`}
        />
        <label className="text-sm text-gray-600">
          <span className="mb-1 block">From</span>
          <input type="date" name="from" defaultValue={from} className={filterClass} />
        </label>
        <label className="text-sm text-gray-600">
          <span className="mb-1 block">To</span>
          <input type="date" name="to" defaultValue={to} className={filterClass} />
        </label>
        <button type="submit" className={`${filterClass} font-medium text-gray-700 hover:bg-gray-50`}>
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">When</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Who</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Table</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Row</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => {
              const changed = changedFields(
                entry.old_row as Record<string, unknown> | null,
                entry.new_row as Record<string, unknown> | null,
              );
              return (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(entry.occurred_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {entry.actor_label ??
                      (entry.actor ? (names.get(entry.actor) ?? entry.actor) : "System")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{entry.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{entry.table_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{entry.row_pk}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <details>
                      <summary className="cursor-pointer">
                        {changed.length > 0 ? changed.join(", ") : "View"}
                      </summary>
                      <pre className="mt-2 max-w-xl overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                        {JSON.stringify(
                          { before: entry.old_row, after: entry.new_row },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No matching entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={pageLink(page - 1)} className="text-sm font-medium text-indigo-600">
            &larr; Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={pageLink(page + 1)} className="text-sm font-medium text-indigo-600">
            Older &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
