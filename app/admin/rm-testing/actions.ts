"use server";

import { revalidatePath } from "next/cache";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { rmTestSchema, voidTestSchema } from "@/lib/validation/training";

export async function recordRmTest(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = rmTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { clientId, exerciseId, testDate, reps, weightKg, notes } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rm_tests")
    .insert({
      client_id: clientId,
      exercise_id: exerciseId,
      test_date: testDate,
      reps,
      weight_kg: weightKg,
      notes: notes ?? null,
    })
    .select("estimated_1rm_kg")
    .single();
  if (error) return { error: "Could not record the test." };

  revalidatePath("/admin/rm-testing");
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: `Recorded. Estimated 1RM: ${data.estimated_1rm_kg} kg.` };
}

export async function voidRmTest(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = voidTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rm_tests")
    .update({
      voided_at: new Date().toISOString(),
      voided_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.id)
    .select("client_id")
    .single();
  if (error) return { error: dbErrorMessage(error, "Could not void the test.") };

  revalidatePath("/admin/rm-testing");
  revalidatePath(`/admin/clients/${data.client_id}`);
  return { success: "Voided." };
}
