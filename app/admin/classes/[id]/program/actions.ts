"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import {
  idSchema,
  programExerciseSchema,
  programNameSchema,
} from "@/lib/validation/catalog";

const refresh = (classId: number) => {
  revalidatePath(`/admin/classes/${classId}/program`);
  revalidatePath(`/admin/classes/${classId}`);
};

export async function addProgramExercise(rawClassId: number, rawExerciseId: number) {
  await requireStaff();
  const classId = idSchema.parse(rawClassId);
  const exerciseId = idSchema.parse(rawExerciseId);

  const supabase = await createClient();

  let { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("class_id", classId)
    .maybeSingle();

  if (!program) {
    const { data: classRow } = await supabase
      .from("classes")
      .select("name")
      .eq("id", classId)
      .single();
    const { data: created, error } = await supabase
      .from("programs")
      .insert({ class_id: classId, name: `${classRow?.name ?? "Class"} Program` })
      .select("id")
      .single();
    if (error) return { error: "Could not create the program." };
    program = created;
  }

  const { data: last } = await supabase
    .from("program_exercises")
    .select("order_index")
    .eq("program_id", program.id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("program_exercises").insert({
    program_id: program.id,
    exercise_id: exerciseId,
    order_index: (last?.order_index ?? 0) + 1,
    sets: 3,
    reps: 10,
    rm_percentage: 0.7,
    rest_seconds: 60,
  });
  if (error) return { error: "Could not add the exercise." };

  refresh(classId);
  return {};
}

export async function updateProgramExercise(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = programExerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, classId, sets, reps, rmPercent, fallbackKg, restSeconds, notes } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_exercises")
    .update({
      sets,
      reps,
      rm_percentage: rmPercent === undefined ? null : Number((rmPercent / 100).toFixed(3)),
      fallback_weight_kg: fallbackKg ?? null,
      rest_seconds: restSeconds ?? null,
      notes: notes ?? null,
    })
    .eq("id", id);
  if (error) return { error: "Could not save this exercise." };

  refresh(classId);
  return { success: "Saved" };
}

export async function renameProgram(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = programNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) return { error: "Could not rename the program." };

  refresh(parsed.data.classId);
  return { success: "Saved" };
}

export async function removeProgramExercise(rawClassId: number, rawId: number) {
  await requireStaff();
  const classId = idSchema.parse(rawClassId);
  const id = idSchema.parse(rawId);

  const supabase = await createClient();
  const { error } = await supabase.from("program_exercises").delete().eq("id", id);
  if (error) return { error: "Could not remove the exercise." };

  refresh(classId);
  return {};
}

export async function moveProgramExercise(
  rawClassId: number,
  rawProgramId: number,
  rawId: number,
  direction: "up" | "down",
) {
  await requireStaff();
  const classId = idSchema.parse(rawClassId);
  const programId = idSchema.parse(rawProgramId);
  const id = idSchema.parse(rawId);
  z.enum(["up", "down"]).parse(direction);

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("program_exercises")
    .select("id")
    .eq("program_id", programId)
    .order("order_index");
  if (error) return { error: "Could not load the program." };

  const ids = rows.map((row) => row.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return {};

  [ids[from], ids[to]] = [ids[to], ids[from]];

  const { error: reorderError } = await supabase.rpc("reorder_program_exercises", {
    p_program_id: programId,
    p_ids: ids,
  });
  if (reorderError) {
    return { error: dbErrorMessage(reorderError, "Could not reorder the program.") };
  }

  refresh(classId);
  return {};
}
