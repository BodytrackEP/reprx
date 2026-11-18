"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type FormState, requireAdmin, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { toFraction } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import { classPrescriptionSchema } from "@/lib/validation/programs";

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

/**
 * Changes sets, reps and % on this class's copy of the program, for progression mid-block.
 * The database marks the row customised, so a later library push leaves it alone; past
 * sessions keep their recorded values.
 */
export async function updatePrescription(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = classPrescriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, classId, sets, reps, rmPercent } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_program_items")
    .update({
      sets,
      reps,
      rm_percentage: rmPercent === undefined ? null : toFraction(rmPercent),
    })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { error: "Could not save the change." };

  revalidatePath(`/admin/sessions/${classId}`);
  revalidatePath(`/admin/classes/${classId}`, "layout");
  return { success: "Saved." };
}

/** Saves the class's client order, used by every session of the class. */
export async function setClientOrder(classId: number, clientIds: number[]) {
  await requireStaff();
  const cls = idSchema.parse(classId);
  const ids = z.array(idSchema).max(500).parse(clientIds);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_order", {
    p_class_id: cls,
    p_client_ids: ids,
  });
  if (error) return { error: dbErrorMessage(error, "Could not save the order.") };

  revalidatePath(`/admin/sessions/${cls}`, "layout");
  return {};
}
