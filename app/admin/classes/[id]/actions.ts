"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/catalog";
import { idListSchema } from "@/lib/validation/clients";

export async function addMembers(
  rawClassId: number,
  rawClientIds: number[],
  allowOverCapacity: boolean,
) {
  await requireStaff();
  const classId = idSchema.parse(rawClassId);
  const clientIds = idListSchema.parse(rawClientIds);

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_class_members", {
    p_class_id: classId,
    p_client_ids: clientIds,
    p_allow_over_capacity: allowOverCapacity,
  });
  if (error) return { error: dbErrorMessage(error, "Could not add the clients.") };

  revalidatePath(`/admin/classes/${classId}`);
  return {};
}

export async function removeMember(rawClassId: number, rawClientId: number) {
  await requireStaff();
  const classId = idSchema.parse(rawClassId);
  const clientId = idSchema.parse(rawClientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("client_id", clientId);
  if (error) return { error: "Could not remove the client." };

  revalidatePath(`/admin/classes/${classId}`);
  return {};
}

export async function moveMembers(
  rawFromClass: number,
  rawToClass: number,
  rawClientIds: number[],
  allowOverCapacity: boolean,
) {
  await requireStaff();
  const fromClass = idSchema.parse(rawFromClass);
  const toClass = idSchema.parse(rawToClass);
  const clientIds = idListSchema.parse(rawClientIds);

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_clients", {
    p_client_ids: clientIds,
    p_from_class: fromClass,
    p_to_class: toClass,
    p_allow_over_capacity: allowOverCapacity,
  });
  if (error) return { error: dbErrorMessage(error, "Could not move the clients.") };

  revalidatePath(`/admin/classes/${fromClass}`);
  revalidatePath(`/admin/classes/${toClass}`);
  return {};
}
