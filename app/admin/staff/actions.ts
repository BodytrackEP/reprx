"use server";

import { revalidatePath } from "next/cache";
import { type FormState, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, staffUpdateSchema } from "@/lib/validation/auth";

export async function inviteStaff(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, displayName, role } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    return {
      error:
        error.code === "email_exists"
          ? "That email already has an account."
          : "Could not send the invite. Please try again.",
    };
  }

  // Inserted as the signed-in admin, so the audit log records who sent the invite.
  const supabase = await createClient();
  const { error: staffError } = await supabase
    .from("staff")
    .insert({ id: data.user.id, display_name: displayName, role });

  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Could not create the staff record. Please try again." };
  }

  revalidatePath("/admin/staff");
  return { success: `Invite sent to ${email}.` };
}

export async function updateStaff(formData: FormData) {
  const me = await requireAdmin();

  const parsed = staffUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Invalid staff update.");

  const { id, role, isActive } = parsed.data;

  // Keeps at least one active admin: an admin can't demote or deactivate themselves.
  if (id === me.id) throw new Error("You can't change your own account.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      ...(role && { role }),
      ...(isActive && { is_active: isActive === "true" }),
    })
    .eq("id", id);
  if (error) throw new Error("Could not update staff.");

  revalidatePath("/admin/staff");
}
