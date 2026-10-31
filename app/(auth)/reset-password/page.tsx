import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const needsCode = data.claims.aal !== "aal2" && (factors?.totp.length ?? 0) > 0;

  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm needsCode={needsCode} />
    </AuthCard>
  );
}
