import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import {
  AddExerciseButton,
  ProgramExerciseRow,
  ProgramName,
  type ProgramRow,
} from "./program-builder";

export default async function ProgramBuilderPage({
  params,
}: PageProps<"/admin/classes/[id]/program">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const classId = id.data;

  const supabase = await createClient();

  const [{ data: classRow }, { data: program }, { data: exercises, error }] = await Promise.all([
    supabase
      .from("classes")
      .select("name, class_categories(label, colour)")
      .eq("id", classId)
      .maybeSingle(),
    supabase
      .from("programs")
      .select(
        "id, name, program_exercises(id, exercise_id, order_index, sets, reps, rm_percentage, fallback_weight_kg, rest_seconds, notes, exercises(name, muscle_group, equipment))",
      )
      .eq("class_id", classId)
      .order("order_index", { referencedTable: "program_exercises" })
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (!classRow) notFound();
  if (error) throw new Error("Could not load exercises.");

  const rows: ProgramRow[] = program?.program_exercises ?? [];
  const used = new Set(rows.map((row) => row.exercise_id));
  const available = exercises.filter((exercise) => !used.has(exercise.id));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/admin/classes/${classId}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; {classRow.name}
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Program Builder</h1>
          <div className="mt-1 flex items-center gap-3">
            <CategoryBadge
              label={classRow.class_categories.label}
              colour={classRow.class_categories.colour}
            />
            <span className="text-gray-500">{classRow.name}</span>
          </div>
        </div>
        <AddExerciseButton classId={classId} exercises={available} />
      </div>

      {program && (
        <ProgramName classId={classId} programId={program.id} name={program.name} />
      )}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <ProgramExerciseRow
            key={row.id}
            classId={classId}
            programId={program!.id}
            row={row}
            position={index + 1}
            isFirst={index === 0}
            isLast={index === rows.length - 1}
          />
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="mb-4 text-gray-500">No exercises in this program yet</p>
            <AddExerciseButton
              classId={classId}
              exercises={available}
              label="Add First Exercise"
            />
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            % 1RM calculates each client&apos;s weight. Start kg applies to clients with no
            RM test. Leave both blank for bodyweight exercises.
          </p>
          <Link
            href={`/admin/sessions/${classId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Preview Session View &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
