import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { MAX_IMPORT_ROWS } from "@/lib/client-import";
import { ImportForm } from "./import-form";

export default async function ImportClientsPage() {
  await requireStaff();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/clients" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Clients
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Import Clients</h1>
      <div className="mb-6 mt-2 space-y-2 text-sm text-gray-600">
        <p>
          Upload a CSV file with a header row. RepRx reads these columns, in any order:{" "}
          <strong>First name</strong> and <strong>Last name</strong> (required),{" "}
          <strong>Preferred name</strong> and <strong>Class</strong> (optional). &ldquo;Surname&rdquo;
          and &ldquo;Given name&rdquo; also work.
        </p>
        <p>
          The class must match a class name exactly (capitals don&apos;t matter). Put a client in
          several classes with one row per class, or separate the names with semicolons. A name
          that matches an existing client adds that client to the class instead of creating a
          duplicate. Any other columns, such as date of birth or phone, are ignored and never
          stored. Up to {MAX_IMPORT_ROWS} rows at a time.
        </p>
        <p>You&apos;ll see a preview before anything is saved.</p>
      </div>
      <ImportForm />
    </div>
  );
}
