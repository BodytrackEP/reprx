import Link from "next/link";
import { RmHistory } from "@/components/rm-history";
import { requireStaff } from "@/lib/auth";
import { byName, clientName } from "@/lib/clients";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { ClientSelect } from "./client-select";
import { RmTestForm } from "./rm-test-form";

export default async function RmTestingPage({ searchParams }: PageProps<"/admin/rm-testing">) {
  await requireStaff();
  const params = await searchParams;
  const clientId = idSchema.safeParse(params.client).data;
  const exerciseId = idSchema.safeParse(params.exercise).data;

  const supabase = await createClient();
  const [{ data: clients, error }, { data: exercises }, { data: settings }, { data: tests }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, first_name, last_name, preferred_name")
        .is("deleted_at", null)
        .eq("is_active", true),
      supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment")
        .eq("is_active", true)
        .order("name"),
      supabase.from("app_settings").select("rm_warn_above_reps").single(),
      clientId
        ? supabase
            .from("rm_tests")
            .select(
              "id, test_date, reps, weight_kg, estimated_1rm_kg, notes, voided_at, voided_reason, exercises(name)",
            )
            .eq("client_id", clientId)
            .order("test_date", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);
  if (error) throw new Error("Could not load clients.");

  const options = [...clients]
    .sort(byName)
    .map((client) => ({ id: client.id, name: clientName(client) }));
  const selected = options.find((client) => client.id === clientId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">RM Testing</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <ClientSelect clients={options} selected={selected?.id} />
          </div>
          {selected && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <RmTestForm
                key={selected.id}
                clientId={selected.id}
                exercises={exercises ?? []}
                initialExercise={exercises?.find((exercise) => exercise.id === exerciseId)}
                today={todayIso()}
                warnAboveReps={settings?.rm_warn_above_reps ?? 6}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Test History:{" "}
                <Link
                  href={`/admin/clients/${selected.id}`}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  {selected.name}
                </Link>
              </h2>
              <RmHistory tests={tests ?? []} />
            </>
          ) : (
            <p className="text-gray-500">Select a client to record a test.</p>
          )}
        </div>
      </div>
    </div>
  );
}
