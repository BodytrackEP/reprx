"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { toFraction } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import {
  assignSchema,
  classItemSchema,
  endAssignmentSchema,
} from "@/lib/validation/programs";

const refresh = (classId: number) => {
  revalidatePath(`/admin/classes/${classId}`, "layout");
  revalidatePath(`/admin/sessions/${classId}`);
};

export async function assignProgram(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = assignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { classId, programId, startDate, endDate } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_program", {
    p_class_id: classId,
    p_program_id: programId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Those dates overlap another program for this class. End the current one first."
          : dbErrorMessage(error, "Could not assign the program."),
    };
  }

  refresh(classId);
  return { success: "Assigned." };
}

export async function endAssignment(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = endAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_program_assignments")
    .update({ end_date: parsed.data.endDate })
    .eq("id", parsed.data.id);
  if (error) {
    return {
      error:
        error.code === "23514"
          ? "The end date can't be before the start date."
          : error.code === "23P01"
            ? "That end date would overlap another program for this class."
            : "Could not end the program.",
    };
  }

  refresh(parsed.data.classId);
  return { success: "Saved." };
}

/** Only a queued assignment that hasn't started can be withdrawn (enforced by RLS). */
export async function withdrawAssignment(formData: FormData) {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));
  const classId = idSchema.parse(formData.get("classId"));

  const supabase = await createClient();
  const { error } = await supabase.from("class_program_assignments").delete().eq("id", id);
  if (error) throw new Error("Could not withdraw the program.");

  refresh(classId);
}

export async function updateClassItem(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = classItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, classId, sets, reps, rmPercent, fallbackKg, restSeconds, notes } = parsed.data;

  // The database marks the row customised if anything actually changed.
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_program_items")
    .update({
      sets,
      reps,
      rm_percentage: rmPercent === undefined ? null : toFraction(rmPercent),
      fallback_weight_kg: fallbackKg ?? null,
      rest_seconds: restSeconds ?? null,
      notes: notes ?? null,
    })
    .eq("id", id);
  if (error) return { error: "Could not save this row." };

  refresh(classId);
  return { success: "Saved" };
}

const rowAction = z.tuple([idSchema, idSchema]);

async function runRowRpc(
  args: [number, number],
  call: (supabase: Awaited<ReturnType<typeof createClient>>, id: number) => PromiseLike<{
    error: { code?: string; message: string } | null;
  }>,
  fallback: string,
) {
  await requireStaff();
  const [classId, id] = rowAction.parse(args);
  const supabase = await createClient();
  const { error } = await call(supabase, id);
  if (error) return { error: dbErrorMessage(error, fallback) };
  refresh(classId);
  return {};
}

export async function moveClassItem(classId: number, id: number, direction: "up" | "down") {
  z.enum(["up", "down"]).parse(direction);
  return runRowRpc(
    [classId, id],
    (supabase, itemId) =>
      supabase.rpc("move_class_item", { p_item_id: itemId, p_direction: direction }),
    "Could not move the row.",
  );
}

export async function removeClassItem(classId: number, id: number) {
  return runRowRpc(
    [classId, id],
    (supabase, itemId) => supabase.rpc("remove_class_item", { p_item_id: itemId }),
    "Could not remove the row.",
  );
}

export async function resetClassItem(classId: number, id: number) {
  return runRowRpc(
    [classId, id],
    (supabase, itemId) => supabase.rpc("reset_class_item", { p_item_id: itemId }),
    "Could not reset the row.",
  );
}

export async function addClassItem(classId: number, assignmentId: number, exerciseId: number) {
  await requireStaff();
  const [cls, assignment, exercise] = z
    .tuple([idSchema, idSchema, idSchema])
    .parse([classId, assignmentId, exerciseId]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_class_item", {
    p_assignment_id: assignment,
    p_exercise_id: exercise,
  });
  if (error) return { error: dbErrorMessage(error, "Could not add the exercise.") };

  refresh(cls);
  return {};
}
