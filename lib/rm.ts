type RmTest = {
  exercise_id: number;
  exercise_name: string;
  test_date: string;
  created_at: string;
  estimated_1rm_kg: number | null;
  voided_at: string | null;
};

export type RmSummary = {
  exerciseId: number;
  exerciseName: string;
  latest1Rm: number | null;
  latestDate: string;
  change: number | null;
  tests: number;
};

const newestFirst = (a: RmTest, b: RmTest) =>
  b.test_date.localeCompare(a.test_date) || b.created_at.localeCompare(a.created_at);

/** One row per exercise. Voided tests don't count, matching effective_weights. */
export function summariseRmTests(tests: RmTest[]): RmSummary[] {
  const byExercise = new Map<number, RmTest[]>();

  for (const test of tests) {
    if (test.voided_at) continue;
    byExercise.set(test.exercise_id, [...(byExercise.get(test.exercise_id) ?? []), test]);
  }

  return [...byExercise.values()]
    .map((group) => {
      const [latest, previous] = [...group].sort(newestFirst);
      return {
        exerciseId: latest.exercise_id,
        exerciseName: latest.exercise_name,
        latest1Rm: latest.estimated_1rm_kg,
        latestDate: latest.test_date,
        change:
          previous && latest.estimated_1rm_kg !== null && previous.estimated_1rm_kg !== null
            ? Number((latest.estimated_1rm_kg - previous.estimated_1rm_kg).toFixed(2))
            : null,
        tests: group.length,
      };
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
