"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { type ImportPlan, parseCsv, planImport } from "@/lib/client-import";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 512 * 1024;

export type ImportState = {
  error?: string;
  success?: string;
  plan?: ImportPlan;
  csv?: string;
  fileName?: string;
};

/** The plan is always rebuilt on the server from the file's text, never trusted from the page. */
async function buildPlan(csv: string) {
  const supabase = await createClient();
  const [{ data: clients, error: clientError }, { data: classes, error: classError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, first_name, last_name, class_members(class_id)")
        .is("deleted_at", null),
      supabase.from("classes").select("id, name").eq("is_active", true),
    ]);
  if (clientError || classError) throw new Error("Could not load clients and classes.");
  const existing = clients.map((client) => ({
    ...client,
    class_ids: client.class_members.map((member) => member.class_id),
  }));
  return { supabase, plan: planImport(parseCsv(csv), existing, classes) };
}

export async function previewImport(_: ImportState, formData: FormData): Promise<ImportState> {
  await requireStaff();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > MAX_BYTES) return { error: "The file is too large. Split it into smaller files." };

  const csv = await file.text();
  const { plan } = await buildPlan(csv);
  if (plan.error) return { error: plan.error };
  return { plan, csv, fileName: file.name };
}

export async function runImport(_: ImportState, formData: FormData): Promise<ImportState> {
  await requireStaff();

  const csv = z.string().max(MAX_BYTES).safeParse(formData.get("csv"));
  if (!csv.success) return { error: "The file was lost. Choose it again." };

  const { supabase, plan } = await buildPlan(csv.data);
  if (plan.error) return { error: plan.error };
  if (plan.newClients.length === 0 && plan.existing.length === 0) {
    return { error: "There's nothing to import." };
  }

  const { data, error } = await supabase.rpc("import_clients", {
    p_new: plan.newClients,
    p_existing: plan.existing,
  });
  if (error) {
    return {
      error:
        error.code === "RX001"
          ? `Nothing was imported: ${error.message} Raise the class's capacity or split the list.`
          : dbErrorMessage(error, "Nothing was imported. Please try again."),
    };
  }

  const result = data as { created: number; memberships: number };
  revalidatePath("/admin", "layout");
  const clients = result.created === 1 ? "1 client" : `${result.created} clients`;
  const places = result.memberships === 1 ? "1 class place" : `${result.memberships} class places`;
  return { success: `Imported ${clients} and ${places}.` };
}
