import { requireStaff } from "@/lib/auth";
import { MUSCLE_COLOURS, MUSCLE_GROUPS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { reactivateExercise, removeExercise } from "./actions";
import { EditExerciseButton, NewExerciseButton } from "./exercise-form";

const filterClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default async function ExercisesPage({
  searchParams,
}: PageProps<"/admin/exercises">) {
  await requireStaff();
  const { q, muscle, inactive } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  let query = supabase.from("exercises").select("*").order("name");
  if (typeof muscle === "string" && muscle) query = query.eq("muscle_group", muscle);
  if (inactive !== "on") query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error("Could not load exercises.");

  const exercises = data.filter((exercise) =>
    exercise.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
        <NewExerciseButton />
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          aria-label="Search exercises"
          placeholder="Search exercises..."
          defaultValue={search}
          className={`${filterClass} w-64`}
        />
        <select
          name="muscle"
          aria-label="Muscle group"
          defaultValue={typeof muscle === "string" ? muscle : ""}
          className={filterClass}
        >
          <option value="">All muscle groups</option>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="inactive" defaultChecked={inactive === "on"} />
          Show inactive
        </label>
        <button type="submit" className={`${filterClass} font-medium text-gray-700 hover:bg-gray-50`}>
          Filter
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  MUSCLE_COLOURS[exercise.muscle_group ?? ""] ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {exercise.muscle_group ?? "Not set"}
              </span>
              <span className="text-xs text-gray-500">{exercise.equipment}</span>
            </div>
            <h2 className="font-medium text-gray-900">{exercise.name}</h2>
            <div className="mt-3 flex items-center gap-4">
              <EditExerciseButton exercise={exercise} />
              {exercise.is_active ? (
                <form action={removeExercise}>
                  <input type="hidden" name="id" value={exercise.id} />
                  <button type="submit" className="text-sm text-gray-500 hover:text-red-700">
                    Remove
                  </button>
                </form>
              ) : (
                <form action={reactivateExercise}>
                  <input type="hidden" name="id" value={exercise.id} />
                  <span className="mr-3 text-xs text-gray-500">Inactive</span>
                  <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
                    Reactivate
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {exercises.length === 0 && (
          <p className="text-gray-500 sm:col-span-2 lg:col-span-3">
            No exercises match your filters.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Removing an exercise that is in a program or has test history deactivates it instead.
      </p>
    </div>
  );
}
