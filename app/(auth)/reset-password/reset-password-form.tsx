"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { resetPassword } from "./actions";

export function ResetPasswordForm({ needsCode }: { needsCode: boolean }) {
  const [state, action] = useActionState(resetPassword, {});

  return (
    <form action={action} className="space-y-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        hint="At least 12 characters."
        required
      />
      <Field
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      {needsCode && (
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          hint="From your authenticator app."
          required
        />
      )}
      <FormMessage state={state} />
      <SubmitButton className="w-full">Save new password</SubmitButton>
    </form>
  );
}
