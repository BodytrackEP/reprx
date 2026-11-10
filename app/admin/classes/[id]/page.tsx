import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { loadClassProgram } from "@/lib/class-program";
import { byName, clientName } from "@/lib/clients";
import { DAY_NAMES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import { idSchema } from "@/lib/validation/catalog";
import { EditClassButton } from "../class-form";
import { type Member, MembersPanel } from "./members-panel";
import { ProgramPanel } from "./program-panel";

const buttonClass =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

export default async function ClassDetailPage({ params }: PageProps<"/admin/classes/[id]">) {
  const staff = await requireStaff();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const classId = id.data;

  const supabase = await createClient();
  const [
    { data: classRow },
    program,
    { data: programs },
    { data: categories, error },
    { data: clients },
    { data: otherClasses },
    { data: weights },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*, class_categories(label, colour)")
      .eq("id", classId)
      .maybeSingle(),
    loadClassProgram(supabase, classId),
    supabase
      .from("library_programs")
      .select("id, code, name")
      .eq("status", "active")
      .order("code"),
    supabase.from("class_categories").select("code, label").order("sort_order"),
    supabase
      .from("clients")
      .select("id, first_name, last_name, preferred_name, class_members(class_id)")
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .neq("id", classId)
      .order("name"),
    supabase.rpc("effective_weights", { p_class_id: classId }),
  ]);

  if (!classRow) notFound();
  if (error) throw new Error("Could not load categories.");

  const { data: memberRows } = await supabase
    .from("class_members")
    .select("clients(id, first_name, last_name, preferred_name, deleted_at)")
    .eq("class_id", classId);

  const needsTest = (weights ?? []).filter((weight) => weight.rm_percentage !== null);
  const members: Member[] = (memberRows ?? [])
    .map((row) => row.clients)
    .filter((client) => !client.deleted_at)
    .sort(byName)
    .map((client) => {
      const own = needsTest.filter((weight) => weight.client_id === client.id);
      return {
        id: client.id,
        name: clientName(client),
        testable: own.length,
        tested: own.filter((weight) => weight.latest_1rm_kg !== null).length,
      };
    });

  const candidates = (clients ?? [])
    .filter((client) => !client.class_members.some((row) => row.class_id === classId))
    .sort(byName)
    .map((client) => ({ id: client.id, name: clientName(client) }));

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/classes" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; All Classes
        </Link>
      </div>

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{classRow.name}</h1>
            <CategoryBadge
              label={classRow.class_categories.label}
              colour={classRow.class_categories.colour}
            />
            {!classRow.is_active && (
              <span className="text-sm text-gray-500">Inactive</span>
            )}
          </div>
          <p className="text-gray-500">
            {DAY_NAMES[classRow.day_of_week]} {formatTime(classRow.start_time)} –{" "}
            {formatTime(classRow.end_time)}
            {classRow.location && ` · ${classRow.location}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/sessions/${classId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Open Session View
          </Link>
          <Link href={`/admin/classes/${classId}/program`} className={buttonClass}>
            {program.current ? "Edit Class Program" : "Class Program"}
          </Link>
          <EditClassButton categories={categories} current={classRow} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MembersPanel
            classId={classId}
            members={members}
            capacity={classRow.max_capacity}
            candidates={candidates}
            otherClasses={otherClasses ?? []}
            isAdmin={staff.isAdmin}
          />
        </div>

        <ProgramPanel
          classId={classId}
          assignments={program.assignments}
          current={program.current}
          items={program.items}
          programs={programs ?? []}
          today={program.today}
        />
      </div>
    </div>
  );
}
