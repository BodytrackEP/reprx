"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { correctSnapshot } from "./actions";

function CorrectForm({
  rowId,
  classId,
  effectiveKg,
  note,
  onDone,
}: {
  rowId: number;
  classId: number;
  effectiveKg: number | null;
  note: string | null;
  onDone: () => void;
}) {
  const [state, action] = useActionState(correctSnapshot, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="classId" value={classId} />
      <p className="text-sm text-gray-600">
        This session is locked. Correct it only to fix a recording error; the change is
        audited with the old and new values.
      </p>
      <Field label="Weight (kg)" name="effectiveKg" type="number" min={0} step={0.25}
        defaultValue={effectiveKg ?? ""} required />
      <Field label="Note (optional)" name="note" maxLength={200} defaultValue={note ?? ""}
        hint="Describe the exercise change only. No clinical details." />
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Save correction</SubmitButton>
      </div>
    </form>
  );
}

/** The whole cell is the button, as on a live session. */
export function CorrectButton(props: {
  rowId: number;
  classId: number;
  effectiveKg: number | null;
  note: string | null;
  title: string;
  label: React.ReactNode;
}) {
  return (
    <Modal
      label={props.label}
      ariaLabel={`Correct ${props.title}`}
      title={`Correct ${props.title}`}
      buttonClassName="h-full w-full px-2 py-2 hover:ring-2 hover:ring-inset hover:ring-indigo-300 print:px-0 print:py-0.5"
    >
      {(close) => <CorrectForm {...props} onDone={close} />}
    </Modal>
  );
}
