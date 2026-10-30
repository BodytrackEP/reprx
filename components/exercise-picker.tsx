"use client";

import { useState, useTransition } from "react";
import { createExerciseInline } from "@/app/admin/exercises/actions";
import { Field, SelectField } from "@/components/form";
import { primaryButton } from "@/components/modal";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/constants";

export type ExerciseOption = {
  id: number;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
};

// Uses buttons rather than a <form>, so it can sit inside another form.
export function ExercisePicker({
  exercises,
  onSelect,
}: {
  exercises: ExerciseOption[];
  onSelect: (exercise: ExerciseOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const matches = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createExerciseInline({ name, muscleGroup, equipment });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setQuery("");
      onSelect(result.exercise);
    });
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <Field
          label="Exercise name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Muscle group"
            value={muscleGroup}
            onChange={(event) => setMuscleGroup(event.target.value)}
          >
            {MUSCLE_GROUPS.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </SelectField>
          <SelectField
            label="Equipment"
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
          >
            {EQUIPMENT.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectField>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className={`${primaryButton} disabled:opacity-50`}
            onClick={create}
          >
            Create exercise
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Field
        label="Search exercises"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {matches.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onSelect(exercise)}
            className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <span className="text-sm font-medium text-gray-900">{exercise.name}</span>
            <span className="ml-2 text-xs text-gray-500">
              {[exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ")}
            </span>
          </button>
        ))}
        {matches.length === 0 && (
          <p className="text-sm text-gray-500">No matching exercises.</p>
        )}
      </div>
      <button
        type="button"
        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        onClick={() => {
          setName(query.trim());
          setCreating(true);
        }}
      >
        + Create new exercise…
      </button>
    </div>
  );
}
