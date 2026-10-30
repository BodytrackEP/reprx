import { AuthCard } from "@/components/auth-card";
import { signOut } from "../(auth)/login/actions";

export default function NoAccessPage() {
  return (
    <AuthCard title="No access">
      <p className="mb-4 text-sm text-gray-600">
        Your account isn&apos;t an active staff account. Please contact a RepRx admin.
      </p>
      <form action={signOut}>
        <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
