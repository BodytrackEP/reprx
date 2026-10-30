"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { saveSettings } from "./actions";

export function SettingsForm({ settings }: { settings: Tables<"app_settings"> }) {
  const [state, action] = useActionState(saveSettings, {});

  return (
    <form
      action={action}
      className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Staff session timeout (hours)"
          name="staffSessionTimeoutHours"
          type="number"
          min={1}
          defaultValue={settings.staff_session_timeout_hours}
          required
        />
        <Field
          label="Client session timeout (days)"
          name="clientSessionTimeoutDays"
          type="number"
          min={1}
          defaultValue={settings.client_session_timeout_days}
          hint="Used from Phase 3."
          required
        />
        <Field
          label="Soft-delete restore window (days)"
          name="softDeleteRestoreDays"
          type="number"
          min={0}
          defaultValue={settings.soft_delete_restore_days}
          required
        />
        <Field
          label="Retention after last activity (years)"
          name="retentionYears"
          type="number"
          min={1}
          defaultValue={settings.retention_years_after_last_activity}
          hint="Stored for now. No automatic deletion runs yet."
          required
        />
        <Field
          label="Rounding increment (kg)"
          name="roundingIncrementKg"
          type="number"
          min={0.25}
          step={0.25}
          defaultValue={settings.rounding_increment_kg}
          required
        />
        <Field
          label="Warn above reps"
          name="rmWarnAboveReps"
          type="number"
          min={1}
          max={10}
          defaultValue={settings.rm_warn_above_reps}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
