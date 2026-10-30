"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { classSchema } from "@/lib/validation/catalog";

export async function saveClass(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, name, categoryCode, dayOfWeek, startTime, endTime, location, maxCapacity, isActive } =
    parsed.data;
  const row = {
    name,
    category_code: categoryCode,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    location: location ?? null,
    max_capacity: maxCapacity ?? null,
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("classes")
      .update({ ...row, is_active: isActive === "on" })
      .eq("id", id);
    if (error) return { error: "Could not save the class." };

    revalidatePath(`/admin/classes/${id}`);
    return { success: "Saved." };
  }

  const { data, error } = await supabase
    .from("classes")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: "Could not create the class." };

  redirect(`/admin/classes/${data.id}`);
}
