import { EXERCISE_COLOURS } from "@/lib/colours";

/** A plain select, so it works in both controlled editors and uncontrolled forms. */
export function ColourSelect({
  exerciseName,
  ...select
}: { exerciseName: string } & React.ComponentProps<"select">) {
  return (
    <label>
      <span className="block text-center text-[11px] uppercase text-gray-500">Colour</span>
      <select
        aria-label={`Colour for ${exerciseName}`}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        {...select}
      >
        <option value="">None</option>
        {Object.entries(EXERCISE_COLOURS).map(([key, colour]) => (
          <option key={key} value={key}>
            {colour.label}
          </option>
        ))}
      </select>
    </label>
  );
}
