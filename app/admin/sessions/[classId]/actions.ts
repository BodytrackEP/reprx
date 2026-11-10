"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type FormState, requireAdmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";

const correctionSchema = z.object({
  rowId: idSchema,
  classId: idSchema,
  effectiveKg: z.coerce
    .number({ error: "Enter the weight." })
    .min(0, "Weight can't be negative.")
    .max(9999.99),
  note: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(200, "Notes are limited to 200 characters.").optional(),
  ),
});

/** Corrects a cell of a locked past session. Admin only, and audited with old and new values. */
export async function correctSnapshot(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { rowId, classId, effectiveKg, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_snapshot_row", {
    p_row_id: rowId,
    p_effective_kg: effectiveKg,
    // An empty note clears it.
    p_note: note ?? "",
  });
  if (error) return { error: dbErrorMessage(error, "Could not correct the session.") };

  revalidatePath(`/admin/sessions/${classId}`);
  return { success: "Corrected." };
}
