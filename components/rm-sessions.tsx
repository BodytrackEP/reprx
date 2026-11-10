import Link from "next/link";
import type { RmSession } from "@/lib/rm-data";
import { formatDate } from "@/lib/time";
import { VoidResultButton } from "./void-test-button";

/** Testing sessions, newest first, each with its results. Voided results stay visible. */
export function RmSessions({
  sessions,
  clientId,
  selectedId,
  linkSessions,
}: {
  sessions: RmSession[];
  clientId: number;
  selectedId?: number;
  linkSessions?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">No testing sessions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <section
          key={session.id}
          data-testid="rm-session"
          className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
            session.id === selectedId ? "border-indigo-400" : "border-gray-200"
          }`}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {linkSessions ? (
                <Link href={`/admin/rm-testing?client=${clientId}&session=${session.id}`}
                  className="text-indigo-700 hover:text-indigo-900">
                  Session {session.session_no}
                </Link>
              ) : (
                <>Session {session.session_no}</>
              )}
              <span className="ml-2 font-normal text-gray-500">{formatDate(session.test_date)}</span>
            </h3>
            <span className="text-xs text-gray-500">
              {session.staff ? `Run by ${session.staff.display_name}` : "Imported"}
            </span>
            {session.notes && <p className="w-full text-xs text-gray-600">{session.notes}</p>}
          </header>
          {session.rm_results.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-100">
              <tbody className="divide-y divide-gray-100">
                {[...session.rm_results]
                  .sort((a, b) => a.exercises.name.localeCompare(b.exercises.name) || a.id - b.id)
                  .map((result) => (
                    <tr key={result.id} className={result.voided_at ? "bg-gray-50" : undefined}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {result.exercises.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        <span className={result.voided_at ? "line-through" : ""}>
                          {result.reps} × {result.weight_kg} kg
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                        <span className={result.voided_at ? "font-normal line-through" : ""}>
                          {result.estimated_1rm_kg} kg
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        {result.voided_at ? (
                          <span className="text-xs text-gray-500">Voided: {result.voided_reason}</span>
                        ) : (
                          <VoidResultButton
                            resultId={result.id}
                            label={`${result.exercises.name}, session ${session.session_no}`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-500">No results recorded yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
