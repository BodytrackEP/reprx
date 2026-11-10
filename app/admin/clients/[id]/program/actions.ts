"use server";

import { revalidatePath } from "next/cache";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import { overrideSchema } from "@/lib/validation/training";

// Overrides follow the client, so every screen showing weights may change.
const refresh = () => revalidatePath("/admin", "layout");

export async function setOverride(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { clientId, exerciseId, weightKg, note, reviewDate } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_override", {
    p_client_id: clientId,
    p_exercise_id: exerciseId,
    p_weight_kg: weightKg,
    p_note: note,
    p_review_date: reviewDate,
  });
  if (error) return { error: dbErrorMessage(error, "Could not save the override.") };

  refresh();
  return { success: "Saved." };
}

export async function endOverride(rawClientId: number, rawExerciseId: number) {
  await requireStaff();
  const clientId = idSchema.parse(rawClientId);
  const exerciseId = idSchema.parse(rawExerciseId);

  const supabase = await createClient();
  const { data: active, error: findError } = await supabase
    .from("weight_overrides")
    .select("id")
    .eq("client_id", clientId)
    .eq("exercise_id", exerciseId)
    .is("ended_at", null)
    .maybeSingle();
  if (findError || !active) return { error: "That override is not active." };

  const { error } = await supabase.rpc("end_override", { p_override_id: active.id });
  if (error) return { error: dbErrorMessage(error, "Could not end the override.") };

  refresh();
  return {};
}
