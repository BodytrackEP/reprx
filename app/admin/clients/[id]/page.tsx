import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { ClientChips } from "@/components/client-chips";
import { ConfirmButton } from "@/components/confirm-button";
import { OverrideButton } from "@/components/override-button";
import { ProgramHistory } from "@/components/program-history";
import { RmHistory } from "@/components/rm-history";
import { isReviewDue } from "@/components/weight-display";
import { requireStaff } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { DAY_NAMES } from "@/lib/constants";
import { isCurrent } from "@/lib/programs";
import { summariseRmTests } from "@/lib/rm";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import {
  deactivateClient,
  reactivateClient,
  restoreClient,
  softDeleteClient,
} from "../actions";
import { EditClientButton } from "../client-form";
import { ClassAssignButton } from "./class-assign";

const quietButton = "text-sm text-gray-500 hover:text-gray-800";

export default async function ClientDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/clients/[id]">) {
  const staff = await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const clientId = id.data;
  const tab = (await searchParams).tab === "overrides" ? "overrides" : "rm";

  const supabase = await createClient();
  const [
    { data: client },
    { data: classes },
    { data: testRows },
    { data: overrideRows },
    { data: history },
    { data: liveOverrides },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "*, class_members(classes(id, name, day_of_week, start_time, class_categories(label, colour), class_program_assignments(start_date, end_date)))",
      )
      .eq("id", clientId)
      .maybeSingle(),
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("rm_tests")
      .select(
        "id, exercise_id, test_date, created_at, reps, weight_kg, estimated_1rm_kg, notes, voided_at, voided_reason, exercises(name)",
      )
      .eq("client_id", clientId)
      .order("test_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("weight_overrides")
      .select(
        "id, exercise_id, override_weight_kg, note, review_date, set_at, ended_at, exercises(name)",
      )
      .eq("client_id", clientId)
      .order("set_at", { ascending: false }),
    supabase.rpc("client_program_history", { p_client_id: clientId }),
    supabase
      .from("client_overrides_v")
      .select("*")
      .eq("client_id", clientId)
      .order("exercise_name"),
  ]);
  if (!client) notFound();

  const memberships = client.class_members.map((member) => member.classes);
  const name = clientName(client);
  const today = todayIso();
  const tests = testRows ?? [];
  const overrides = overrideRows ?? [];
  // Dormant overrides are kept but not shown in sessions: the exercise isn't in any of the
  // client's current programs. They apply again automatically if it returns.
  const activeOverrides = (liveOverrides ?? []).filter((override) => !override.is_dormant);
  const dormantOverrides = (liveOverrides ?? []).filter((override) => override.is_dormant);
  const summary = summariseRmTests(
    tests.map((test) => ({ ...test, exercise_name: test.exercises.name })),
  );

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/clients" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; All Clients
        </Link>
      </div>

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-gray-900">{name}</h1>
          <ClientChips client={client} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/rm-testing?client=${clientId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Record RM Test
          </Link>
          <EditClientButton client={client} />
          {client.is_active ? (
            <ConfirmButton
              action={deactivateClient}
              id={clientId}
              message={`Mark ${name} as inactive?`}
              className={quietButton}
            >
              Deactivate
            </ConfirmButton>
          ) : (
            <ConfirmButton
              action={reactivateClient}
              id={clientId}
              message={`Reactivate ${name}?`}
              className={quietButton}
            >
              Reactivate
            </ConfirmButton>
          )}
          {client.deleted_at ? (
            <ConfirmButton
              action={restoreClient}
              id={clientId}
              message={`Restore ${name}?`}
              className={quietButton}
            >
              Restore
            </ConfirmButton>
          ) : (
            <ConfirmButton
              action={softDeleteClient}
              id={clientId}
              message={`Delete ${name}? They leave the session view, and can be restored.`}
              className={quietButton}
            >
              Delete
            </ConfirmButton>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Classes ({memberships.length})
            </h2>
            <ClassAssignButton
              clientId={clientId}
              classes={classes ?? []}
              memberOf={memberships.map((item) => item.id)}
              isAdmin={staff.isAdmin}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <CategoryBadge
                    label={item.class_categories.label}
                    colour={item.class_categories.colour}
                  />
                  <span className="text-xs text-gray-500">
                    {DAY_NAMES[item.day_of_week].slice(0, 3)} {formatTime(item.start_time)}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-900">
                  <Link href={`/admin/classes/${item.id}`} className="hover:text-indigo-700">
                    {item.name}
                  </Link>
                </h3>
                {item.class_program_assignments.some((assignment) => isCurrent(assignment, today)) ? (
                  <Link
                    href={`/admin/clients/${clientId}/program/${item.id}`}
                    className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    View Personalised Program &rarr;
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">No program set</p>
                )}
              </div>
            ))}
            {memberships.length === 0 && (
              <p className="text-sm text-gray-500">Not in any classes yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Active Overrides ({activeOverrides.length})
          </h2>
          {activeOverrides.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeOverrides.map((override) => (
                <div
                  key={override.id}
                  className="rounded-xl border border-gray-200 border-l-4 border-l-amber-400 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {override.exercise_name}
                    </h3>
                    <span className="font-semibold text-amber-800">
                      {override.override_weight_kg} kg
                    </span>
                  </div>
                  {override.note && (
                    <p className="mt-1 text-sm text-gray-600">{override.note}</p>
                  )}
                  {override.review_date && (
                    <p
                      className={`mt-1 text-xs ${
                        isReviewDue(override.review_date, today)
                          ? "font-semibold text-red-700"
                          : "text-gray-500"
                      }`}
                    >
                      {isReviewDue(override.review_date, today) ? "Review due: " : "Review: "}
                      {formatDate(override.review_date)}
                    </p>
                  )}
                  <div className="mt-2">
                    <OverrideButton
                      label="Change override"
                      ariaLabel={`Change override for ${override.exercise_name}`}
                      target={{
                        clientId,
                        clientName: name,
                        exerciseId: override.exercise_id!,
                        exerciseName: override.exercise_name!,
                        overrideKg: override.override_weight_kg,
                        note: override.note,
                        reviewDate: override.review_date,
                        calculatedKg: null,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active overrides.</p>
          )}
          {dormantOverrides.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Dormant ({dormantOverrides.length})
              </h3>
              <p className="mb-2 text-xs text-gray-500">
                Kept but not shown in sessions, because the exercise isn&apos;t in any of this
                client&apos;s current programs. It applies again if the exercise returns.
              </p>
              <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                {dormantOverrides.map((override) => (
                  <li key={override.id} data-testid="dormant-override"
                    className="flex justify-between gap-4 px-4 py-2 text-sm">
                    <span className="text-gray-900">{override.exercise_name}</span>
                    <span className="text-gray-500">
                      {override.override_weight_kg} kg{override.note && ` · ${override.note}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Program History</h2>
          <ProgramHistory rows={history ?? []} />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">RM Summary</h2>
            <Link
              href={`/admin/rm-testing?client=${clientId}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Record New Test &rarr;
            </Link>
          </div>
          {summary.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Exercise</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Latest 1RM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Test date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summary.map((row) => (
                    <tr key={row.exerciseId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.exerciseName}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">{row.latest1Rm} kg</td>
                      <td className="px-6 py-3 text-sm">
                        {row.change === null ? (
                          <span className="text-gray-500">First test</span>
                        ) : row.change > 0 ? (
                          <span className="font-medium text-emerald-700">+{row.change} kg</span>
                        ) : row.change < 0 ? (
                          <span className="font-medium text-red-700">{row.change} kg</span>
                        ) : (
                          <span className="text-gray-500">No change</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{formatDate(row.latestDate)}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{row.tests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No RM tests recorded yet.</p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">History</h2>
          <nav aria-label="History" className="mb-4 flex gap-2">
            {[
              { key: "rm", label: "RM tests" },
              { key: "overrides", label: "Overrides" },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/admin/clients/${clientId}?tab=${key}`}
                scroll={false}
                aria-current={tab === key ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  tab === key
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {tab === "rm" ? (
            <RmHistory tests={tests} />
          ) : overrides.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Exercise</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Weight</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Note</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Set</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {overrides.map((override) => (
                    <tr key={override.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{override.exercises.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{override.override_weight_kg} kg</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{override.note ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(override.set_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {override.ended_at ? formatDate(override.ended_at) : "Active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No override history.</p>
          )}
        </section>
      </div>
    </div>
  );
}
