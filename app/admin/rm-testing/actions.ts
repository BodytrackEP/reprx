"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage, UNIQUE_VIOLATION } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { rmResultSchema, rmSessionSchema, voidTestSchema } from "@/lib/validation/training";

const refresh = (clientId: number) => {
  revalidatePath("/admin/rm-testing");
  revalidatePath(`/admin/clients/${clientId}`, "layout");
};

export async function createRmSession(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = rmSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clientId, testDate, notes } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rm_testing_sessions")
    .insert({ client_id: clientId, test_date: testDate, notes: notes ?? null })
    .select("id")
    .single();
  if (error) return { error: "Could not start the testing session." };

  refresh(clientId);
  redirect(`/admin/rm-testing?client=${clientId}&session=${data.id}`);
}

export async function recordResult(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = rmResultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clientId, sessionId, exerciseId, reps, weightKg } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rm_results")
    .insert({ session_id: sessionId, exercise_id: exerciseId, reps, weight_kg: weightKg })
    .select("estimated_1rm_kg")
    .single();
  if (error) {
    return {
      error:
        error.code === UNIQUE_VIOLATION
          ? "That exercise is already recorded in this session. Void it first to record it again."
          : "Could not record the result.",
    };
  }

  refresh(clientId);
  return { success: `Recorded. Estimated 1RM: ${data.estimated_1rm_kg} kg.` };
}

export async function voidResult(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = voidTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rm_results")
    .update({ voided_at: new Date().toISOString(), voided_reason: parsed.data.reason })
    .eq("id", parsed.data.id)
    .select("rm_testing_sessions(client_id)")
    .single();
  if (error) return { error: dbErrorMessage(error, "Could not void the result.") };

  refresh(data.rm_testing_sessions.client_id);
  return { success: "Voided." };
}
