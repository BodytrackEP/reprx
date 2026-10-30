"use client";

import { useState, useTransition } from "react";
import { Modal, linkButton, primaryButton } from "@/components/modal";
import { assignClasses } from "../actions";

export function ClassAssignButton({
  clientId,
  classes,
  memberOf,
  isAdmin,
}: {
  clientId: number;
  classes: { id: number; name: string }[];
  memberOf: number[];
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState(new Set(memberOf));
  const [allowOver, setAllowOver] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Modal label="Change classes" title="Classes" buttonClassName={linkButton}>
      {(close) => (
        <div className="space-y-4">
          <fieldset className="max-h-72 space-y-2 overflow-y-auto">
            <legend className="sr-only">Classes this client attends</legend>
            {classes.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                {item.name}
              </label>
            ))}
          </fieldset>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allowOver}
                onChange={(event) => setAllowOver(event.target.checked)}
              />
              Allow over capacity
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={pending}
              className={`${primaryButton} disabled:opacity-50`}
              onClick={() => {
                setError(undefined);
                startTransition(async () => {
                  const result = await assignClasses(clientId, [...selected], allowOver);
                  if (result.error) setError(result.error);
                  else close();
                });
              }}
            >
              Save classes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
