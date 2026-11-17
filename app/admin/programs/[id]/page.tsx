import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramHistory } from "@/components/program-history";
import { requireStaff } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { formatPrescription, isCurrent, toPercent } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, todayIso } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { setArchived } from "../actions";
import { DuplicateProgramButton } from "../program-forms";
import { type EditorRow, ProgramEditor } from "./program-editor";

const text = (value: number | string | null) => (value === null ? "" : String(value));

export default async function ProgramPage({
  params,
  searchParams,
}: PageProps<"/admin/programs/[id]">) {
  await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const programId = id.data;
  const { saved } = await searchParams;

  const supabase = await createClient();
  const [
    { data: program },
    { data: versions },
    { data: assignments },
    { data: exercises },
    { data: history },
  ] = await Promise.all([
      supabase
        .from("library_programs")
        .select("id, code, name, status, current_version_id")
        .eq("id", programId)
        .maybeSingle(),
      supabase
        .from("program_versions")
        .select("id, version_no, created_at, staff(display_name)")
        .eq("program_id", programId)
        .order("version_no", { ascending: false }),
      supabase
        .from("class_program_assignments")
        .select("id, start_date, end_date, classes(id, name)")
        .eq("program_id", programId)
        .order("start_date", { ascending: false }),
      supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment")
        .eq("is_active", true)
        .order("name"),
      supabase.rpc("program_client_history", { p_program_id: programId }),
    ]);
  if (!program) notFound();

  const clientIds = [...new Set((history ?? []).map((row) => row.client_id!))];
  const { data: clients } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id, first_name, last_name, preferred_name")
        .in("id", clientIds)
    : { data: [] };
  const clientNames = new Map((clients ?? []).map((client) => [client.id, clientName(client)]));

  const { data: items, error } = await supabase
    .from("program_version_items")
    .select("*, exercises(name)")
    .eq("version_id", program.current_version_id!)
    .order("position");
  if (error) throw new Error("Could not load the program.");

  const current = versions?.find((version) => version.id === program.current_version_id);
  const archived = program.status === "archived";
  const today = todayIso();

  const rows: EditorRow[] = items.map((item) => ({
    uid: item.item_key,
    itemKey: item.item_key,
    exerciseId: item.exercise_id,
    exerciseName: item.exercises.name,
    sets: String(item.sets),
    reps: item.reps,
    rmPercent: item.rm_percentage === null ? "" : String(toPercent(item.rm_percentage)),
    fallbackKg: text(item.fallback_weight_kg),
    restSeconds: text(item.rest_seconds),
    notes: item.notes ?? "",
    supersetGroup: item.superset_group ?? undefined,
    colour: item.colour ?? "",
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link href="/admin/programs" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Program Library
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-sm text-gray-500">{program.code}</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {program.name}
            {archived && (
              <span className="ml-3 rounded-full bg-gray-100 px-2.5 py-0.5 align-middle text-xs font-medium text-gray-700">
                Archived
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            Version {current?.version_no}, saved {current && formatDateTime(current.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DuplicateProgramButton id={program.id} name={program.name} />
          <form action={setArchived}>
            <input type="hidden" name="id" value={program.id} />
            <input type="hidden" name="archived" value={String(!archived)} />
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {archived ? "Unarchive" : "Archive"}
            </button>
          </form>
        </div>
      </div>

      {archived ? (
        <div className="space-y-2">
          <p className="mb-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
            Archived programs can&apos;t be edited or assigned. Unarchive it to make changes.
          </p>
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <span className="font-medium text-gray-900">{item.exercises.name}</span>{" "}
              <span className="text-gray-500">
                {formatPrescription(item.sets, item.reps, item.rm_percentage)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ProgramEditor
          key={program.current_version_id}
          programId={program.id}
          initialName={program.name}
          initialRows={rows}
          exercises={exercises ?? []}
          notice={typeof saved === "string" ? saved.slice(0, 200) : undefined}
        />
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Clients who&apos;ve done this program</h2>
        <ProgramHistory rows={history ?? []} clientNames={clientNames} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Classes</h2>
          {assignments && assignments.length > 0 ? (
            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <Link
                    href={`/admin/classes/${assignment.classes.id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {assignment.classes.name}
                  </Link>
                  <span className="text-gray-500">
                    {formatDate(assignment.start_date)} –{" "}
                    {assignment.end_date ? formatDate(assignment.end_date) : "ongoing"}
                    {isCurrent(assignment, today) && " · current"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Not assigned to any class.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Versions</h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {versions?.map((version) => (
              <li key={version.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <span className="font-medium text-gray-900">Version {version.version_no}</span>
                <span className="text-gray-500">
                  {formatDateTime(version.created_at)}
                  {version.staff ? ` · ${version.staff.display_name}` : " · migrated"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
