import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export default async function MfaPage() {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  if (claims.claims.aal === "aal2") redirect("/admin");

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error("Could not load your authenticator settings.");

  const verified = factors.totp[0];
  if (verified) {
    return (
      <AuthCard title="Enter your code">
        <p className="mb-4 text-sm text-gray-600">
          Open your authenticator app and enter the 6-digit code for RepRx.
        </p>
        <MfaForm factorId={verified.id} />
      </AuthCard>
    );
  }

  // First login. An abandoned enrolment leaves an unverified factor, so clear it first.
  for (const factor of factors.all) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data: enrolment, error: enrolError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "RepRx",
  });
  if (enrolError) throw new Error("Could not start authenticator set-up.");

  return (
    <AuthCard title="Set up your authenticator">
      <p className="mb-4 text-sm text-gray-600">
        Two-step sign-in is required for all staff. Scan this code with an authenticator
        app, then enter the 6-digit code it shows.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
      <img
        src={enrolment.totp.qr_code}
        alt="QR code for your authenticator app. The set-up key below does the same job."
        width={200}
        height={200}
        className="mx-auto mb-4"
      />
      <p className="mb-1 text-sm text-gray-600">Or enter this key by hand:</p>
      <code
        data-testid="totp-secret"
        className="mb-4 block break-all rounded bg-gray-100 p-2 text-xs text-gray-900"
      >
        {enrolment.totp.secret}
      </code>
      <MfaForm factorId={enrolment.id} />
    </AuthCard>
  );
}
