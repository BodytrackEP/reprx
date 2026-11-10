import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { formatPrescription } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";

/** A client's working weights as recorded in session snapshots, for one class and period. */
export default async function ClientSessionsPage({
  params,
  searchParams,
}: PageProps<"/admin/clients/[id]/sessions">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const clientId = id.data;

  const query = await searchParams;
  const classId = idSchema.safeParse(query.class).data;
  const from = z.iso.date().safeParse(query.from).data ?? "2000-01-01";
  const to = z.iso.date().safeParse(query.to).data ?? todayIso();

  const supabase = await createClient();
  const [{ data: client }, { data: classRow }, { data: rows, error }] = await Promise.all([
    supabase.from("clients").select("first_name, last_name, preferred_name").eq("id", clientId).maybeSingle(),
    classId
      ? supabase.from("classes").select("name").eq("id", classId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("session_snapshot_rows")
      .select(
        "id, exercise_name, position, sets, reps, rm_percentage, effective_kg, weight_source, override_note, edited_at, session_occurrences!inner(class_id, session_date, status)",
      )
      .eq("client_id", clientId)
      .gte("session_occurrences.session_date", from)
      .lte("session_occurrences.session_date", to)
      .eq("session_occurrences.class_id", classId ?? -1),
  ]);
  if (!client) notFound();
  if (error) throw new Error("Could not load session records.");

  const sessions = new Map<string, typeof rows>();
  for (const row of rows ?? []) {
    const date = row.session_occurrences.session_date;
    sessions.set(date, [...(sessions.get(date) ?? []), row]);
  }
  const dates = [...sessions.keys()].sort().reverse();
  const name = clientName(client);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href={`/admin/clients/${clientId}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; {name}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Session Records</h1>
      <p className="mb-6 text-gray-500">
        {classRow?.name ?? "Class"} · {formatDate(from)} – {formatDate(to)}. Weights as they were on
        the day.
      </p>

      {dates.length === 0 ? (
        <p className="text-gray-500">No session records in this period.</p>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <section key={date} data-testid="session-record"
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900">
                <Link href={`/admin/sessions/${classId}?date=${date}`} className="hover:text-indigo-700">
                  {formatDate(date)}
                </Link>
              </h2>
              <table className="min-w-full divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-100">
                  {sessions.get(date)!
                    .sort((a, b) => a.position - b.position)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.exercise_name}
                          <span className="block text-xs text-gray-500">
                            {formatPrescription(row.sets, row.reps, row.rm_percentage)}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right text-sm font-semibold ${
                          row.weight_source === "override" ? "text-amber-800" : "text-gray-900"}`}>
                          {row.effective_kg === null ? (
                            <span className="font-normal text-gray-500">
                              {row.weight_source === "bodyweight" ? "Bodyweight" : "Not tested"}
                            </span>
                          ) : (
                            `${row.effective_kg} kg`
                          )}
                          {row.override_note && (
                            <span className="block text-xs font-normal">{row.override_note}</span>
                          )}
                          {row.edited_at && (
                            <span className="block text-xs font-normal text-indigo-800">Corrected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
