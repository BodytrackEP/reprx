"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { previewImport, runImport } from "./actions";

const statusStyle = {
  new: "bg-green-50 text-green-800",
  existing: "bg-indigo-50 text-indigo-800",
  error: "bg-red-50 text-red-800",
} as const;
const statusLabel = { new: "New", existing: "Existing", error: "Skipped" } as const;

export function ImportForm() {
  const [preview, previewAction] = useActionState(previewImport, {});
  const [result, importAction] = useActionState(runImport, {});
  const plan = preview.plan;

  if (result.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <p role="status" className="font-medium text-green-800">{result.success}</p>
        <Link href="/admin/clients" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Go to Clients
        </Link>
      </div>
    );
  }

  const counts = plan && {
    created: plan.newClients.length,
    existing: plan.existing.length,
    skipped: plan.rows.filter((row) => row.status === "error").length,
  };

  return (
    <div className="space-y-6">
      <form action={previewAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">CSV file</span>
          <input type="file" name="file" accept=".csv,text/csv" required
            className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
        </label>
        <SubmitButton>Preview</SubmitButton>
        <div className="basis-full">
          <FormMessage state={preview.error ? preview : {}} />
        </div>
      </form>

      {plan && counts && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Preview of {preview.fileName}
          </h2>
          <p data-testid="import-summary" className="text-sm text-gray-700">
            {counts.created} new {counts.created === 1 ? "client" : "clients"} ·{" "}
            {counts.existing} existing {counts.existing === 1 ? "client" : "clients"} added to classes ·{" "}
            {counts.skipped} {counts.skipped === 1 ? "row" : "rows"} skipped
          </p>
          {plan.ignoredColumns.length > 0 && (
            <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
              Ignored, and not stored: {plan.ignoredColumns.join(", ")}. RepRx keeps names only.
            </p>
          )}

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plan.rows.map((row) => (
                  <tr key={row.line} data-testid="import-row">
                    <td className="px-3 py-2 text-gray-500">{row.line}</td>
                    <td className="px-3 py-2 text-gray-900">
                      {row.firstName} {row.lastName}
                      {row.preferredName && (
                        <span className="text-gray-500"> ({row.preferredName})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.classNames.join("; ")}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[row.status]}`}>
                        {statusLabel[row.status]}
                      </span>
                      {row.message && <span className="ml-2 text-gray-600">{row.message}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={importAction} className="flex flex-wrap items-center gap-4">
            <input type="hidden" name="csv" value={preview.csv} />
            <SubmitButton>Import</SubmitButton>
            <span className="text-sm text-gray-600">
              All or nothing: if any class would go over capacity, nothing is imported.
            </span>
            <div className="basis-full">
              <FormMessage state={result.error ? result : {}} />
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
