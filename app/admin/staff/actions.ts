"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type InviteState, requireAdmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, staffUpdateSchema } from "@/lib/validation/auth";

function inviteLink(properties: { hashed_token: string; redirect_to: string }) {
  const site = new URL(properties.redirect_to).origin;
  return `${site}/auth/confirm?token_hash=${properties.hashed_token}&type=invite`;
}

export async function inviteStaff(_: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, displayName, role, mode } = parsed.data;

  const admin = createAdminClient();

  let userId: string;
  let link: string | undefined;

  if (mode === "link") {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
    if (error) {
      return {
        error:
          error.code === "email_exists"
            ? "That email already has an account."
            : "Could not create the link. Please try again.",
      };
    }
    userId = data.user.id;
    link = inviteLink(data.properties);
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) {
      return {
        error:
          error.code === "email_exists"
            ? "That email already has an account."
            : "Could not send the invite. Try Create invite link instead.",
      };
    }
    userId = data.user.id;
  }

  // Inserted as the signed-in admin, so the audit log records who sent the invite.
  const supabase = await createClient();
  const { error: staffError } = await supabase
    .from("staff")
    .insert({ id: userId, display_name: displayName, role });

  if (staffError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Could not create the staff record. Please try again." };
  }

  revalidatePath("/admin/staff");

  if (!link) return { success: `Invite sent to ${email}.` };

  const { error: auditError } = await supabase.rpc("record_invite_link", {
    p_staff_id: userId,
  });
  if (auditError) return { error: "Could not record the link, so it wasn't created." };

  return { link };
}

/** For someone already on the staff list who hasn't accepted their invite. */
export async function createInviteLink(
  _: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user.email) return { error: "Could not find that account." };
  if (data.user.email_confirmed_at) return { error: "This account is already active." };

  // Audited first: no link leaves here without a record of who created it.
  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("record_invite_link", { p_staff_id: id });
  if (auditError) return { error: dbErrorMessage(auditError, "Could not create the link.") };

  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: data.user.email,
  });
  if (linkError) return { error: "Could not create the link. Please try again." };

  return { link: inviteLink(generated.properties) };
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
