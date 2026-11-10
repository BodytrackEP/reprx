import Link from "next/link";
import { OverrideButton } from "@/components/override-button";
import { WeightDisplay } from "@/components/weight-display";
import { formatPrescription } from "@/lib/programs";
import { supersetStyles } from "@/lib/supersets";
import { CorrectButton } from "./correct-button";

export type GridCell = {
  clientId: number;
  itemKey: string;
  exerciseId: number;
  exerciseName: string;
  position: number;
  supersetGroup: number | null;
  sets: number;
  reps: string;
  rmPercentage: number | null;
  calculatedKg: number | null;
  overrideKg: number | null;
  effectiveKg: number | null;
  weightSource: string;
  overrideNote: string | null;
  overrideReviewDate: string | null;
  snapshotRowId?: number;
  editedAt?: string | null;
};

export type GridClient = { id: number; fullName: string; shortName: string };

/**
 * Transposed session grid: clients across the top, exercises down the left. Supersets are
 * coloured row groups. Live sessions take overrides; locked ones take admin corrections.
 */
export function SessionGrid({
  classId,
  clients,
  cells,
  today,
  mode,
  canCorrect,
}: {
  classId: number;
  clients: GridClient[];
  cells: GridCell[];
  today: string;
  mode: "live" | "record";
  canCorrect: boolean;
}) {
  const exercises = [...new Map(cells.map((cell) => [cell.itemKey, cell])).values()].sort(
    (a, b) => a.position - b.position,
  );
  const grid = new Map(cells.map((cell) => [`${cell.clientId}:${cell.itemKey}`, cell]));
  const supersets = supersetStyles(exercises.map((exercise) => exercise.supersetGroup));

  return (
    <div className="max-h-[78vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm print:max-h-none print:overflow-visible print:rounded-none print:shadow-none">
      <table className="min-w-full border-separate border-spacing-0 print:w-full print:table-fixed">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 min-w-64 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 print:static print:w-[20%] print:min-w-0 print:px-1 print:py-0.5"
            >
              Exercise
            </th>
            {clients.map((client) => (
              <th
                key={client.id}
                scope="col"
                className="sticky top-0 z-20 min-w-36 border-b border-gray-200 bg-gray-50 px-2 py-3 text-center font-semibold text-gray-700 print:static print:min-w-0 print:break-words print:px-0.5 print:py-0.5 print:text-[7pt] print:leading-tight"
              >
                <Link
                  href={`/admin/clients/${client.id}`}
                  title={client.fullName}
                  className="text-indigo-700 hover:text-indigo-900 print:text-gray-900"
                >
                  {client.shortName}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercises.map((exercise) => {
            const style = exercise.supersetGroup ? supersets.get(exercise.supersetGroup) : undefined;
            return (
              <tr
                key={exercise.itemKey}
                data-superset={exercise.supersetGroup ?? ""}
                className={`break-inside-avoid ${style?.fill ?? ""}`}
              >
                <th
                  scope="row"
                  className={`sticky left-0 z-10 border-b border-r border-gray-200 px-4 py-3 text-left font-medium text-gray-900 print:static print:px-1 print:py-0.5 print:text-[8pt] print:leading-tight ${
                    style ? `border-l-8 ${style.band} ${style.fill}` : "bg-white"
                  }`}
                >
                  {exercise.exerciseName}
                  <span className="block font-normal text-gray-600">
                    {formatPrescription(exercise.sets, exercise.reps, exercise.rmPercentage)}
                  </span>
                </th>
                {clients.map((client) => {
                  const cell = grid.get(`${client.id}:${exercise.itemKey}`);
                  if (!cell) return <td key={client.id} className="border-b border-gray-200" />;
                  const isOverride = cell.weightSource === "override";
                  const display = (
                    <span className="block">
                      <WeightDisplay
                        weight={{
                          effective_kg: cell.effectiveKg,
                          weight_source: cell.weightSource,
                          override_note: cell.overrideNote,
                          override_review_date: cell.overrideReviewDate,
                        }}
                        today={today}
                        weightClassName="text-2xl font-semibold print:text-[9pt] print:leading-tight"
                        labelClassName="text-xl print:text-[6.5pt] print:leading-tight"
                      />
                      {cell.editedAt && (
                        <span className="block text-xl text-indigo-800 print:text-[6.5pt]">Corrected</span>
                      )}
                    </span>
                  );

                  return (
                    <td
                      key={client.id}
                      className={`border-b border-gray-200 p-0 text-center align-top ${
                        isOverride
                          ? "bg-amber-50 ring-2 ring-inset ring-amber-400 print:bg-transparent"
                          : ""
                      }`}
                    >
                      {mode === "live" ? (
                        <OverrideButton
                          ariaLabel={`Override ${exercise.exerciseName} for ${client.fullName}`}
                          buttonClassName="h-full w-full px-2 py-2 hover:ring-2 hover:ring-inset hover:ring-indigo-300 print:px-0 print:py-0.5"
                          label={display}
                          target={{
                            clientId: client.id,
                            clientName: client.fullName,
                            exerciseId: cell.exerciseId,
                            exerciseName: exercise.exerciseName,
                            overrideKg: cell.overrideKg,
                            note: cell.overrideNote,
                            reviewDate: cell.overrideReviewDate,
                            calculatedKg: cell.calculatedKg,
                          }}
                        />
                      ) : canCorrect && cell.snapshotRowId ? (
                        <CorrectButton
                          rowId={cell.snapshotRowId}
                          classId={classId}
                          effectiveKg={cell.effectiveKg}
                          note={cell.overrideNote}
                          title={`${exercise.exerciseName} for ${client.fullName}`}
                          label={display}
                        />
                      ) : (
                        <div
                          aria-label={`${exercise.exerciseName} for ${client.fullName}`}
                          className="px-2 py-2 print:px-0 print:py-0.5"
                        >
                          {display}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
