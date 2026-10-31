"use server";

import type { FormState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function requestPasswordReset(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);

  // The reply is the same either way, so this can't be used to find out who has an account.
  if (error) console.error("Password reset request failed:", error.code);

  return { success: "If that email has an account, a reset link is on its way." };
}
