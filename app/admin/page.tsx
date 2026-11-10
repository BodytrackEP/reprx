import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, todayDayOfWeek, todayIso } from "@/lib/time";

export default async function DashboardPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  const [{ data: classes }, { data: reviews }] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, name, start_time, end_time, location, max_capacity, class_categories(label, colour), class_members(clients(deleted_at))",
      )
      .eq("day_of_week", todayDayOfWeek())
      .eq("is_active", true)
      .order("start_time"),
    supabase
      .from("weight_overrides")
      .select("id, client_id, review_date, note, clients(first_name, last_name), exercises(name)")
      .is("ended_at", null)
      .lte("review_date", todayIso())
      .order("review_date"),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">Welcome back, {staff.display_name}</p>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Today&apos;s Classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes?.map((item) => {
            const members = item.class_members.filter(
              (member) => !member.clients.deleted_at,
            ).length;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <CategoryBadge
                    label={item.class_categories.label}
                    colour={item.class_categories.colour}
                  />
                  <span className="text-sm text-gray-500">
                    {formatTime(item.start_time)} – {formatTime(item.end_time)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">
                  <Link href={`/admin/classes/${item.id}`} className="hover:text-indigo-700">
                    {item.name}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {item.location && `${item.location} · `}
                  {members}
                  {item.max_capacity && `/${item.max_capacity}`} clients
                </p>
                <Link
                  href={`/admin/sessions/${item.id}`}
                  className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Session View &rarr;
                </Link>
              </div>
            );
          })}
          {classes?.length === 0 && (
            <p className="text-gray-500 sm:col-span-2 lg:col-span-3">
              No classes scheduled for today.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Overrides Due for Review</h2>
        {reviews && reviews.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Exercise</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Note</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Review date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td className="px-6 py-3 text-sm">
                      <Link
                        href={`/admin/clients/${review.client_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {review.clients.first_name} {review.clients.last_name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{review.exercises.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{review.note ?? "—"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {review.review_date && formatDate(review.review_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No overrides are due for review.</p>
        )}
      </div>
    </div>
  );
}
