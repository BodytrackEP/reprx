import Link from "next/link";
import { ClientChips } from "@/components/client-chips";
import { requireStaff } from "@/lib/auth";
import { byName, clientName } from "@/lib/clients";
import { createClient } from "@/lib/supabase/server";
import { NewClientButton } from "./client-form";

const filterClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireStaff();
  const params = await searchParams;
  const search = param(params.q).trim().toLowerCase();
  const classFilter = param(params.class);
  const status = param(params.status) || "active";
  const link = param(params.link);
  const kind = param(params.kind);

  const supabase = await createClient();
  const [{ data: clients, error }, { data: classes }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, preferred_name, is_test, is_active, deleted_at, cliniko_patient_id, cliniko_archived_at, class_members(classes(id, name))",
      ),
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (error) throw new Error("Could not load clients.");

  // A practice has hundreds of clients, not millions, so filtering here stays simple.
  const shown = clients
    .filter((client) => {
      if (status === "active" && (client.deleted_at || !client.is_active)) return false;
      if (status === "inactive" && (client.deleted_at || client.is_active)) return false;
      if (status === "deleted" && !client.deleted_at) return false;
      if (link === "linked" && client.cliniko_patient_id === null) return false;
      if (link === "unlinked" && client.cliniko_patient_id !== null) return false;
      if (kind === "test" && !client.is_test) return false;
      if (kind === "real" && client.is_test) return false;
      if (
        classFilter &&
        !client.class_members.some((member) => String(member.classes.id) === classFilter)
      ) {
        return false;
      }
      return !search || clientName(client).toLowerCase().includes(search);
    })
    .sort(byName);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <NewClientButton />
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          aria-label="Search clients"
          placeholder="Search by name..."
          defaultValue={param(params.q)}
          className={`${filterClass} w-64`}
        />
        <select name="class" aria-label="Class" defaultValue={classFilter} className={filterClass}>
          <option value="">All classes</option>
          {classes?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select name="status" aria-label="Status" defaultValue={status} className={filterClass}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
        </select>
        <select name="link" aria-label="Cliniko link" defaultValue={link} className={filterClass}>
          <option value="">Linked and unlinked</option>
          <option value="linked">Linked to Cliniko</option>
          <option value="unlinked">Not linked</option>
        </select>
        <select name="kind" aria-label="Test data" defaultValue={kind} className={filterClass}>
          <option value="">Real and test</option>
          <option value="real">Real only</option>
          <option value="test">Test only</option>
        </select>
        <button type="submit" className={`${filterClass} font-medium text-gray-700 hover:bg-gray-50`}>
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Classes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shown.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="mr-2 font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {clientName(client)}
                  </Link>
                  <ClientChips client={client} />
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {client.class_members.map((member) => member.classes.name).join(", ") || "—"}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-500">
                  No clients match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
