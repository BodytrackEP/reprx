"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { totpSchema } from "@/lib/validation/auth";

export async function verifyCode(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = totpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter the 6-digit code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);

  if (error) return { error: "That code didn't work. Check it and try again." };

  redirect("/admin");
}
