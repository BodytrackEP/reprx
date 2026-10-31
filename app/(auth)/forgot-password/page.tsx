import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <p className="mb-4 text-sm text-gray-600">
        Enter your staff email and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
