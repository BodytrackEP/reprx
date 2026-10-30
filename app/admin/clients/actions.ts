"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import { clientSchema, idListSchema } from "@/lib/validation/clients";

export async function saveClient(_: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, firstName, lastName, preferredName } = parsed.data;
  const row = {
    first_name: firstName,
    last_name: lastName,
    preferred_name: preferredName ?? null,
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("clients").update(row).eq("id", id);
    if (error) return { error: "Could not save the client." };

    revalidatePath(`/admin/clients/${id}`);
    return { success: "Saved." };
  }

  // Decision D2: only prod holds real people. Everywhere else, a new client is test data.
  const { data: settings } = await supabase
    .from("app_settings")
    .select("environment")
    .single();
  if (!settings || settings.environment === "unset") {
    return { error: "This environment hasn't been configured yet. Ask an admin." };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...row, is_test: settings.environment !== "prod" })
    .select("id")
    .single();
  if (error) return { error: "Could not create the client." };

  redirect(`/admin/clients/${data.id}`);
}

async function updateClientFlags(
  formData: FormData,
  flags: { is_active?: boolean; deleted_at?: string | null },
) {
  await requireStaff();
  const id = idSchema.parse(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(flags).eq("id", id);
  if (error) throw new Error("Could not update the client.");

  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/clients");
}

export async function deactivateClient(formData: FormData) {
  await updateClientFlags(formData, { is_active: false });
}

export async function reactivateClient(formData: FormData) {
  await updateClientFlags(formData, { is_active: true });
}

export async function softDeleteClient(formData: FormData) {
  await updateClientFlags(formData, { deleted_at: new Date().toISOString() });
}

export async function restoreClient(formData: FormData) {
  await updateClientFlags(formData, { deleted_at: null });
}

export async function assignClasses(
  rawClientId: number,
  rawClassIds: number[],
  allowOverCapacity: boolean,
) {
  await requireStaff();
  const clientId = idSchema.parse(rawClientId);
  const classIds = idListSchema.parse(rawClassIds);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_client_classes", {
    p_client_id: clientId,
    p_class_ids: classIds,
    p_allow_over_capacity: allowOverCapacity,
  });
  if (error) return { error: dbErrorMessage(error, "Could not update classes.") };

  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}
