import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { ClientChips } from "@/components/client-chips";
import { ConfirmButton } from "@/components/confirm-button";
import { requireStaff } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { DAY_NAMES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
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

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  const staff = await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const clientId = id.data;

  const supabase = await createClient();
  const [{ data: client }, { data: classes }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "*, class_members(classes(id, name, day_of_week, start_time, class_categories(label, colour), programs(id)))",
      )
      .eq("id", clientId)
      .maybeSingle(),
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (!client) notFound();

  const memberships = client.class_members.map((member) => member.classes);
  const name = clientName(client);

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
                {item.programs ? (
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
      </div>
    </div>
  );
}
