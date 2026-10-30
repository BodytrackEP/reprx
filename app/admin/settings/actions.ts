"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/settings";

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      staff_session_timeout_hours: parsed.data.staffSessionTimeoutHours,
      client_session_timeout_days: parsed.data.clientSessionTimeoutDays,
      soft_delete_restore_days: parsed.data.softDeleteRestoreDays,
      retention_years_after_last_activity: parsed.data.retentionYears,
      rounding_increment_kg: parsed.data.roundingIncrementKg,
      rm_warn_above_reps: parsed.data.rmWarnAboveReps,
    })
    .eq("id", 1);
  if (error) return { error: "Could not save the settings." };

  revalidatePath("/admin", "layout");
  return { success: "Settings saved." };
}

export async function purgeTestData() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_test_data");
  if (error) throw new Error("Could not purge test data.");

  const { clients } = data as { clients: number };
  revalidatePath("/admin", "layout");
  redirect(`/admin/settings?purged=${clients}`);
}
