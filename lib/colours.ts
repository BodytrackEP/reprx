import { z } from "zod";

/**
 * Exercise colours, in the order they're offered. Mid-strength fills that read well with
 * black text and survive printing. Amber stays reserved for overrides.
 */
export const EXERCISE_COLOURS = {
  orange: { label: "Orange", fill: "bg-orange-200", swatch: "bg-orange-300" },
  blue: { label: "Blue", fill: "bg-sky-200", swatch: "bg-sky-300" },
  green: { label: "Green", fill: "bg-lime-200", swatch: "bg-lime-300" },
  pink: { label: "Pink", fill: "bg-rose-200", swatch: "bg-rose-300" },
  purple: { label: "Purple", fill: "bg-violet-200", swatch: "bg-violet-300" },
  yellow: { label: "Yellow", fill: "bg-yellow-200", swatch: "bg-yellow-300" },
  grey: { label: "Grey", fill: "bg-gray-200", swatch: "bg-gray-300" },
} as const;

export type ExerciseColour = keyof typeof EXERCISE_COLOURS;

const keys = Object.keys(EXERCISE_COLOURS) as [ExerciseColour, ...ExerciseColour[]];

/** Blank means no colour. */
export const colourSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.enum(keys, "Choose a colour from the list.").optional(),
);

/** The fill class for a stored colour, or undefined for none (or an unknown value). */
export function colourFill(colour: string | null | undefined) {
  return colour && colour in EXERCISE_COLOURS
    ? EXERCISE_COLOURS[colour as ExerciseColour].fill
    : undefined;
}
