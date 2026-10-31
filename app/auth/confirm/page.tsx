import { AuthCard } from "@/components/auth-card";
import { SubmitButton } from "@/components/form";
import { emailLinkSchema } from "@/lib/validation/auth";
import { confirmEmailLink } from "./actions";

// Email scanners open links automatically, which would use up a one-time token if opening
// the link signed the person in. So the token is only spent when they press the button.
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const { token_hash: tokenHash, type } = await searchParams;
  const link = emailLinkSchema.safeParse({ tokenHash, type });

  if (!link.success) {
    return (
      <AuthCard title="Link not valid">
        <p className="text-sm text-gray-600">
          This link isn&apos;t complete. Please open it from the email again.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={link.data.type === "invite" ? "Accept your invite" : "Reset your password"}>
      <form action={confirmEmailLink}>
        <input type="hidden" name="tokenHash" value={link.data.tokenHash} />
        <input type="hidden" name="type" value={link.data.type} />
        <SubmitButton className="w-full">Continue</SubmitButton>
      </form>
    </AuthCard>
  );
}
