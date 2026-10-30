"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { Modal, primaryButton, secondaryButton } from "@/components/modal";
import { DAY_NAMES, DAY_OPTIONS } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { formatTime } from "@/lib/time";
import { saveClass } from "./actions";

type Category = Pick<Tables<"class_categories">, "code" | "label">;

function ClassForm({
  categories,
  current,
  onDone,
}: {
  categories: Category[];
  current?: Tables<"classes">;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveClass, {});

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {current && <input type="hidden" name="id" value={current.id} />}
      <Field label="Class name" name="name" defaultValue={current?.name} required />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Category"
          name="categoryCode"
          defaultValue={current?.category_code ?? "GENERAL"}
        >
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Day" name="dayOfWeek" defaultValue={current?.day_of_week ?? 1}>
          {DAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {DAY_NAMES[day]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Start time"
          name="startTime"
          type="time"
          defaultValue={current ? formatTime(current.start_time) : "09:00"}
          required
        />
        <Field
          label="End time"
          name="endTime"
          type="time"
          defaultValue={current ? formatTime(current.end_time) : "10:00"}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location" name="location" defaultValue={current?.location ?? ""} />
        <Field
          label="Max capacity"
          name="maxCapacity"
          type="number"
          min={1}
          defaultValue={current?.max_capacity ?? ""}
        />
      </div>
      {current && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="isActive" defaultChecked={current.is_active} />
          Class is active
        </label>
      )}
      <FormMessage state={state.error ? state : {}} />
      <div className="flex justify-end pt-2">
        <SubmitButton>{current ? "Save class" : "Create class"}</SubmitButton>
      </div>
    </form>
  );
}

export function NewClassButton({ categories }: { categories: Category[] }) {
  return (
    <Modal label="+ New Class" title="New Class" buttonClassName={primaryButton}>
      {(close) => <ClassForm categories={categories} onDone={close} />}
    </Modal>
  );
}

export function EditClassButton({
  categories,
  current,
}: {
  categories: Category[];
  current: Tables<"classes">;
}) {
  return (
    <Modal label="Edit Class" title="Edit Class" buttonClassName={secondaryButton}>
      {(close) => <ClassForm categories={categories} current={current} onDone={close} />}
    </Modal>
  );
}
