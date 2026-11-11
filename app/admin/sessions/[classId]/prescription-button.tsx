"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { toPercent } from "@/lib/programs";
import { updatePrescription } from "./actions";

type Props = {
  itemId: number;
  classId: number;
  exerciseName: string;
  sets: number;
  reps: string;
  rmPercentage: number | null;
  label: React.ReactNode;
};

function PrescriptionForm({ onDone, ...props }: Omit<Props, "label"> & { onDone: () => void }) {
  const [state, action] = useActionState(updatePrescription, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={props.itemId} />
      <input type="hidden" name="classId" value={props.classId} />
      <p className="text-sm text-gray-600">
        Changes this class&apos;s program from now on, for every client. Past sessions keep
        their recorded values. The row is marked as differing from the library, so later
        library edits leave it alone until you reset it on the class program.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets" name="sets" type="number" min={1} max={20}
          defaultValue={props.sets} required />
        <Field label="Reps" name="reps" maxLength={20} defaultValue={props.reps} required />
        <Field label="% 1RM" name="rmPercent" type="number" min={0} max={120} step={0.5}
          defaultValue={props.rmPercentage === null ? "" : toPercent(props.rmPercentage)} />
      </div>
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

/** The sets × reps @% line under an exercise on a live session, as a button. */
export function PrescriptionButton({ label, ...props }: Props) {
  return (
    <Modal
      label={label}
      ariaLabel={`Change sets and reps for ${props.exerciseName}`}
      title={`${props.exerciseName}: sets and reps`}
      buttonClassName="rounded text-left font-normal text-gray-600 underline decoration-dotted underline-offset-4 hover:text-indigo-700 print:no-underline"
    >
      {(close) => <PrescriptionForm {...props} onDone={close} />}
    </Modal>
  );
}
