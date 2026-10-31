"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { secondaryButton } from "@/components/modal";
import { inviteStaff } from "./actions";
import { InviteLinkResult } from "./invite-link";

function CreateLinkButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="mode"
      value="link"
      disabled={pending}
      className={`${secondaryButton} disabled:opacity-50`}
    >
      Create invite link
    </button>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(inviteStaff, {});
  const name = useRef("");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        name.current = String(new FormData(event.currentTarget).get("displayName") ?? "");
      }}
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
      {/* eslint-disable-next-line react-hooks/refs -- set on submit, read when the result arrives */}
      {state.link && <InviteLinkResult link={state.link} name={name.current} />}
      <div className="flex flex-wrap gap-3">
        <SubmitButton>Send invite</SubmitButton>
        <CreateLinkButton />
      </div>
      <p className="text-xs text-gray-500">
        Send invite emails the person. Create invite link gives you a link to send yourself.
      </p>
    </form>
  );
}
