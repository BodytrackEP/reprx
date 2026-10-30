"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { signOut } from "../login/actions";
import { verifyCode } from "./actions";

export function MfaForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState(verifyCode, {});

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="factorId" value={factorId} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
        <FormMessage state={state} />
        <SubmitButton className="w-full">Verify</SubmitButton>
      </form>
      <form action={signOut} className="mt-3 text-center">
        <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </form>
    </>
  );
}
