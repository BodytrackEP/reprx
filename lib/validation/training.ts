import { z } from "zod";
import { idSchema } from "./catalog";

const isoDate = z.iso.date("Enter a date.");

export const rmTestSchema = z.object({
  clientId: idSchema,
  exerciseId: z.coerce
    .number({ error: "Choose an exercise." })
    .int()
    .positive("Choose an exercise."),
  testDate: isoDate,
  reps: z.coerce.number().int("Reps must be a whole number.").min(1, "Reps must be 1 to 10.").max(10, "Reps must be 1 to 10."),
  weightKg: z.coerce.number().positive("Enter the weight lifted.").max(9999.99),
  notes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(200, "Notes are limited to 200 characters.").optional(),
  ),
});

export const voidTestSchema = z.object({
  id: idSchema,
  reason: z
    .string()
    .trim()
    .min(3, "Give a short reason.")
    .max(200, "Reasons are limited to 200 characters."),
});

export const overrideSchema = z.object({
  clientId: idSchema,
  exerciseId: idSchema,
  weightKg: z.coerce.number().min(0, "Weight can't be negative.").max(9999.99),
  reason: z
    .string()
    .trim()
    .min(3, "Give a short training reason.")
    .max(200, "Reasons are limited to 200 characters."),
  reviewDate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    isoDate.optional(),
  ),
});
