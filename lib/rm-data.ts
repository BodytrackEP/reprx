import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TrendPoint } from "./trend";

type Client = Awaited<ReturnType<typeof createClient>>;

export type RmResult = {
  id: number;
  exercise_id: number;
  reps: number;
  weight_kg: number;
  estimated_1rm_kg: number | null;
  voided_at: string | null;
  voided_reason: string | null;
  exercises: { name: string };
};

export type RmSession = {
  id: number;
  session_no: number;
  test_date: string;
  notes: string | null;
  staff: { display_name: string } | null;
  rm_results: RmResult[];
};

export type ExerciseTrend = { exerciseId: number; exerciseName: string; points: TrendPoint[] };

/** A client's testing sessions (newest first) and, per exercise, one trend point per session. */
export async function loadClientRm(supabase: Client, clientId: number) {
  const { data, error } = await supabase
    .from("rm_testing_sessions")
    .select(
      "id, session_no, test_date, notes, staff(display_name), rm_results(id, exercise_id, reps, weight_kg, estimated_1rm_kg, voided_at, voided_reason, exercises(name))",
    )
    .eq("client_id", clientId)
    .order("test_date", { ascending: false })
    .order("session_no", { ascending: false });
  if (error) throw new Error("Could not load RM testing.");

  const sessions = data as unknown as RmSession[];

  // Voided results are excluded from graphs and calculations.
  const byExercise = new Map<number, ExerciseTrend>();
  for (const session of [...sessions].reverse()) {
    for (const result of session.rm_results) {
      if (result.voided_at || result.estimated_1rm_kg === null) continue;
      const trend = byExercise.get(result.exercise_id) ?? {
        exerciseId: result.exercise_id,
        exerciseName: result.exercises.name,
        points: [],
      };
      trend.points.push({ date: session.test_date, value: result.estimated_1rm_kg });
      byExercise.set(result.exercise_id, trend);
    }
  }

  const trends = [...byExercise.values()].sort(
    (a, b) => b.points.length - a.points.length || a.exerciseName.localeCompare(b.exerciseName),
  );

  return { sessions, trends };
}
