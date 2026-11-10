"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal, primaryButton, secondaryButton } from "@/components/modal";
import { createProgram, duplicateProgram } from "./actions";

export function NewProgramButton() {
  const [state, action] = useActionState(createProgram, {});

  return (
    <Modal label="+ New Program" title="New Program" buttonClassName={primaryButton}>
      {() => (
        <form action={action} className="space-y-4">
          <Field label="Program name" name="name" required maxLength={100} />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton>Create program</SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function DuplicateProgramButton({ id, name }: { id: number; name: string }) {
  const [state, action] = useActionState(duplicateProgram, {});

  return (
    <Modal label="Duplicate" title={`Duplicate ${name}`} buttonClassName={secondaryButton}>
      {() => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field
            label="New program name"
            name="name"
            defaultValue={`${name} (copy)`}
            required
            maxLength={100}
          />
          <p className="text-sm text-gray-600">
            The copy gets its own code and starts at version 1. It isn&apos;t assigned to any
            class.
          </p>
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton>Duplicate</SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
