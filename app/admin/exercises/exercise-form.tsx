"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { Modal, linkButton, primaryButton } from "@/components/modal";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { saveExercise } from "./actions";

function ExerciseForm({
  exercise,
  onDone,
}: {
  exercise?: Tables<"exercises">;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveExercise, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {exercise && <input type="hidden" name="id" value={exercise.id} />}
      <Field label="Exercise name" name="name" defaultValue={exercise?.name} required />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Muscle group"
          name="muscleGroup"
          defaultValue={exercise?.muscle_group ?? ""}
        >
          <option value="">Not set</option>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </SelectField>
        <SelectField
          label="Equipment"
          name="equipment"
          defaultValue={exercise?.equipment ?? ""}
        >
          <option value="">Not set</option>
          {EQUIPMENT.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SelectField>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Description / form cues
        </span>
        <textarea
          name="description"
          rows={3}
          defaultValue={exercise?.description ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <Field
        label="Video URL (optional)"
        name="videoUrl"
        type="url"
        defaultValue={exercise?.video_url ?? ""}
      />
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end pt-2">
        <SubmitButton>{exercise ? "Save exercise" : "Create exercise"}</SubmitButton>
      </div>
    </form>
  );
}

export function NewExerciseButton() {
  return (
    <Modal label="+ New Exercise" title="New Exercise" buttonClassName={primaryButton}>
      {(close) => <ExerciseForm onDone={close} />}
    </Modal>
  );
}

export function EditExerciseButton({ exercise }: { exercise: Tables<"exercises"> }) {
  return (
    <Modal label="Edit" title={`Edit ${exercise.name}`} buttonClassName={linkButton}>
      {(close) => <ExerciseForm exercise={exercise} onDone={close} />}
    </Modal>
  );
}
