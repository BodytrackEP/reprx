import { ConfirmButton } from "@/components/confirm-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resetAuthenticator, updateStaff } from "./actions";
import { InviteForm } from "./invite-form";
import { InviteLinkButton } from "./invite-link";

const MFA_NOTICES: Record<string, string> = {
  reset: "Authenticator reset. They set up a new one the next time they sign in.",
  none: "That person has no authenticator to reset.",
  failed: "Could not reset the authenticator. Check the audit log, then try again.",
};

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const me = await requireAdmin();
  const { mfa } = await searchParams;
  const notice = typeof mfa === "string" ? MFA_NOTICES[mfa] : undefined;
  const supabase = await createClient();

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, display_name, role, is_active")
    .order("display_name");
  if (error) throw new Error("Could not load staff.");

  // Staff emails live in auth.users, which only the admin API can read.
  const admin = createAdminClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const accounts = new Map(users.users.map((user) => [user.id, user]));
  const isPending = (id: string) => !accounts.get(id)?.email_confirmed_at;

  // listUsers doesn't include MFA factors, so these are fetched per person.
  const enrolled = new Set(
    (
      await Promise.all(
        staff.map(async (member) => {
          const { data } = await admin.auth.admin.mfa.listFactors({ userId: member.id });
          const verified = data?.factors.some((factor) => factor.status === "verified");
          return verified ? member.id : null;
        }),
      )
    ).filter(Boolean),
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Staff</h1>

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
          {notice}
        </p>
      )}

      <div className="mb-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Authenticator</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{member.display_name}</td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {accounts.get(member.id)?.email}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900">
                  {member.role === "admin" ? "Admin" : "EP"}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {!member.is_active ? "Deactivated" : isPending(member.id) ? "Invited" : "Active"}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {enrolled.has(member.id) ? "Set up" : "Not set up"}
                </td>
                <td className="px-6 py-3 text-right text-sm">
                  {member.id === me.id ? (
                    <span className="text-gray-400">You</span>
                  ) : (
                    <div className="flex justify-end gap-3">
                      {member.is_active && isPending(member.id) && (
                        <InviteLinkButton staffId={member.id} name={member.display_name} />
                      )}
                      {enrolled.has(member.id) && (
                        <ConfirmButton
                          action={resetAuthenticator}
                          id={member.id}
                          message={`Reset the authenticator for ${member.display_name}? Confirm it's really them first, in person or by phone. Anyone with their password can then set up a new authenticator. They will be signed out.`}
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          Reset authenticator
                        </ConfirmButton>
                      )}
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
