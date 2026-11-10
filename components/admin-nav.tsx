"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/programs", label: "Programs" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/exercises", label: "Exercises" },
  { href: "/admin/rm-testing", label: "RM Testing" },
];

const adminLinks = [
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminNavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto">
      {[...links, ...(isAdmin ? adminLinks : [])].map(({ href, label }) => {
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
