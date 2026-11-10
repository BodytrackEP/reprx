import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { isCurrent } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/time";
import { NewProgramButton } from "./program-forms";

const filterClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default async function ProgramsPage({ searchParams }: PageProps<"/admin/programs">) {
  await requireStaff();
  const { q, archived } = await searchParams;
  const search = typeof q === "string" ? q.trim().toLowerCase() : "";

  const supabase = await createClient();
  let query = supabase
    .from("library_programs")
    .select(
      "id, code, name, status, program_versions!library_programs_current_version_fkey(version_no, created_at, program_version_items(count)), class_program_assignments(start_date, end_date)",
    )
    .order("code");
  if (archived !== "on") query = query.eq("status", "active");

  const { data, error } = await query;
  if (error) throw new Error("Could not load programs.");

  const today = todayIso();
  const programs = data.filter(
    (program) =>
      !search ||
      program.name.toLowerCase().includes(search) ||
      program.code.toLowerCase().includes(search),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Program Library</h1>
        <NewProgramButton />
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          aria-label="Search programs"
          placeholder="Search by name or code..."
          defaultValue={typeof q === "string" ? q : ""}
          className={`${filterClass} w-64`}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="archived" defaultChecked={archived === "on"} />
          Show archived
        </label>
        <button type="submit" className={`${filterClass} font-medium text-gray-700 hover:bg-gray-50`}>
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Exercises</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Classes now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {programs.map((program) => {
              const version = program.program_versions;
              const classesNow = program.class_program_assignments.filter((assignment) =>
                isCurrent(assignment, today),
              ).length;
              return (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-sm text-gray-700">{program.code}</td>
                  <td className="px-6 py-3 text-sm">
                    <Link
                      href={`/admin/programs/${program.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {program.name}
                    </Link>
                    {program.status === "archived" && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">v{version?.version_no}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {version?.program_version_items[0]?.count ?? 0}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{classesNow}</td>
                </tr>
              );
            })}
            {programs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No programs match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Programs are never deleted. Archive one to stop it being assigned; its history stays.
      </p>
    </div>
  );
}
