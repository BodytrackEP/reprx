import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { loadClassProgram } from "@/lib/class-program";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { AddClassExercise, ClassItemList, RemovedRow } from "./class-item-row";

export default async function ClassProgramPage({
  params,
  searchParams,
}: PageProps<"/admin/classes/[id]/program">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const classId = id.data;
  const assignmentId = idSchema.safeParse((await searchParams).assignment).data;

  const supabase = await createClient();
  const [{ data: classRow }, { data: exercises }, program] = await Promise.all([
    supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .eq("is_active", true)
      .order("name"),
    loadClassProgram(supabase, classId, assignmentId),
  ]);
  if (!classRow) notFound();

  const { selected, items } = program;
  const visible = items.filter((item) => !item.is_removed);
  const removed = items.filter((item) => item.is_removed);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link href={`/admin/classes/${classId}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; {classRow.name}
        </Link>
      </div>

      {!selected ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="mb-4 text-gray-500">This class has no program right now.</p>
          <Link href={`/admin/classes/${classId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Assign a program
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Program</h1>
              <p className="mt-1 text-gray-500">
                <Link href={`/admin/programs/${selected.library_programs.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-800">
                  {selected.library_programs.code} {selected.library_programs.name}
                </Link>{" "}
                · library version {selected.library_programs.program_versions?.version_no} ·{" "}
                {formatDate(selected.start_date)} –{" "}
                {selected.end_date ? formatDate(selected.end_date) : "ongoing"}
              </p>
            </div>
            <AddClassExercise classId={classId} assignmentId={selected.id} exercises={exercises ?? []} />
          </div>

          <p className="mb-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
            Changes here apply to this class only, and the row is marked as differing from the
            library. Library updates no longer change that row until you reset it.
          </p>

          <ClassItemList classId={classId} rows={visible} />
          {visible.length === 0 && (
            <p className="text-gray-500">No exercises. Add one, or edit the library program.</p>
          )}

          {removed.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Removed for this class</h2>
              <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                {removed.map((row) => (
                  <RemovedRow key={row.id} classId={classId} id={row.id} name={row.exercises.name} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
