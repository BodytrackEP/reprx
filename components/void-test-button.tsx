"use client";

import { useActionState, useEffect } from "react";
import { voidResult } from "@/app/admin/rm-testing/actions";
import { Field, FormMessage, SubmitButton } from "./form";
import { Modal } from "./modal";

function VoidForm({ resultId, onDone }: { resultId: number; onDone: () => void }) {
  const [state, action] = useActionState(voidResult, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={resultId} />
      <p className="text-sm text-gray-600">
        Voided results stay in the session but no longer count towards weights or trends. To
        correct a mistake, void it and record the exercise again in the same session.
      </p>
      <Field label="Reason" name="reason" maxLength={200} required />
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Void result</SubmitButton>
      </div>
    </form>
  );
}

export function VoidResultButton({ resultId, label }: { resultId: number; label: string }) {
  return (
    <Modal
      label="Void"
      ariaLabel={`Void ${label}`}
      title={`Void ${label}`}
      buttonClassName="text-sm text-gray-500 hover:text-red-700"
    >
      {(close) => <VoidForm resultId={resultId} onDone={close} />}
    </Modal>
  );
}
