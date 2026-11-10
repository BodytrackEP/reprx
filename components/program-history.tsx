import Link from "next/link";
import { formatDate } from "@/lib/time";

export type HistoryRow = {
  enrolment_id: number | null;
  client_id: number | null;
  class_id: number | null;
  class_name: string | null;
  program_id: number | null;
  program_code: string | null;
  program_name: string | null;
  version_id: number | null;
  version_no: number | null;
  from_date: string | null;
  to_date: string | null;
};

/**
 * Enrolment periods against the program version in effect at the time. `clientNames` turns
 * the first column into clients (for a program's history) instead of programs.
 */
export function ProgramHistory({
  rows,
  clientNames,
}: {
  rows: HistoryRow[];
  clientNames?: Map<number, string>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No program history yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {clientNames ? "Client" : "Program"}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Class</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">From</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">To</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={`${row.enrolment_id}:${row.version_id}:${row.from_date}`}>
              <td className="px-4 py-3 text-sm">
                {clientNames ? (
                  <Link href={`/admin/clients/${row.client_id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-800">
                    {clientNames.get(row.client_id!) ?? "Client"}
                  </Link>
                ) : (
                  <Link href={`/admin/programs/${row.program_id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-800">
                    <span className="font-mono text-xs text-gray-500">{row.program_code}</span>{" "}
                    {row.program_name}
                  </Link>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">v{row.version_no}</td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <Link href={`/admin/classes/${row.class_id}`} className="hover:text-indigo-700">
                  {row.class_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {row.from_date && formatDate(row.from_date)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {row.to_date ? formatDate(row.to_date) : "Ongoing"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
