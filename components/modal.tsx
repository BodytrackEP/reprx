"use client";

import { useState } from "react";

export const primaryButton =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700";
export const secondaryButton =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";
export const linkButton = "text-sm font-medium text-indigo-600 hover:text-indigo-800";

/** Native <dialog>: focus trapping, Esc to close and the backdrop come with it. */
export function Modal({
  label,
  title,
  buttonClassName = primaryButton,
  children,
}: {
  label: string;
  title: string;
  buttonClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const close = () => dialog?.close();

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => dialog?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={setDialog}
        aria-label={title}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-xl text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>
        {children(close)}
      </dialog>
    </>
  );
}
