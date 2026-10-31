import Link from "next/link";
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
      {reason === "link-expired" && (
        <p role="status" className="mb-4 text-sm text-gray-600">
          That link has expired or was already used. Please request a new one.
        </p>
      )}
      <LoginForm />
      <p className="mt-4 text-center">
        <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-700">
          Forgot your password?
        </Link>
      </p>
    </AuthCard>
  );
}
