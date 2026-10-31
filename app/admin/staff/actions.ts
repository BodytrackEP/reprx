"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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

export async function resetAuthenticator(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: id });
  if (error) redirect("/admin/staff?mfa=failed");
  if (data.factors.length === 0) redirect("/admin/staff?mfa=none");

  // Audited as the signed-in admin. If this fails, the authenticator is left in place.
  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("record_authenticator_reset", {
    p_staff_id: id,
  });
  if (auditError) redirect("/admin/staff?mfa=failed");

  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      userId: id,
      id: factor.id,
    });
    if (deleteError) redirect("/admin/staff?mfa=failed");
  }

  revalidatePath("/admin/staff");
  redirect("/admin/staff?mfa=reset");
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
