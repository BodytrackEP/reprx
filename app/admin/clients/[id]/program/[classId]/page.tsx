import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { OverrideButton } from "@/components/override-button";
import { WeightDisplay } from "@/components/weight-display";
import { requireStaff } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { loadClassProgram } from "@/lib/class-program";
import { DAY_NAMES } from "@/lib/constants";
import { formatPrescription } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";

export default async function ClientProgramPage({
  params,
}: PageProps<"/admin/clients/[id]/program/[classId]">) {
  await requireStaff();
  const raw = await params;
  const clientParam = idSchema.safeParse(raw.id);
  const classParam = idSchema.safeParse(raw.classId);
  if (!clientParam.success || !classParam.success) notFound();
  const clientId = clientParam.data;
  const classId = classParam.data;

  const supabase = await createClient();
  const [{ data: client }, { data: classRow }, { data: weights, error }, program] =
    await Promise.all([
      supabase
        .from("clients")
        .select("first_name, last_name, preferred_name")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("name, day_of_week, start_time, class_categories(label, colour)")
        .eq("id", classId)
        .maybeSingle(),
      supabase.rpc("effective_weights_for_client", { p_client_id: clientId }),
      loadClassProgram(supabase, classId),
    ]);
  if (!client || !classRow) notFound();
  if (error) throw new Error("Could not load the program.");

  const details = new Map(program.items.map((item) => [item.id, item]));
  const rows = weights.filter((weight) => weight.class_id === classId);
  const today = todayIso();
  const name = clientName(client);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; {name}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{name}&apos;s Program</h1>
        <div className="mt-1 flex items-center gap-3">
          <CategoryBadge
            label={classRow.class_categories.label}
            colour={classRow.class_categories.colour}
          />
          <span className="text-gray-500">
            {classRow.name} · {DAY_NAMES[classRow.day_of_week]}{" "}
            {formatTime(classRow.start_time)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((row, index) => {
          const detail = details.get(row.item_id);
          const exerciseName = detail?.exercises.name ?? "Exercise";
          const hasOverride = row.override_kg !== null;

          return (
            <div
              key={row.item_id}
              className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${
                hasOverride ? "border-l-4 border-l-amber-400" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                    <h2 className="font-semibold text-gray-900">{exerciseName}</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span>{formatPrescription(row.sets, row.reps, row.rm_percentage)}</span>
                    {detail?.rest_seconds ? <span>{detail.rest_seconds}s rest</span> : null}
                  </div>
                  {detail?.notes && (
                    <p className="mt-1 text-sm text-amber-800">{detail.notes}</p>
                  )}
                  {row.latest_1rm_kg !== null && row.latest_test_date && (
                    <p className="mt-2 text-xs text-gray-500">
                      Latest 1RM: {row.latest_1rm_kg} kg ({formatDate(row.latest_test_date)})
                    </p>
                  )}
                  {hasOverride && row.override_reason && (
                    <p className="mt-2 text-xs text-amber-800">{row.override_reason}</p>
                  )}
                </div>
                <div className="min-w-24 text-right">
                  <WeightDisplay
                    weight={row}
                    today={today}
                    weightClassName="text-2xl font-bold"
                    labelClassName="text-xs"
                  />
                  <div className="mt-2 flex flex-col items-end gap-1">
                    <OverrideButton
                      label={hasOverride ? "Change override" : "Set override"}
                      ariaLabel={`${hasOverride ? "Change" : "Set"} override for ${exerciseName}`}
                      buttonClassName="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      target={{
                        clientId,
                        clientName: name,
                        exerciseId: row.exercise_id,
                        exerciseName,
                        overrideKg: row.override_kg,
                        reason: row.override_reason,
                        reviewDate: row.override_review_date,
                        calculatedKg: row.calculated_kg,
                      }}
                    />
                    {row.weight_source === "not_tested" && (
                      <Link
                        href={`/admin/rm-testing?client=${clientId}&exercise=${row.exercise_id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Record RM &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-gray-500">This class has no program, or the client isn&apos;t in it.</p>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-6 text-xs text-gray-500">
          Weights are calculated from the latest RM test. An amber border means an EP
          override, which applies in every class with that exercise.
        </p>
      )}
    </div>
  );
}
