"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/validation/auth";

const codeSchema = z.string().regex(/^\d{6}$/);

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // The emailed link proves access to a mailbox, not the second factor.
  if (data.claims.aal !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];

    if (factor) {
      const code = codeSchema.safeParse(formData.get("code"));
      if (!code.success) return { error: "Enter the 6-digit code." };

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.data,
      });
      if (error) return { error: "That code didn't work. Check it and try again." };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password you haven't just been using." };
    }
    return {
      error:
        error.code === "weak_password"
          ? "That password is too weak or has appeared in a data breach. Choose another."
          : "Could not reset your password. Your link may have expired.",
    };
  }

  // A reset often follows a suspected compromise, so other devices are signed out.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/mfa");
}
