import { AuthCard } from "@/components/auth-card";
import { AcceptInviteForm } from "./accept-invite-form";

export default function AcceptInvitePage() {
  return (
    <AuthCard title="Choose a password">
      <AcceptInviteForm />
    </AuthCard>
  );
}
