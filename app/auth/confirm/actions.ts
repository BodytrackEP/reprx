"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailLinkSchema } from "@/lib/validation/auth";

export async function confirmEmailLink(formData: FormData) {
  const parsed = emailLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?reason=link-expired");

  const { tokenHash, type } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect("/login?reason=link-expired");

  redirect(type === "invite" ? "/accept-invite" : "/reset-password");
}
