import { formatDate } from "@/lib/time";
import { VoidTestButton } from "./void-test-button";

export type RmHistoryRow = {
  id: number;
  test_date: string;
  reps: number;
  weight_kg: number;
  estimated_1rm_kg: number | null;
  notes: string | null;
  voided_at: string | null;
  voided_reason: string | null;
  exercises: { name: string };
};

export function RmHistory({ tests }: { tests: RmHistoryRow[] }) {
  if (tests.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">No RM tests recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Exercise</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Result</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Est. 1RM</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {tests.map((test) => (
            <tr key={test.id} className={test.voided_at ? "bg-gray-50" : "hover:bg-gray-50"}>
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(test.test_date)}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {test.exercises.name}
                {test.notes && (
                  <span className="block text-xs font-normal text-gray-500">{test.notes}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <span className={test.voided_at ? "line-through" : ""}>
                  {test.reps} × {test.weight_kg} kg
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                <span className={test.voided_at ? "font-normal line-through" : ""}>
                  {test.estimated_1rm_kg} kg
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm">
                {test.voided_at ? (
                  <span className="text-xs text-gray-500">Voided: {test.voided_reason}</span>
                ) : (
                  <VoidTestButton
                    testId={test.id}
                    label={`${test.exercises.name} (${formatDate(test.test_date)})`}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
