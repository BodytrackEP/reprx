import Link from "next/link";
import { RmSessions } from "@/components/rm-sessions";
import { RmTrends } from "@/components/rm-trends";
import { requireStaff } from "@/lib/auth";
import { byName, clientName } from "@/lib/clients";
import { loadClientRm } from "@/lib/rm-data";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { ClientSelect } from "./client-select";
import { NewSessionForm, ResultForm } from "./rm-test-form";

export default async function RmTestingPage({ searchParams }: PageProps<"/admin/rm-testing">) {
  await requireStaff();
  const params = await searchParams;
  const clientId = idSchema.safeParse(params.client).data;
  const sessionId = idSchema.safeParse(params.session).data;
  const exerciseId = idSchema.safeParse(params.exercise).data;
  const today = todayIso();

  const supabase = await createClient();
  const [{ data: clients, error }, { data: exercises }, { data: settings }, rm] =
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
      clientId ? loadClientRm(supabase, clientId) : Promise.resolve(null),
    ]);
  if (error) throw new Error("Could not load clients.");

  const options = [...clients]
    .sort(byName)
    .map((client) => ({ id: client.id, name: clientName(client) }));
  const selected = options.find((client) => client.id === clientId);
  const session = rm?.sessions.find((item) => item.id === sessionId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">RM Testing</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <ClientSelect clients={options} selected={selected?.id} />
          </div>

          {selected && session && (
            <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold text-gray-900">
                Session {session.session_no}
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                {formatDate(session.test_date)} ·{" "}
                <Link href={`/admin/rm-testing?client=${selected.id}`}
                  className="text-indigo-600 hover:text-indigo-800">
                  Finish session
                </Link>
              </p>
              <ResultForm
                key={session.id}
                clientId={selected.id}
                sessionId={session.id}
                exercises={exercises ?? []}
                initialExercise={exercises?.find((exercise) => exercise.id === exerciseId)}
                warnAboveReps={settings?.rm_warn_above_reps ?? 6}
              />
            </div>
          )}

          {selected && !session && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">New testing session</h2>
              <NewSessionForm clientId={selected.id} today={today} />
              {rm && rm.sessions.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  To add to an earlier session, open it from the list.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-8 lg:col-span-3">
          {selected && rm ? (
            <>
              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Trends:{" "}
                  <Link href={`/admin/clients/${selected.id}`}
                    className="text-indigo-600 hover:text-indigo-800">
                    {selected.name}
                  </Link>
                </h2>
                <RmTrends trends={rm.trends} today={today} />
              </section>
              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Testing sessions</h2>
                <RmSessions sessions={rm.sessions} clientId={selected.id} selectedId={session?.id}
                  linkSessions />
              </section>
            </>
          ) : (
            <p className="text-gray-500">Select a client to start testing.</p>
          )}
        </div>
      </div>
    </div>
  );
}
