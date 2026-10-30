import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { OverrideButton } from "@/components/override-button";
import { WeightDisplay } from "@/components/weight-display";
import { requireStaff } from "@/lib/auth";
import { byName, clientName } from "@/lib/clients";
import { DAY_NAMES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatTime, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { PrintButton } from "./print-button";

export default async function SessionViewPage({
  params,
}: PageProps<"/admin/sessions/[classId]">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).classId);
  if (!id.success) notFound();
  const classId = id.data;

  const supabase = await createClient();
  const [{ data: classRow }, { data: program }, { data: memberRows }, { data: weights, error }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("name, day_of_week, start_time, class_categories(label, colour)")
        .eq("id", classId)
        .maybeSingle(),
      supabase
        .from("programs")
        .select("program_exercises(exercise_id, order_index, sets, reps, rm_percentage, exercises(name))")
        .eq("class_id", classId)
        .order("order_index", { referencedTable: "program_exercises" })
        .maybeSingle(),
      supabase
        .from("class_members")
        .select("clients(id, first_name, last_name, preferred_name, deleted_at)")
        .eq("class_id", classId),
      supabase.rpc("effective_weights", { p_class_id: classId }),
    ]);
  if (!classRow) notFound();
  if (error) throw new Error("Could not load weights.");

  const exercises = program?.program_exercises ?? [];
  const members = (memberRows ?? [])
    .map((row) => row.clients)
    .filter((client) => !client.deleted_at)
    .sort(byName);
  const grid = new Map(
    weights.map((weight) => [`${weight.client_id}:${weight.exercise_id}`, weight]),
  );
  const today = todayIso();

  return (
    <div className="text-xl print:text-[10pt]">
      <div className="mb-6 print:hidden">
        <Link
          href={`/admin/classes/${classId}`}
          className="text-xl text-indigo-600 hover:text-indigo-800"
        >
          &larr; {classRow.name}
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:mb-2">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 print:text-[14pt]">{classRow.name}</h1>
            <span className="print:hidden">
              <CategoryBadge
                label={classRow.class_categories.label}
                colour={classRow.class_categories.colour}
              />
            </span>
          </div>
          <p className="text-gray-600">
            {DAY_NAMES[classRow.day_of_week]} {formatTime(classRow.start_time)} ·{" "}
            {members.length} clients
          </p>
        </div>
        <PrintButton />
      </div>

      {exercises.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No program for this class yet.</p>
          <Link
            href={`/admin/classes/${classId}/program`}
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white"
          >
            Build Program
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:shadow-none">
          <table className="min-w-full divide-y divide-gray-300 print:w-full print:table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-56 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 print:static print:w-[16%] print:min-w-0 print:px-1 print:py-1"
                >
                  Client
                </th>
                {exercises.map((row) => (
                  <th
                    key={row.exercise_id}
                    scope="col"
                    className="min-w-44 px-3 py-3 text-center font-semibold text-gray-700 print:min-w-0 print:break-words print:px-1 print:py-0.5 print:text-[7pt] print:leading-tight"
                  >
                    {row.exercises.name}
                    <span className="block font-normal text-gray-600">
                      {row.sets}×{row.reps}
                      {row.rm_percentage !== null &&
                        ` @${Number((row.rm_percentage * 100).toFixed(1))}%`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((client) => {
                const name = clientName(client);
                return (
                  <tr key={client.id} className="break-inside-avoid">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3 text-left font-medium print:static print:break-words print:px-1 print:py-0.5 print:text-[8pt] print:leading-tight"
                    >
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-indigo-700 hover:text-indigo-900 print:text-gray-900"
                      >
                        {name}
                      </Link>
                    </th>
                    {exercises.map((row) => {
                      const weight = grid.get(`${client.id}:${row.exercise_id}`);
                      if (!weight) return <td key={row.exercise_id} />;
                      const isOverride = weight.weight_source === "override";

                      return (
                        <td
                          key={row.exercise_id}
                          className={`p-0 text-center ${
                            isOverride
                              ? "bg-amber-50 ring-2 ring-inset ring-amber-400 print:bg-transparent"
                              : ""
                          }`}
                        >
                          <OverrideButton
                            ariaLabel={`Override ${row.exercises.name} for ${name}`}
                            buttonClassName="h-full w-full px-3 py-3 hover:ring-2 hover:ring-inset hover:ring-indigo-300 print:px-0 print:py-0.5"
                            label={
                              <span title={weight.override_reason ?? undefined}>
                                <WeightDisplay
                                  weight={weight}
                                  today={today}
                                  weightClassName="text-2xl font-semibold print:text-[9pt] print:leading-tight"
                                  labelClassName="text-xl print:text-[6.5pt] print:leading-tight"
                                />
                              </span>
                            }
                            target={{
                              clientId: client.id,
                              clientName: name,
                              exerciseId: row.exercise_id,
                              exerciseName: row.exercises.name,
                              overrideKg: weight.override_kg,
                              reason: weight.override_reason,
                              reviewDate: weight.override_review_date,
                              calculatedKg: weight.calculated_kg,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-gray-600 print:hidden">
        Select a weight to set an override. Amber means an EP override.
      </p>
    </div>
  );
}
