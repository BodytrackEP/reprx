import { z } from "zod";

const whole = (label: string, min: number) =>
  z.coerce
    .number()
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`);

export const settingsSchema = z.object({
  staffSessionTimeoutHours: whole("Staff session timeout", 1),
  clientSessionTimeoutDays: whole("Client session timeout", 1),
  softDeleteRestoreDays: whole("Restore window", 0),
  retentionYears: whole("Retention period", 1),
  roundingIncrementKg: z.coerce
    .number()
    .positive("The rounding increment must be above zero.")
    .max(99),
  rmWarnAboveReps: whole("Rep warning", 1).max(10, "Rep warning must be 10 or less."),
});
