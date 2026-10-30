"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { inviteStaff } from "./actions";

export function InviteForm() {
  const [state, action] = useActionState(inviteStaff, {});

  return (
    <form
      action={action}
      className="max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">Invite staff</h2>
      <Field label="Name" name="displayName" required />
      <Field label="Staff email" name="email" type="email" required />
      <SelectField label="Role" name="role" defaultValue="ep">
        <option value="ep">EP</option>
        <option value="admin">Admin</option>
      </SelectField>
      <FormMessage state={state} />
      <SubmitButton>Send invite</SubmitButton>
    </form>
  );
}
