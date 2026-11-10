import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { abbreviateNames, byName, clientName } from "@/lib/clients";
import { DAY_NAMES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  adjacentWeekday,
  dayOfWeek,
  formatDate,
  formatDateTime,
  formatTime,
  todayIso,
} from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { PrintButton } from "./print-button";
import { type GridCell, SessionGrid } from "./session-grid";

const navLink =
  "rounded-lg border border-gray-300 px-3 py-2 text-xl font-medium text-gray-700 hover:bg-gray-50";

export default async function SessionViewPage({
  params,
  searchParams,
}: PageProps<"/admin/sessions/[classId]">) {
  const staff = await requireStaff();
  const id = idSchema.safeParse((await params).classId);
  if (!id.success) notFound();
  const classId = id.data;

  const today = todayIso();
  const requested = z.iso.date().safeParse((await searchParams).date);
  const date = requested.success ? requested.data : today;
  // Today and later are calculated live; earlier dates show the frozen record.
  const mode = date < today ? "record" : "live";

  const supabase = await createClient();
  const { data: classRow } = await supabase
    .from("classes")
    .select("name, day_of_week, start_time, class_categories(label, colour)")
    .eq("id", classId)
    .maybeSingle();
  if (!classRow) notFound();

  let cells: GridCell[] = [];

  if (mode === "live") {
    // Opening (or printing) today's session takes or refreshes its snapshot.
    if (date === today) await supabase.rpc("snapshot_today", { p_class_id: classId });

    const { data, error } = await supabase.rpc("effective_weights_at", {
      p_class_id: classId,
      p_date: date,
    });
    if (error) throw new Error("Could not load weights.");
    cells = data.map((row) => ({
      clientId: row.client_id,
      itemKey: row.item_key,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      position: row.order_index,
      supersetGroup: row.superset_group,
      sets: row.sets,
      reps: row.reps,
      rmPercentage: row.rm_percentage,
      calculatedKg: row.calculated_kg,
      overrideKg: row.override_kg,
      effectiveKg: row.effective_kg,
      weightSource: row.weight_source,
      overrideNote: row.override_note,
      overrideReviewDate: row.override_review_date,
    }));
  }

  const { data: occurrence } = await supabase
    .from("session_occurrences")
    .select(
      "status, snapshot_at, locked_at, session_snapshot_rows(id, client_id, item_key, exercise_id, exercise_name, position, superset_group, sets, reps, rm_percentage, calculated_kg, effective_kg, weight_source, override_note, edited_at)",
    )
    .eq("class_id", classId)
    .eq("session_date", date)
    .maybeSingle();

  if (mode === "record" && occurrence) {
    cells = occurrence.session_snapshot_rows.map((row) => ({
      clientId: row.client_id,
      itemKey: row.item_key,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      position: row.position,
      supersetGroup: row.superset_group,
      sets: row.sets,
      reps: row.reps,
      rmPercentage: row.rm_percentage,
      calculatedKg: row.calculated_kg,
      overrideKg: row.weight_source === "override" ? row.effective_kg : null,
      effectiveKg: row.effective_kg,
      weightSource: row.weight_source,
      overrideNote: row.override_note,
      overrideReviewDate: null,
      snapshotRowId: row.id,
      editedAt: row.edited_at,
    }));
  }

  const clientIds = [...new Set(cells.map((cell) => cell.clientId))];
  const { data: clientRows } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id, first_name, last_name, preferred_name")
        .in("id", clientIds)
    : { data: [] };
  const people = [...(clientRows ?? [])].sort(byName);
  const shortNames = abbreviateNames(people);
  const clients = people.map((person) => ({
    id: person.id,
    fullName: clientName(person),
    shortName: shortNames.get(person.id)!,
  }));

  const locked = occurrence?.status === "locked";
  const runsOnDate = dayOfWeek(date) === classRow.day_of_week;
  const previous = adjacentWeekday(date, classRow.day_of_week, -1);
  const next = adjacentWeekday(date, classRow.day_of_week, 1);

  let status: string;
  if (mode === "record") {
    status = !occurrence
      ? "No record was kept for this date."
      : locked
        ? `Locked record of this session${
            occurrence.locked_at ? `, locked ${formatDateTime(occurrence.locked_at)}` : ""
          }.`
        : "Record of this session. It locks at the end of the day.";
  } else if (date === today) {
    status = occurrence?.snapshot_at
      ? `Live. Saved for the record at ${formatDateTime(occurrence.snapshot_at)}; it updates until the end of today.`
      : "Live calculation.";
  } else {
    status = "Planned: a live calculation. Weights may change before the day.";
  }
  if (!runsOnDate) status += ` This class runs on ${DAY_NAMES[classRow.day_of_week]}s.`;

  return (
    <div className="text-xl print:text-[10pt]">
      <div className="mb-6 print:hidden">
        <Link href={`/admin/classes/${classId}`} className="text-xl text-indigo-600 hover:text-indigo-800">
          &larr; {classRow.name}
        </Link>
      </div>

      <div className="mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center print:mb-2">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 print:text-[14pt]">{classRow.name}</h1>
            <span className="print:hidden">
              <CategoryBadge label={classRow.class_categories.label}
                colour={classRow.class_categories.colour} />
            </span>
          </div>
          <p className="text-gray-600">
            {DAY_NAMES[dayOfWeek(date)]} {formatDate(date)} · {formatTime(classRow.start_time)} ·{" "}
            {clients.length} clients
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link href={`?date=${previous}`} className={navLink}>
            &larr; {formatDate(previous)}
          </Link>
          {date !== today && (
            <Link href="?" className={navLink}>
              Today
            </Link>
          )}
          <Link href={`?date=${next}`} className={navLink}>
            {formatDate(next)} &rarr;
          </Link>
          <form className="flex items-center gap-2">
            <label className="sr-only" htmlFor="session-date">
              Session date
            </label>
            <input id="session-date" type="date" name="date" defaultValue={date}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xl" />
            <button type="submit" className={navLink}>
              Go
            </button>
          </form>
          <PrintButton />
        </div>
      </div>

      <p
        role="status"
        data-testid="session-status"
        className="mb-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 print:mb-1 print:bg-transparent print:p-0 print:text-[8pt]"
      >
        {status}
      </p>

      {cells.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            {mode === "record"
              ? "Nothing to show for this date."
              : "No program or members for this date."}
          </p>
          {mode === "live" && (
            <Link href={`/admin/classes/${classId}`}
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white">
              Class details
            </Link>
          )}
        </div>
      ) : (
        <SessionGrid
          classId={classId}
          clients={clients}
          cells={cells}
          today={today}
          mode={mode}
          canCorrect={staff.isAdmin && locked}
        />
      )}

      <p className="mt-4 text-gray-600 print:hidden">
        {mode === "live"
          ? "Select a weight to adjust it for that client. Amber weights are EP overrides; a note describes the exercise change and follows the client to every class with that exercise."
          : staff.isAdmin && locked
            ? "Past sessions are never recalculated. Select a weight to correct a recording error; corrections are audited."
            : "Past sessions are never recalculated."}
      </p>
    </div>
  );
}
