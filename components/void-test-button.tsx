"use client";

import { useActionState, useEffect } from "react";
import { voidRmTest } from "@/app/admin/rm-testing/actions";
import { Field, FormMessage, SubmitButton } from "./form";
import { Modal } from "./modal";

function VoidForm({ testId, onDone }: { testId: number; onDone: () => void }) {
  const [state, action] = useActionState(voidRmTest, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={testId} />
      <p className="text-sm text-gray-600">
        Voided tests stay in the history but no longer affect working weights. To correct
        a mistake, void it and record the right result.
      </p>
      <Field label="Reason" name="reason" maxLength={200} required />
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Void test</SubmitButton>
      </div>
    </form>
  );
}

export function VoidTestButton({ testId, label }: { testId: number; label: string }) {
  return (
    <Modal
      label="Void"
      title={`Void ${label}`}
      buttonClassName="text-sm text-gray-500 hover:text-red-700"
    >
      {(close) => <VoidForm testId={testId} onDone={close} />}
    </Modal>
  );
}
