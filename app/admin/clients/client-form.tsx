"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal, primaryButton, secondaryButton } from "@/components/modal";
import { saveClient } from "./actions";

type ClientNames = {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

function ClientForm({ client, onDone }: { client?: ClientNames; onDone: () => void }) {
  const [state, action] = useActionState(saveClient, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" name="firstName" defaultValue={client?.first_name} required />
        <Field label="Last name" name="lastName" defaultValue={client?.last_name} required />
      </div>
      <Field
        label="Preferred name (optional)"
        name="preferredName"
        defaultValue={client?.preferred_name ?? ""}
      />
      <p className="text-xs text-gray-500">
        RepRx stores names only. Contact and clinical details belong in Cliniko.
      </p>
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end pt-2">
        <SubmitButton>{client ? "Save client" : "Create client"}</SubmitButton>
      </div>
    </form>
  );
}

export function NewClientButton() {
  return (
    <Modal label="+ New Client" title="New Client" buttonClassName={primaryButton}>
      {(close) => <ClientForm onDone={close} />}
    </Modal>
  );
}

export function EditClientButton({ client }: { client: ClientNames }) {
  return (
    <Modal label="Edit" title="Edit Client" buttonClassName={secondaryButton}>
      {(close) => <ClientForm client={client} onDone={close} />}
    </Modal>
  );
}
