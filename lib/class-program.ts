import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { isCurrent } from "./programs";
import { todayIso } from "./time";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ClassProgramItem = {
  id: number;
  item_key: string;
  position: number;
  exercise_id: number;
  sets: number;
  reps: string;
  rm_percentage: number | null;
  fallback_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  superset_group: number | null;
  colour: string | null;
  is_customised: boolean;
  is_removed: boolean;
  source_version_id: number | null;
  exercises: { name: string; muscle_group: string | null; equipment: string | null };
};

export type ClassAssignment = {
  id: number;
  start_date: string;
  end_date: string | null;
  library_programs: {
    id: number;
    code: string;
    name: string;
    status: string;
    program_versions: { version_no: number } | null;
  };
};

/**
 * A class's assignments (newest first) and the items of one of them: the given assignment,
 * or else the one current on the practice's today.
 */
export async function loadClassProgram(
  supabase: Client,
  classId: number,
  assignmentId?: number,
) {
  const { data: assignments, error } = await supabase
    .from("class_program_assignments")
    .select(
      "id, start_date, end_date, library_programs(id, code, name, status, program_versions!library_programs_current_version_fkey(version_no))",
    )
    .eq("class_id", classId)
    .order("start_date", { ascending: false });
  if (error) throw new Error("Could not load the class's programs.");

  const today = todayIso();
  const list = assignments as unknown as ClassAssignment[];
  const current = list.find((assignment) => isCurrent(assignment, today)) ?? null;
  const selected = assignmentId
    ? (list.find((assignment) => assignment.id === assignmentId) ?? null)
    : current;

  let items: ClassProgramItem[] = [];
  if (selected) {
    const { data, error: itemError } = await supabase
      .from("class_program_items")
      .select("*, exercises(name, muscle_group, equipment)")
      .eq("assignment_id", selected.id)
      .order("position");
    if (itemError) throw new Error("Could not load the class's program.");
    items = data as unknown as ClassProgramItem[];
  }

  return { assignments: list, current, selected, items, today };
}
