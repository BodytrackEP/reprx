"use client";

import { useActionState, useState, useTransition } from "react";
import { type ExerciseOption, ExercisePicker } from "@/components/exercise-picker";
import { SubmitButton } from "@/components/form";
import { Modal, primaryButton } from "@/components/modal";
import { formatPrescription, toPercent } from "@/lib/programs";
import {
  addClassItem,
  moveClassItem,
  removeClassItem,
  resetClassItem,
  updateClassItem,
} from "./actions";

type Row = {
  id: number;
  sets: number;
  reps: string;
  rm_percentage: number | null;
  fallback_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  is_customised: boolean;
  source_version_id: number | null;
  exercises: { name: string; muscle_group: string | null; equipment: string | null };
};

const smallInput = "w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm";
const smallLabel = "block text-center text-[11px] uppercase text-gray-500";
const iconButton =
  "rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30";

function useRowAction() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (work: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await work();
      if (result.error) setError(result.error);
    });
  };
  return { error, pending, run };
}

export function ClassItemRow({
  classId,
  row,
  position,
  isFirst,
  isLast,
}: {
  classId: number;
  row: Row;
  position: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updateClassItem, {});
  const { error, pending, run } = useRowAction();
  const name = row.exercises.name;
  const classOnly = row.source_version_id === null;

  return (
    <form
      action={action}
      data-testid="class-row"
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        row.is_customised ? "border-indigo-300" : "border-gray-200"
      }`}
    >
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="classId" value={classId} />
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-6 text-sm font-medium text-gray-500">{position}</span>
        <div className="min-w-40 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{name}</h2>
          <p className="text-xs text-gray-500">
            {formatPrescription(row.sets, row.reps, row.rm_percentage)}
          </p>
          {row.is_customised && (
            <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
              {classOnly ? "Class only" : "Differs from library"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label>
            <span className={smallLabel}>Sets</span>
            <input className={smallInput} name="sets" type="number" min={1} max={20}
              defaultValue={row.sets} required />
          </label>
          <label>
            <span className={smallLabel}>Reps</span>
            <input className="w-28 rounded border border-gray-300 px-2 py-1 text-center text-sm"
              name="reps" maxLength={20} defaultValue={row.reps} required />
          </label>
          <label>
            <span className={smallLabel}>% 1RM</span>
            <input className={smallInput} name="rmPercent" type="number" min={0.1} max={120}
              step={0.1} placeholder="—"
              defaultValue={row.rm_percentage === null ? "" : toPercent(row.rm_percentage)} />
          </label>
          <label>
            <span className={smallLabel}>Start kg</span>
            <input className={smallInput} name="fallbackKg" type="number" min={0} step={0.25}
              placeholder="—" defaultValue={row.fallback_weight_kg ?? ""} />
          </label>
          <label>
            <span className={smallLabel}>Rest (s)</span>
            <input className={smallInput} name="restSeconds" type="number" min={0} step={15}
              placeholder="—" defaultValue={row.rest_seconds ?? ""} />
          </label>
        </div>
        <div className="flex items-center">
          <button type="button" className={iconButton} disabled={isFirst || pending}
            aria-label={`Move ${name} up`}
            onClick={() => run(() => moveClassItem(classId, row.id, "up"))}>↑</button>
          <button type="button" className={iconButton} disabled={isLast || pending}
            aria-label={`Move ${name} down`}
            onClick={() => run(() => moveClassItem(classId, row.id, "down"))}>↓</button>
          <button type="button" className={iconButton} disabled={pending}
            aria-label={`Remove ${name}`}
            onClick={() => run(() => removeClassItem(classId, row.id))}>✕</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:pl-10">
        <input name="notes" aria-label={`Notes for ${name}`} placeholder="Notes" maxLength={200}
          defaultValue={row.notes ?? ""}
          className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        <SubmitButton>Save</SubmitButton>
        {row.is_customised && !classOnly && (
          <button type="button" disabled={pending}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            onClick={() => run(() => resetClassItem(classId, row.id))}>
            Reset to library
          </button>
        )}
        {state.success && !state.error && (
          <span role="status" className="text-sm text-green-700">{state.success}</span>
        )}
        {(state.error || error) && (
          <span role="alert" className="text-sm text-red-700">{state.error ?? error}</span>
        )}
      </div>
    </form>
  );
}

export function RemovedRow({ classId, id, name }: { classId: number; id: number; name: string }) {
  const { error, pending, run } = useRowAction();
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <span className="text-gray-500 line-through">{name}</span>
      <span>
        {error && <span role="alert" className="mr-3 text-red-700">{error}</span>}
        <button type="button" disabled={pending}
          className="font-medium text-indigo-600 hover:text-indigo-800"
          onClick={() => run(() => resetClassItem(classId, id))}>
          Restore from library
        </button>
      </span>
    </li>
  );
}

export function AddClassExercise({
  classId,
  assignmentId,
  exercises,
}: {
  classId: number;
  assignmentId: number;
  exercises: ExerciseOption[];
}) {
  const { error, run } = useRowAction();
  return (
    <Modal label="+ Add Exercise" title="Add Exercise" buttonClassName={primaryButton}>
      {(close) => (
        <>
          {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
          <p className="mb-3 text-sm text-gray-600">Added rows belong to this class only.</p>
          <ExercisePicker
            exercises={exercises}
            onSelect={(exercise) =>
              run(async () => {
                const result = await addClassItem(classId, assignmentId, exercise.id);
                if (!result.error) close();
                return result;
              })
            }
          />
        </>
      )}
    </Modal>
  );
}
