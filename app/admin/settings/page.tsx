import { ConfirmButton } from "@/components/confirm-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { purgeTestData } from "./actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireAdmin();
  const { purged } = await searchParams;

  const supabase = await createClient();
  const [{ data: settings, error }, { count }] = await Promise.all([
    supabase.from("app_settings").select("*").single(),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_test", true),
  ]);
  if (error) throw new Error("Could not load settings.");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mb-6 text-gray-500">
        Environment: <span className="font-medium text-gray-700">{settings.environment}</span>
      </p>

      <SettingsForm settings={settings} />

      <section className="mt-8 max-w-xl rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Purge test data</h2>
        <p className="mb-4 text-sm text-gray-600">
          Permanently deletes {count ?? 0} test clients with their memberships, RM tests and
          overrides. Real clients, classes and exercises are not affected. This can&apos;t be
          undone.
        </p>
        {typeof purged === "string" && (
          <p role="status" className="mb-4 text-sm text-green-700">
            Purged {purged} test clients.
          </p>
        )}
        <ConfirmButton
          action={purgeTestData}
          id="purge"
          message={`Permanently delete ${count ?? 0} test clients? This can't be undone.`}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Purge test data
        </ConfirmButton>
      </section>
    </div>
  );
}
