"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-gray-300 px-4 py-2 text-xl font-medium text-gray-700 hover:bg-gray-50 print:hidden"
    >
      Print
    </button>
  );
}
