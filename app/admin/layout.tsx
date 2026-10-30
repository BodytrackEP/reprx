import Link from "next/link";
import { AdminNavLinks } from "@/components/admin-nav";
import { requireStaff } from "@/lib/auth";
import { signOut } from "../(auth)/login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  const initials = staff.display_name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/admin" className="text-xl font-bold text-gray-900">
              Rep<span className="text-indigo-600">Rx</span>
            </Link>
            <AdminNavLinks isAdmin={staff.isAdmin} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white"
            >
              {initials}
            </div>
            <span className="hidden text-sm text-gray-600 lg:inline">
              {staff.display_name}
            </span>
            <form action={signOut}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
        {children}
      </main>
    </>
  );
}
