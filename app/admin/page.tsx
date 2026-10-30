import { requireStaff } from "@/lib/auth";

export default async function DashboardPage() {
  const staff = await requireStaff();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-500">Welcome back, {staff.display_name}</p>
    </div>
  );
}
