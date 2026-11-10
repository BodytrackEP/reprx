"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { toFraction } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import { type ProgramItemInput, saveProgramSchema } from "@/lib/validation/programs";

const nameSchema = z.string().trim().min(1, "Enter a program name.").max(100);

export async function createProgram(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_program", { p_name: name.data });
  if (error) return { error: dbErrorMessage(error, "Could not create the program.") };

  redirect(`/admin/programs/${data}`);
}

export async function duplicateProgram(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_program", {
    p_program_id: id,
    p_name: name.data,
  });
  if (error) return { error: dbErrorMessage(error, "Could not duplicate the program.") };

  redirect(`/admin/programs/${data}`);
}

export async function setArchived(formData: FormData) {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));
  const archived = formData.get("archived") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_program_archived", {
    p_program_id: id,
    p_archived: archived,
  });
  if (error) throw new Error("Could not update the program.");

  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${id}`);
}

/** Saves a new version and pushes it to the classes running or queued to run it. */
export async function saveProgram(input: {
  programId: number;
  name: string;
  items: ProgramItemInput[];
}): Promise<FormState> {
  await requireStaff();

  const parsed = saveProgramSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = issue.path[0] === "items" ? ` (row ${Number(issue.path[1]) + 1})` : "";
    return { error: `${issue.message}${row}` };
  }

  const { programId, name, items } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_program_version", {
    p_program_id: programId,
    p_name: name,
    p_items: items.map((item) => ({
      item_key: item.itemKey ?? null,
      exercise_id: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      rm_percentage: item.rmPercent === undefined ? null : toFraction(item.rmPercent),
      fallback_weight_kg: item.fallbackKg ?? null,
      rest_seconds: item.restSeconds ?? null,
      notes: item.notes ?? null,
      superset_group: item.supersetGroup ?? null,
    })),
  });
  if (error) return { error: dbErrorMessage(error, "Could not save the program.") };

  const result = data as { version_no: number; classes_updated: number };
  revalidatePath("/admin", "layout");
  const classes =
    result.classes_updated === 1 ? "1 class" : `${result.classes_updated} classes`;
  return { success: `Saved as version ${result.version_no}. Updated ${classes}.` };
}
