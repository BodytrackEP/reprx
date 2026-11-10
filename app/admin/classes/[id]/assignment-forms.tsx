"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { Modal, linkButton, primaryButton } from "@/components/modal";
import { assignProgram, endAssignment } from "./program/actions";

function useCloseOnSuccess(state: { success?: string }, close: () => void) {
  useEffect(() => {
    if (state.success) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);
}

function AssignForm({
  classId,
  programs,
  today,
  onDone,
}: {
  classId: number;
  programs: { id: number; code: string; name: string }[];
  today: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(assignProgram, {});
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="classId" value={classId} />
      <SelectField label="Program" name="programId" required defaultValue="">
        <option value="" disabled>
          Choose a program...
        </option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>
            {program.code} {program.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" name="startDate" type="date" defaultValue={today} required />
        <Field label="End date (optional)" name="endDate" type="date" />
      </div>
      <p className="text-xs text-gray-500">
        A class runs one program at a time. To queue next term, end the current program the
        day before the new one starts.
      </p>
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Assign program</SubmitButton>
      </div>
    </form>
  );
}

export function AssignProgramButton(props: {
  classId: number;
  programs: { id: number; code: string; name: string }[];
  today: string;
}) {
  return (
    <Modal label="Assign program" title="Assign Program" buttonClassName={primaryButton}>
      {(close) => <AssignForm {...props} onDone={close} />}
    </Modal>
  );
}

function EndForm({
  id,
  classId,
  defaultDate,
  onDone,
}: {
  id: number;
  classId: number;
  defaultDate: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(endAssignment, {});
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="classId" value={classId} />
      <Field label="Last day" name="endDate" type="date" defaultValue={defaultDate} required />
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end">
        <SubmitButton>Save end date</SubmitButton>
      </div>
    </form>
  );
}

export function EndAssignmentButton(props: {
  id: number;
  classId: number;
  defaultDate: string;
  label: string;
}) {
  return (
    <Modal label={props.label} title="End Program" buttonClassName={linkButton}>
      {(close) => <EndForm {...props} onDone={close} />}
    </Modal>
  );
}
