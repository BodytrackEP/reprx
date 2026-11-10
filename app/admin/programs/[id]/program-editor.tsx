"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type ExerciseOption, ExercisePicker } from "@/components/exercise-picker";
import { Modal, primaryButton } from "@/components/modal";
import { formatPrescription } from "@/lib/programs";
import { saveProgram } from "../actions";

export type EditorRow = {
  uid: string;
  itemKey?: string;
  exerciseId: number;
  exerciseName: string;
  sets: string;
  reps: string;
  rmPercent: string;
  fallbackKg: string;
  restSeconds: string;
  notes: string;
  supersetGroup?: number;
};

const smallInput = "w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm";
const smallLabel = "block text-center text-[11px] uppercase text-gray-500";
const iconButton =
  "rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30";

let counter = 0;
const newUid = () => `new-${++counter}`;

export function ProgramEditor({
  programId,
  initialName,
  initialRows,
  exercises,
  notice,
}: {
  programId: number;
  initialName: string;
  initialRows: EditorRow[];
  exercises: ExerciseOption[];
  notice?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    notice ? { success: notice } : {},
  );
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== initialName || JSON.stringify(rows) !== JSON.stringify(initialRows);

  const update = (uid: string, field: keyof EditorRow, value: string) =>
    setRows((current) =>
      current.map((row) => (row.uid === uid ? { ...row, [field]: value } : row)),
    );

  const move = (index: number, offset: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + offset, 0, row);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setMessage({});
      const result = await saveProgram({
        programId,
        name,
        items: rows.map((row) => ({
          itemKey: row.itemKey,
          exerciseId: row.exerciseId,
          sets: row.sets,
          reps: row.reps,
          rmPercent: row.rmPercent,
          fallbackKg: row.fallbackKg,
          restSeconds: row.restSeconds,
          notes: row.notes,
          supersetGroup: row.supersetGroup,
        })),
      });
      if (result.success) {
        // The editor reloads on the new version, so the message travels in the URL.
        router.replace(
          `/admin/programs/${programId}?saved=${encodeURIComponent(result.success)}`,
          { scroll: false },
        );
      } else {
        setMessage(result);
      }
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Program name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <Modal label="+ Add Exercise" title="Add Exercise" buttonClassName={primaryButton}>
          {(close) => (
            <ExercisePicker
              exercises={exercises}
              onSelect={(exercise) => {
                setRows((current) => [
                  ...current,
                  {
                    uid: newUid(),
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    sets: "3",
                    reps: "10",
                    rmPercent: "70",
                    fallbackKg: "",
                    restSeconds: "60",
                    notes: "",
                  },
                ]);
                close();
              }}
            />
          )}
        </Modal>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.uid}
            data-testid="program-row"
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="w-6 text-sm font-medium text-gray-500">{index + 1}</span>
              <div className="min-w-40 flex-1">
                <h2 className="text-sm font-semibold text-gray-900">{row.exerciseName}</h2>
                <p className="text-xs text-gray-500">
                  {formatPrescription(
                    Number(row.sets) || 0,
                    row.reps,
                    row.rmPercent === "" ? null : Number(row.rmPercent) / 100,
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label>
                  <span className={smallLabel}>Sets</span>
                  <input
                    className={smallInput}
                    type="number"
                    min={1}
                    max={20}
                    value={row.sets}
                    onChange={(event) => update(row.uid, "sets", event.target.value)}
                  />
                </label>
                <label>
                  <span className={smallLabel}>Reps</span>
                  <input
                    className="w-28 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                    maxLength={20}
                    value={row.reps}
                    onChange={(event) => update(row.uid, "reps", event.target.value)}
                  />
                </label>
                <label>
                  <span className={smallLabel}>% 1RM</span>
                  <input
                    className={smallInput}
                    type="number"
                    min={0.1}
                    max={120}
                    step={0.1}
                    placeholder="—"
                    value={row.rmPercent}
                    onChange={(event) => update(row.uid, "rmPercent", event.target.value)}
                  />
                </label>
                <label>
                  <span className={smallLabel}>Start kg</span>
                  <input
                    className={smallInput}
                    type="number"
                    min={0}
                    step={0.25}
                    placeholder="—"
                    value={row.fallbackKg}
                    onChange={(event) => update(row.uid, "fallbackKg", event.target.value)}
                  />
                </label>
                <label>
                  <span className={smallLabel}>Rest (s)</span>
                  <input
                    className={smallInput}
                    type="number"
                    min={0}
                    step={15}
                    placeholder="—"
                    value={row.restSeconds}
                    onChange={(event) => update(row.uid, "restSeconds", event.target.value)}
                  />
                </label>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  aria-label={`Move ${row.exerciseName} up`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === rows.length - 1}
                  aria-label={`Move ${row.exerciseName} down`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Remove ${row.exerciseName}`}
                  onClick={() =>
                    setRows((current) => current.filter((other) => other.uid !== row.uid))
                  }
                >
                  ✕
                </button>
              </div>
            </div>
            <input
              aria-label={`Notes for ${row.exerciseName}`}
              placeholder="Notes"
              maxLength={200}
              value={row.notes}
              onChange={(event) => update(row.uid, "notes", event.target.value)}
              className="mt-3 w-full rounded border border-gray-300 px-2 py-1 text-sm sm:ml-10 sm:w-[calc(100%-2.5rem)]"
            />
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
            No exercises yet. Use + Add Exercise.
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-4 border-t border-gray-200 bg-gray-50 py-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className={`${primaryButton} disabled:opacity-50`}
        >
          Save new version
        </button>
        {dirty && !pending && <span className="text-sm text-amber-800">Unsaved changes</span>}
        {message.error && (
          <span role="alert" className="text-sm text-red-700">
            {message.error}
          </span>
        )}
        {message.success && !dirty && (
          <span role="status" className="text-sm text-green-700">
            {message.success}
          </span>
        )}
      </div>
    </div>
  );
}
