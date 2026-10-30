"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { setPassword } from "./actions";

export function AcceptInviteForm() {
  const [state, action] = useActionState(setPassword, {});

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
      <FormMessage state={state} />
      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  );
}
