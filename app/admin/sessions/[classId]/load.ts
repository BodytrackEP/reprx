import { abbreviateNames, byName, clientName } from "@/lib/clients";
import { createClient } from "@/lib/supabase/server";
import type { GridCell } from "./session-grid";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The cells and clients for one class on one date, shared by the session view and the
 * take-home sheets. Today and later are calculated live; earlier dates read the frozen record.
 */
export async function loadSession(
  supabase: Client,
  classId: number,
  date: string,
  today: string,
) {
  const mode: "live" | "record" = date < today ? "record" : "live";
  let cells: GridCell[] = [];

  if (mode === "live") {
    const { data, error } = await supabase.rpc("effective_weights_at", {
      p_class_id: classId,
      p_date: date,
    });
    if (error) throw new Error("Could not load weights.");
    cells = data.map((row) => ({
      clientId: row.client_id,
      itemKey: row.item_key,
      itemId: row.item_id,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      position: row.order_index,
      supersetGroup: row.superset_group,
      colour: row.colour,
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
      "status, snapshot_at, locked_at, session_snapshot_rows(id, client_id, item_key, exercise_id, exercise_name, position, superset_group, colour, sets, reps, rm_percentage, calculated_kg, effective_kg, weight_source, override_note, edited_at)",
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
      colour: row.colour,
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

  return { mode, cells, occurrence, clients };
}
