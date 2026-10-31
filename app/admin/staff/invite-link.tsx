"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { createInviteLink } from "./actions";

/** Shown once. The link isn't stored anywhere, so closing this means creating another. */
export function InviteLinkResult({ link, name }: { link: string; name: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Invite link for {name}</p>
      <input
        readOnly
        aria-label="Invite link"
        value={link}
        onFocus={(event) => event.target.select()}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
      />
      <button
        type="button"
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <p className="text-xs text-amber-900">
        Send this privately and straight away. It works once and expires in about an hour.
        Don&apos;t open it yourself. If it expires, create another.
      </p>
    </div>
  );
}

function CreateLinkForm({ staffId, name }: { staffId: string; name: string }) {
  const [state, action] = useActionState(createInviteLink, {});

  if (state.link) return <InviteLinkResult link={state.link} name={name} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={staffId} />
      <p className="text-sm text-gray-600">
        Create a link only when {name} is ready to use it. It expires in about an hour, and
        anyone holding it can set up this account.
      </p>
      <FormMessage state={state} />
      <SubmitButton>Create link</SubmitButton>
    </form>
  );
}

export function InviteLinkButton({ staffId, name }: { staffId: string; name: string }) {
  return (
    <Modal
      label="Create invite link"
      ariaLabel={`Create invite link for ${name}`}
      title={`Invite ${name}`}
      buttonClassName="font-medium text-indigo-600 hover:text-indigo-800"
    >
      {() => <CreateLinkForm staffId={staffId} name={name} />}
    </Modal>
  );
}
