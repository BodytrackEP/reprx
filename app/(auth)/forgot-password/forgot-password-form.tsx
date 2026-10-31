"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, {});

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="username" required />
      <FormMessage state={state} />
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
