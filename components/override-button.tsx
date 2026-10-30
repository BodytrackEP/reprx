"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { endOverride, setOverride } from "@/app/admin/clients/[id]/program/actions";
import { Field, FormMessage, SubmitButton } from "./form";
import { Modal, linkButton } from "./modal";

export type OverrideTarget = {
  clientId: number;
  clientName: string;
  exerciseId: number;
  exerciseName: string;
  overrideKg: number | null;
  reason: string | null;
  reviewDate: string | null;
  calculatedKg: number | null;
};

function OverrideForm({ target, onDone }: { target: OverrideTarget; onDone: () => void }) {
  const [state, action] = useActionState(setOverride, {});
  const [endError, setEndError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const active = target.overrideKg !== null;

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={target.clientId} />
      <input type="hidden" name="exerciseId" value={target.exerciseId} />
      <p className="text-sm text-gray-600">
        Applies to {target.exerciseName} in every class {target.clientName} attends.
        {target.calculatedKg !== null && ` Calculated weight: ${target.calculatedKg} kg.`}
      </p>
      {active && target.reason && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Current reason: {target.reason}
        </p>
      )}
      <Field
        label="Override weight (kg)"
        name="weightKg"
        type="number"
        min={0}
        step={0.25}
        defaultValue={target.overrideKg ?? ""}
        required
      />
      <Field
        label="Reason"
        name="reason"
        minLength={3}
        maxLength={200}
        defaultValue={target.reason ?? ""}
        hint="Brief training reason only (e.g. 'L shoulder rehab – reduce pressing'). Clinical notes belong in Cliniko."
        required
      />
      <Field
        label="Review date (optional)"
        name="reviewDate"
        type="date"
        defaultValue={target.reviewDate ?? ""}
      />
      <FormMessage state={state.error ? state : { error: endError }} />
      <div className="flex items-center justify-between gap-3 pt-2">
        {active ? (
          <button
            type="button"
            disabled={pending}
            className="text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
            onClick={() =>
              startTransition(async () => {
                const result = await endOverride(target.clientId, target.exerciseId);
                if (result.error) setEndError(result.error);
                else onDone();
              })
            }
          >
            End override
          </button>
        ) : (
          <span />
        )}
        <SubmitButton>{active ? "Replace override" : "Set override"}</SubmitButton>
      </div>
    </form>
  );
}

export function OverrideButton({
  target,
  label,
  ariaLabel,
  buttonClassName = linkButton,
}: {
  target: OverrideTarget;
  label: React.ReactNode;
  ariaLabel?: string;
  buttonClassName?: string;
}) {
  return (
    <Modal
      label={label}
      ariaLabel={ariaLabel}
      title={`${target.clientName}: ${target.exerciseName}`}
      buttonClassName={buttonClassName}
    >
      {(close) => <OverrideForm target={target} onDone={close} />}
    </Modal>
  );
}
