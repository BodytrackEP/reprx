import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { DAY_NAMES, DAY_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isCurrent } from "@/lib/programs";
import { formatTime, todayIso } from "@/lib/time";
import { NewClassButton } from "./class-form";

const filterClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default async function ClassesPage({ searchParams }: PageProps<"/admin/classes">) {
  await requireStaff();
  const { category, day, inactive } = await searchParams;

  const supabase = await createClient();
  const { data: categories, error: categoryError } = await supabase
    .from("class_categories")
    .select("code, label, colour")
    .order("sort_order");
  if (categoryError) throw new Error("Could not load categories.");

  let query = supabase
    .from("classes")
    .select("*, class_program_assignments(start_date, end_date), class_members(clients(deleted_at))")
    .order("day_of_week")
    .order("start_time");
  if (typeof category === "string" && category) query = query.eq("category_code", category);
  if (typeof day === "string" && day) query = query.eq("day_of_week", Number(day));
  if (inactive !== "on") query = query.eq("is_active", true);

  const { data: classes, error } = await query;
  if (error) throw new Error("Could not load classes.");

  const today = todayIso();
  const categoryOf = new Map(categories.map((item) => [item.code, item]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <NewClassButton categories={categories} />
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-3">
        <select
          name="category"
          aria-label="Category"
          defaultValue={typeof category === "string" ? category : ""}
          className={filterClass}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          name="day"
          aria-label="Day"
          defaultValue={typeof day === "string" ? day : ""}
          className={filterClass}
        >
          <option value="">All days</option>
          {DAY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {DAY_NAMES[option]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="inactive" defaultChecked={inactive === "on"} />
          Show inactive
        </label>
        <button type="submit" className={`${filterClass} font-medium text-gray-700 hover:bg-gray-50`}>
          Filter
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((item) => {
          const cat = categoryOf.get(item.category_code);
          const members = item.class_members.filter(
            (member) => !member.clients.deleted_at,
          ).length;
          return (
            <Link
              key={item.id}
              href={`/admin/classes/${item.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300"
            >
              <div className="mb-3 flex items-center justify-between">
                {cat && <CategoryBadge label={cat.label} colour={cat.colour} />}
                <span className="text-sm text-gray-500">{DAY_NAMES[item.day_of_week]}</span>
              </div>
              <h2 className="font-semibold text-gray-900">{item.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {formatTime(item.start_time)} – {formatTime(item.end_time)}
                {item.location && ` · ${item.location}`}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {members}
                  {item.max_capacity && `/${item.max_capacity}`} clients
                  {!item.is_active && " · Inactive"}
                </span>
                {item.class_program_assignments.some((assignment) => isCurrent(assignment, today)) ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Program set
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    No program
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        {classes.length === 0 && (
          <p className="text-gray-500 sm:col-span-2 lg:col-span-3">
            No classes match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
