import { z } from "zod";
import { colourSchema } from "../colours";
import { idSchema, optionalNumber } from "./catalog";

const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

export const repsSchema = z
  .string()
  .trim()
  .min(1, "Enter the reps.")
  .max(20, "Reps can be at most 20 characters.");

const prescription = {
  sets: z.coerce.number().int().min(1, "Sets must be 1 to 20.").max(20, "Sets must be 1 to 20."),
  reps: repsSchema,
  rmPercent: optionalNumber(
    z.number().positive("% 1RM must be above 0.").max(120, "% 1RM can't exceed 120."),
  ),
  fallbackKg: optionalNumber(z.number().min(0, "Weight can't be negative.").max(9999)),
  restSeconds: optionalNumber(z.number().int().min(0, "Rest can't be negative.")),
  notes: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  colour: colourSchema,
};

export const programItemSchema = z.object({
  itemKey: z.preprocess(blankToUndefined, z.uuid().optional()),
  exerciseId: idSchema,
  supersetGroup: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  ...prescription,
});

export type ProgramItemInput = z.input<typeof programItemSchema>;

export const saveProgramSchema = z.object({
  programId: idSchema,
  name: z.string().trim().min(1, "Enter a program name.").max(100),
  items: z.array(programItemSchema).max(60),
});

export const classItemSchema = z.object({
  id: idSchema,
  classId: idSchema,
  ...prescription,
});

/** Sets, reps and % only, as changed from the session view. */
export const classPrescriptionSchema = z.object({
  id: idSchema,
  classId: idSchema,
  sets: prescription.sets,
  reps: prescription.reps,
  rmPercent: prescription.rmPercent,
});

export const assignSchema = z
  .object({
    classId: idSchema,
    programId: idSchema,
    startDate: z.iso.date("Enter a start date."),
    endDate: z.preprocess(blankToUndefined, z.iso.date().optional()),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: "The end date can't be before the start date.",
  });

export const endAssignmentSchema = z.object({
  id: idSchema,
  classId: idSchema,
  endDate: z.iso.date("Enter an end date."),
});
