import Link from "next/link";
import type { ClassAssignment, ClassProgramItem } from "@/lib/class-program";
import { formatPrescription } from "@/lib/programs";
import { formatDate } from "@/lib/time";
import { AssignProgramButton, EndAssignmentButton } from "./assignment-forms";
import { withdrawAssignment } from "./program/actions";

const dates = (assignment: ClassAssignment) =>
  `${formatDate(assignment.start_date)} – ${
    assignment.end_date ? formatDate(assignment.end_date) : "ongoing"
  }`;

export function ProgramPanel({
  classId,
  assignments,
  current,
  items,
  programs,
  today,
}: {
  classId: number;
  assignments: ClassAssignment[];
  current: ClassAssignment | null;
  items: ClassProgramItem[];
  programs: { id: number; code: string; name: string }[];
  today: string;
}) {
  const queued = assignments.filter((assignment) => assignment.start_date > today);
  const past = assignments.filter(
    (assignment) => assignment.end_date !== null && assignment.end_date < today,
  );
  const visible = items.filter((item) => !item.is_removed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Program</h2>
        <AssignProgramButton classId={classId} programs={programs} today={today} />
      </div>

      {current ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="font-mono text-xs text-gray-500">{current.library_programs.code}</p>
          <h3 className="font-medium text-gray-900">
            <Link href={`/admin/programs/${current.library_programs.id}`} className="hover:text-indigo-700">
              {current.library_programs.name}
            </Link>
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Version {current.library_programs.program_versions?.version_no} · {dates(current)}
          </p>
          <ol className="space-y-2">
            {visible.map((item, index) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <span className="w-5 text-xs font-medium text-gray-500">{index + 1}</span>
                <span className="flex-1">
                  <span className="font-medium text-gray-900">{item.exercises.name}</span>
                  <span className="block text-xs text-gray-500">
                    {formatPrescription(item.sets, item.reps, item.rm_percentage)}
                    {item.is_customised && " · differs from library"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link href={`/admin/classes/${classId}/program`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Edit class program &rarr;
            </Link>
            <EndAssignmentButton id={current.id} classId={classId} defaultDate={today}
              label={current.end_date ? "Change end date" : "End program"} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No program is running for this class today.
        </p>
      )}

      {queued.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Queued</h3>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {queued.map((assignment) => (
              <li key={assignment.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-gray-900">
                  {assignment.library_programs.code} {assignment.library_programs.name}
                </span>
                <span className="block text-xs text-gray-500">{dates(assignment)}</span>
                <span className="mt-1 flex gap-4">
                  <Link href={`/admin/classes/${classId}/program?assignment=${assignment.id}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                    Edit
                  </Link>
                  <form action={withdrawAssignment}>
                    <input type="hidden" name="id" value={assignment.id} />
                    <input type="hidden" name="classId" value={classId} />
                    <button type="submit" className="text-sm text-gray-500 hover:text-red-700">
                      Withdraw
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Previous</h3>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {past.map((assignment) => (
              <li key={assignment.id} className="px-4 py-3 text-sm">
                <span className="text-gray-900">
                  {assignment.library_programs.code} {assignment.library_programs.name}
                </span>
                <span className="block text-xs text-gray-500">{dates(assignment)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
