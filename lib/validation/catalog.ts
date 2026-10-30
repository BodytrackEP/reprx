import { z } from "zod";

const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(blankToUndefined, z.coerce.number().pipe(schema).optional());

export const idSchema = z.coerce.number().int().positive();

export const exerciseSchema = z.object({
  id: z.preprocess(blankToUndefined, idSchema.optional()),
  name: z.string().trim().min(1, "Enter a name.").max(100),
  muscleGroup: optionalText(50),
  equipment: optionalText(50),
  description: optionalText(2000),
  videoUrl: z.preprocess(
    blankToUndefined,
    z.url({ protocol: /^https?$/, error: "Enter a full web address." }).optional(),
  ),
});

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a time.");

export const classSchema = z
  .object({
    id: z.preprocess(blankToUndefined, idSchema.optional()),
    name: z.string().trim().min(1, "Enter a class name.").max(100),
    categoryCode: z.string().min(1),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    location: optionalText(100),
    maxCapacity: optionalNumber(
      z.number().int("Capacity must be a whole number.").positive("Capacity must be above zero."),
    ),
    isActive: z.literal("on").optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "The end time must be after the start time.",
  });

export const programExerciseSchema = z.object({
  id: idSchema,
  classId: idSchema,
  sets: z.coerce.number().int().min(1, "Sets must be 1 to 20.").max(20, "Sets must be 1 to 20."),
  reps: z.coerce.number().int().min(1, "Reps must be 1 to 100.").max(100, "Reps must be 1 to 100."),
  // Staff enter a percentage; the database stores a fraction.
  rmPercent: optionalNumber(
    z.number().positive("% 1RM must be above 0.").max(120, "% 1RM can't exceed 120."),
  ),
  fallbackKg: optionalNumber(z.number().min(0, "Weight can't be negative.").max(9999)),
  restSeconds: optionalNumber(z.number().int().min(0, "Rest can't be negative.")),
  notes: optionalText(200),
});

export const programNameSchema = z.object({
  id: idSchema,
  classId: idSchema,
  name: z.string().trim().min(1, "Enter a program name.").max(100),
});
