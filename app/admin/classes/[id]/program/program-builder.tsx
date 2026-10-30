"use client";

import { useActionState, useState, useTransition } from "react";
import { type ExerciseOption, ExercisePicker } from "@/components/exercise-picker";
import { SubmitButton } from "@/components/form";
import { Modal, primaryButton } from "@/components/modal";
import {
  addProgramExercise,
  moveProgramExercise,
  removeProgramExercise,
  renameProgram,
  updateProgramExercise,
} from "./actions";

export type ProgramRow = {
  id: number;
  exercise_id: number;
  sets: number;
  reps: number;
  rm_percentage: number | null;
  fallback_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { name: string; muscle_group: string | null; equipment: string | null };
};

const smallInput = "w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm";
const smallLabel = "block text-center text-[11px] uppercase text-gray-500";

export function AddExerciseButton({
  classId,
  exercises,
  label = "+ Add Exercise",
}: {
  classId: number;
  exercises: ExerciseOption[];
  label?: string;
}) {
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  return (
    <Modal label={label} title="Add Exercise" buttonClassName={primaryButton}>
      {(close) => (
        <>
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <ExercisePicker
            exercises={exercises}
            onSelect={(exercise) =>
              startTransition(async () => {
                const result = await addProgramExercise(classId, exercise.id);
                if (result.error) setError(result.error);
                else close();
              })
            }
          />
        </>
      )}
    </Modal>
  );
}

export function ProgramName({
  classId,
  programId,
  name,
}: {
  classId: number;
  programId: number;
  name: string;
}) {
  const [state, action] = useActionState(renameProgram, {});

  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={programId} />
      <input type="hidden" name="classId" value={classId} />
      <label className="text-sm font-medium text-gray-700" htmlFor="program-name">
        Program name
      </label>
      <input
        id="program-name"
        name="name"
        defaultValue={name}
        required
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <SubmitButton>Rename</SubmitButton>
      {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}

export function ProgramExerciseRow({
  classId,
  programId,
  row,
  position,
  isFirst,
  isLast,
}: {
  classId: number;
  programId: number;
  row: ProgramRow;
  position: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updateProgramExercise, {});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await work();
      if (result.error) setError(result.error);
    });
  };

  const name = row.exercises.name;
  const iconButton =
    "rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <form action={action}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="classId" value={classId} />
        <div className="flex flex-wrap items-center gap-4">
          <span className="w-6 text-sm font-medium text-gray-500">{position}</span>
          <div className="min-w-40 flex-1">
            <h2 className="text-sm font-semibold text-gray-900">{name}</h2>
            <p className="text-xs text-gray-500">
              {[row.exercises.muscle_group, row.exercises.equipment]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              <span className={smallLabel}>Sets</span>
              <input
                className={smallInput}
                name="sets"
                type="number"
                min={1}
                max={20}
                defaultValue={row.sets}
                required
              />
            </label>
            <label>
              <span className={smallLabel}>Reps</span>
              <input
                className={smallInput}
                name="reps"
                type="number"
                min={1}
                max={100}
                defaultValue={row.reps}
                required
              />
            </label>
            <label>
              <span className={smallLabel}>% 1RM</span>
              <input
                className={smallInput}
                name="rmPercent"
                type="number"
                min={0.1}
                max={120}
                step={0.1}
                placeholder="—"
                defaultValue={
                  row.rm_percentage === null
                    ? ""
                    : Number((row.rm_percentage * 100).toFixed(1))
                }
              />
            </label>
            <label>
              <span className={smallLabel}>Start kg</span>
              <input
                className={smallInput}
                name="fallbackKg"
                type="number"
                min={0}
                step={0.25}
                placeholder="—"
                defaultValue={row.fallback_weight_kg ?? ""}
              />
            </label>
            <label>
              <span className={smallLabel}>Rest (s)</span>
              <input
                className={smallInput}
                name="restSeconds"
                type="number"
                min={0}
                step={15}
                placeholder="—"
                defaultValue={row.rest_seconds ?? ""}
              />
            </label>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              className={iconButton}
              disabled={isFirst || pending}
              aria-label={`Move ${name} up`}
              onClick={() =>
                run(() => moveProgramExercise(classId, programId, row.id, "up"))
              }
            >
              ↑
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={isLast || pending}
              aria-label={`Move ${name} down`}
              onClick={() =>
                run(() => moveProgramExercise(classId, programId, row.id, "down"))
              }
            >
              ↓
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={pending}
              aria-label={`Remove ${name}`}
              onClick={() => run(() => removeProgramExercise(classId, row.id))}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:pl-10">
          <input
            name="notes"
            aria-label={`Notes for ${name}`}
            placeholder="Notes"
            maxLength={200}
            defaultValue={row.notes ?? ""}
            className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <SubmitButton>Save</SubmitButton>
          {state.success && !state.error && (
            <span role="status" className="text-sm text-green-700">
              {state.success}
            </span>
          )}
          {(state.error || error) && (
            <span role="alert" className="text-sm text-red-700">
              {state.error ?? error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
