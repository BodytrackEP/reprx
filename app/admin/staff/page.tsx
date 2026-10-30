import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { updateStaff } from "./actions";
import { InviteForm } from "./invite-form";

export default async function StaffPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, display_name, role, is_active")
    .order("display_name");
  if (error) throw new Error("Could not load staff.");

  // Staff emails live in auth.users, which only the admin API can read.
  const { data: users } = await createAdminClient().auth.admin.listUsers();
  const emails = new Map(users.users.map((user) => [user.id, user.email]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Staff</h1>

      <div className="mb-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{member.display_name}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{emails.get(member.id)}</td>
                <td className="px-6 py-3 text-sm text-gray-900">
                  {member.role === "admin" ? "Admin" : "EP"}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {member.is_active ? "Active" : "Deactivated"}
                </td>
                <td className="px-6 py-3 text-right text-sm">
                  {member.id === me.id ? (
                    <span className="text-gray-400">You</span>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <form action={updateStaff}>
                        <input type="hidden" name="id" value={member.id} />
                        <input
                          type="hidden"
                          name="role"
                          value={member.role === "admin" ? "ep" : "admin"}
                        />
                        <button type="submit" className="font-medium text-indigo-600 hover:text-indigo-800">
                          Make {member.role === "admin" ? "EP" : "admin"}
                        </button>
                      </form>
                      <form action={updateStaff}>
                        <input type="hidden" name="id" value={member.id} />
                        <input type="hidden" name="isActive" value={String(!member.is_active)} />
                        <button type="submit" className="font-medium text-indigo-600 hover:text-indigo-800">
                          {member.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteForm />
    </div>
  );
}
