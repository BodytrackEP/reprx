import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;

  return (
    <AuthCard title="Staff sign in">
      {reason === "timeout" && (
        <p role="status" className="mb-4 text-sm text-gray-600">
          Your session timed out. Please sign in again.
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}
