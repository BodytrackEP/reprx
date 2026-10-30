import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { DAY_NAMES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { EditClassButton } from "../class-form";

const buttonClass =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

export default async function ClassDetailPage({ params }: PageProps<"/admin/classes/[id]">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const classId = id.data;

  const supabase = await createClient();
  const [{ data: classRow }, { data: program }, { data: categories, error }] = await Promise.all([
    supabase
      .from("classes")
      .select("*, class_categories(label, colour)")
      .eq("id", classId)
      .maybeSingle(),
    supabase
      .from("programs")
      .select(
        "name, program_exercises(id, order_index, sets, reps, rm_percentage, rest_seconds, notes, exercises(name))",
      )
      .eq("class_id", classId)
      .order("order_index", { referencedTable: "program_exercises" })
      .maybeSingle(),
    supabase.from("class_categories").select("code, label").order("sort_order"),
  ]);

  if (!classRow) notFound();
  if (error) throw new Error("Could not load categories.");

  const rows = program?.program_exercises ?? [];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/classes" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; All Classes
        </Link>
      </div>

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{classRow.name}</h1>
            <CategoryBadge
              label={classRow.class_categories.label}
              colour={classRow.class_categories.colour}
            />
            {!classRow.is_active && (
              <span className="text-sm text-gray-500">Inactive</span>
            )}
          </div>
          <p className="text-gray-500">
            {DAY_NAMES[classRow.day_of_week]} {formatTime(classRow.start_time)} –{" "}
            {formatTime(classRow.end_time)}
            {classRow.location && ` · ${classRow.location}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/sessions/${classId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Open Session View
          </Link>
          <Link href={`/admin/classes/${classId}/program`} className={buttonClass}>
            {program ? "Edit Program" : "Build Program"}
          </Link>
          <EditClassButton categories={categories} current={classRow} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Members: milestone 5 */}
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Program Template</h2>
          {program ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-medium text-gray-900">{program.name}</h3>
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`flex items-start gap-3 ${
                      index > 0 ? "border-t border-gray-100 pt-3" : ""
                    }`}
                  >
                    <span className="mt-0.5 w-5 text-xs font-medium text-gray-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{row.exercises.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {row.sets} x {row.reps}
                        {row.rm_percentage !== null &&
                          ` @ ${Number((row.rm_percentage * 100).toFixed(1))}% 1RM`}
                        {row.rest_seconds ? ` · ${row.rest_seconds}s rest` : ""}
                      </p>
                      {row.notes && (
                        <p className="mt-0.5 text-xs text-amber-700">{row.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href={`/admin/classes/${classId}/program`}
                className="mt-4 block text-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Edit Program &rarr;
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="mb-4 text-gray-500">No program template yet</p>
              <Link
                href={`/admin/classes/${classId}/program`}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Build Program
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
