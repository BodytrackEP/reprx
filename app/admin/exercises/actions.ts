"use server";

import { revalidatePath } from "next/cache";
import { type FormState, requireStaff } from "@/lib/auth";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { exerciseSchema, idSchema } from "@/lib/validation/catalog";

const DUPLICATE = "An exercise with that name already exists.";

export async function saveExercise(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = exerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, name, muscleGroup, equipment, description, videoUrl } = parsed.data;
  const row = {
    name,
    muscle_group: muscleGroup ?? null,
    equipment: equipment ?? null,
    description: description ?? null,
    video_url: videoUrl ?? null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("exercises").update(row).eq("id", id)
    : await supabase.from("exercises").insert(row);

  if (error) {
    return {
      error: error.code === UNIQUE_VIOLATION ? DUPLICATE : "Could not save the exercise.",
    };
  }

  revalidatePath("/admin/exercises");
  return { success: "Saved." };
}

/** For the exercise picker, which returns the new exercise to the form it sits in. */
export async function createExerciseInline(input: {
  name: string;
  muscleGroup: string;
  equipment: string;
}) {
  await requireStaff();

  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup ?? null,
      equipment: parsed.data.equipment ?? null,
    })
    .select("id, name, muscle_group, equipment")
    .single();

  if (error) {
    return {
      error: error.code === UNIQUE_VIOLATION ? DUPLICATE : "Could not create the exercise.",
    };
  }

  revalidatePath("/admin/exercises");
  return { exercise: data };
}

/** Deletes an unused exercise. One still referenced is deactivated, keeping its history. */
export async function removeExercise(formData: FormData) {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", id);

  if (error?.code === FOREIGN_KEY_VIOLATION) {
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ is_active: false })
      .eq("id", id);
    if (updateError) throw new Error("Could not deactivate the exercise.");
  } else if (error) {
    throw new Error("Could not delete the exercise.");
  }

  revalidatePath("/admin/exercises");
}

export async function reactivateExercise(formData: FormData) {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw new Error("Could not reactivate the exercise.");

  revalidatePath("/admin/exercises");
}
