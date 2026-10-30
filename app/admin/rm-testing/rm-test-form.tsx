"use client";

import { useActionState, useState } from "react";
import { type ExerciseOption, ExercisePicker } from "@/components/exercise-picker";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/auth-types";
import { estimate1Rm } from "@/lib/calc";
import { recordRmTest } from "./actions";

export function RmTestForm({
  clientId,
  exercises,
  initialExercise,
  today,
  warnAboveReps,
}: {
  clientId: number;
  exercises: ExerciseOption[];
  initialExercise?: ExerciseOption;
  today: string;
  warnAboveReps: number;
}) {
  const [exercise, setExercise] = useState(initialExercise);
  const [reps, setReps] = useState("1");
  const [weight, setWeight] = useState("");

  const [state, action] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await recordRmTest(previous, formData);
      if (result.success) {
        // Ready for the next lift.
        setExercise(undefined);
        setReps("1");
        setWeight("");
      }
      return result;
    },
    {},
  );

  const repCount = Number(reps);
  const weightKg = Number(weight);
  const validReps = Number.isInteger(repCount) && repCount >= 1 && repCount <= 10;
  const preview = validReps && weightKg > 0 ? estimate1Rm(weightKg, repCount) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="exerciseId" value={exercise?.id ?? ""} />

      {exercise ? (
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Exercise</span>
          <div className="flex items-center justify-between rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2">
            <span data-testid="selected-exercise" className="text-sm font-medium text-gray-900">
              {exercise.name}
            </span>
            <button
              type="button"
              className="text-sm text-indigo-600 hover:text-indigo-800"
              onClick={() => setExercise(undefined)}
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <ExercisePicker exercises={exercises} onSelect={setExercise} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Reps (1–10)"
          name="reps"
          type="number"
          min={1}
          max={10}
          step={1}
          value={reps}
          onChange={(event) => setReps(event.target.value)}
          required
        />
        <Field
          label="Weight (kg)"
          name="weightKg"
          type="number"
          min={0.25}
          step={0.25}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          required
        />
      </div>

      {preview !== null && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            Estimated 1RM: <span className="font-bold">{preview}</span> kg
          </p>
          <p className="mt-0.5 text-xs text-blue-800">
            {repCount === 1
              ? "A true 1RM: the weight lifted."
              : "Epley: weight × (1 + reps ÷ 30)"}
          </p>
        </div>
      )}

      {validReps && repCount > warnAboveReps && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Estimate less reliable above {warnAboveReps} reps.
        </p>
      )}

      <Field label="Test date" name="testDate" type="date" defaultValue={today} max={today} required />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <FormMessage state={state} />
      <SubmitButton className="w-full">Record Test</SubmitButton>
    </form>
  );
}
