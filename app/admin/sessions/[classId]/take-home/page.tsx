import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { colourFill } from "@/lib/colours";
import { formatPrescription } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { loadSession } from "../load";
import { PrintButton } from "../print-button";
import type { GridCell } from "../session-grid";

function weightText(cell: GridCell) {
  if (cell.effectiveKg !== null) return `${cell.effectiveKg} kg`;
  return cell.weightSource === "bodyweight" ? "Bodyweight" : "Ask your EP";
}

/**
 * One portrait page per client, to take home: the class program in order, colour coded,
 * with that client's own working weights. Same data as the session view for the date.
 */
export default async function TakeHomePage({
  params,
  searchParams,
}: PageProps<"/admin/sessions/[classId]/take-home">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).classId);
  if (!id.success) notFound();
  const classId = id.data;

  const today = todayIso();
  const requested = z.iso.date().safeParse((await searchParams).date);
  const date = requested.success ? requested.data : today;

  const supabase = await createClient();
  const { data: classRow } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .maybeSingle();
  if (!classRow) notFound();

  const { cells, clients } = await loadSession(supabase, classId, date, today);

  // Coaching notes from the class program (live dates only; records don't keep them).
  const itemIds = [...new Set(cells.flatMap((cell) => (cell.itemId ? [cell.itemId] : [])))];
  const { data: notes } = itemIds.length
    ? await supabase.from("class_program_items").select("id, notes").in("id", itemIds)
    : { data: [] };
  const noteFor = new Map((notes ?? []).map((row) => [row.id, row.notes]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <Link href={`/admin/sessions/${classId}?date=${date}`}
            className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; {classRow.name}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Take-home Sheets</h1>
          <p className="text-gray-500">
            One page per client, with their own weights as at {formatDate(date)}. Print, or
            choose &ldquo;Save as PDF&rdquo; in the print window.
          </p>
        </div>
        <PrintButton />
      </div>

      {clients.length === 0 && (
        <p className="text-gray-500">No clients or program for this date.</p>
      )}

      <div className="space-y-8 print:space-y-0">
        {clients.map((client) => {
          const rows = cells
            .filter((cell) => cell.clientId === client.id)
            .sort((a, b) => a.position - b.position);
          return (
            <section
              key={client.id}
              data-testid="take-home-sheet"
              className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm [page:take-home] print:max-w-none print:break-after-page print:last:break-after-auto print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              <header className="mb-6 border-b border-gray-300 pb-4">
                <h2 className="text-2xl font-bold text-gray-900">{client.fullName}</h2>
                <p className="text-gray-600">
                  {classRow.name} · program as at {formatDate(date)}
                </p>
              </header>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-sm uppercase text-gray-500">
                    <th scope="col" className="py-2 pr-2">Exercise</th>
                    <th scope="col" className="w-32 px-2 py-2">Sets × reps</th>
                    <th scope="col" className="w-40 py-2 pl-2 text-right">Your weight</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((cell) => {
                    const note = cell.itemId ? noteFor.get(cell.itemId) : null;
                    return (
                      <tr key={cell.itemKey} className="break-inside-avoid border-b border-gray-200">
                        <th
                          scope="row"
                          data-colour={cell.colour ?? ""}
                          className={`px-3 py-3 font-semibold text-gray-900 ${colourFill(cell.colour) ?? ""}`}
                        >
                          {cell.exerciseName}
                          {note && (
                            <span className="block text-sm font-normal text-gray-700">{note}</span>
                          )}
                        </th>
                        <td className="px-2 py-3 text-gray-900">
                          {/* Clients see sets and reps; % 1RM is for staff. */}
                          {formatPrescription(cell.sets, cell.reps, null)}
                        </td>
                        <td className="py-3 pl-2 text-right text-lg font-semibold text-gray-900">
                          {weightText(cell)}
                          {cell.overrideNote && (
                            <span className="block text-sm font-normal text-gray-700">
                              {cell.overrideNote}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
