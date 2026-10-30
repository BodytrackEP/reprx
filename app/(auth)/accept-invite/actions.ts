"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/validation/auth";

export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error:
        error.code === "weak_password"
          ? "That password is too weak or has appeared in a data breach. Choose another."
          : "Could not set your password. Your invite may have expired.",
    };
  }

  redirect("/mfa");
}
