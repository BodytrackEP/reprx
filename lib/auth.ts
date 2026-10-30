import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type { FormState } from "./auth-types";

/**
 * The signed-in staff member. Reading the row goes through RLS, so it needs an active
 * account and an AAL2 session. Call this in every Server Action as well as in layouts:
 * Server Actions are POSTs that a proxy matcher change could silently stop covering.
 */
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/login");
  if (data.claims.aal !== "aal2") redirect("/mfa");

  const { data: staff } = await supabase
    .from("staff")
    .select("id, display_name, role")
    .eq("id", data.claims.sub)
    .maybeSingle();

  if (!staff) redirect("/no-access");

  return { ...staff, isAdmin: staff.role === "admin" };
});

export async function requireAdmin() {
  const staff = await requireStaff();
  if (!staff.isAdmin) redirect("/admin");
  return staff;
}
