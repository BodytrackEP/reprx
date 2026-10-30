"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Field } from "@/components/form";
import { Modal, linkButton, primaryButton } from "@/components/modal";
import { addMembers, moveMembers, removeMember } from "./actions";

export type Member = {
  id: number;
  name: string;
  tested: number;
  testable: number;
};

type Option = { id: number; name: string };

const actionButton = "text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50";

function MoveControl({
  label,
  targets,
  disabled,
  onMove,
}: {
  label: string;
  targets: Option[];
  disabled: boolean;
  onMove: (classId: number) => void;
}) {
  const [target, setTarget] = useState("");

  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label={label}
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className="max-w-44 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        <option value="">Move to class…</option>
        {targets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={actionButton}
        disabled={disabled || !target}
        onClick={() => onMove(Number(target))}
      >
        Move
      </button>
    </span>
  );
}

function AddMembersButton({
  candidates,
  disabled,
  onAdd,
}: {
  candidates: Option[];
  disabled: boolean;
  onAdd: (clientIds: number[]) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const matches = candidates.filter((client) =>
    client.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Modal label="+ Add Members" title="Add Members" buttonClassName={linkButton}>
      {(close) => (
        <div className="space-y-3">
          <Field
            label="Search clients"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <fieldset className="max-h-64 space-y-2 overflow-y-auto">
            <legend className="sr-only">Clients to add</legend>
            {matches.map((client) => (
              <label key={client.id} className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={selected.has(client.id)}
                  onChange={() => toggle(client.id)}
                />
                {client.name}
              </label>
            ))}
            {matches.length === 0 && <p className="text-sm text-gray-500">No matching clients.</p>}
          </fieldset>
          <div className="flex justify-end">
            <button
              type="button"
              className={`${primaryButton} disabled:opacity-50`}
              disabled={disabled || selected.size === 0}
              onClick={async () => {
                if (await onAdd([...selected])) {
                  setSelected(new Set());
                  setQuery("");
                  close();
                }
              }}
            >
              Add {selected.size || ""} to class
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function MembersPanel({
  classId,
  members,
  capacity,
  candidates,
  otherClasses,
  isAdmin,
}: {
  classId: number;
  members: Member[];
  capacity: number | null;
  candidates: Option[];
  otherClasses: Option[];
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allowOver, setAllowOver] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ error?: string }>) =>
    new Promise<boolean>((resolve) => {
      setError(undefined);
      startTransition(async () => {
        const result = await work();
        if (result.error) setError(result.error);
        resolve(!result.error);
      });
    });

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const moveSelected = async (toClass: number) => {
    const moved = await run(() => moveMembers(classId, toClass, [...selected], allowOver));
    if (moved) setSelected(new Set());
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Members ({members.length}
          {capacity && `/${capacity}`})
        </h2>
        <AddMembersButton
          candidates={candidates}
          disabled={pending}
          onAdd={(clientIds) => run(() => addMembers(classId, clientIds, allowOver))}
        />
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-4">
        {selected.size > 0 && (
          <span className="flex items-center gap-3 text-sm text-gray-700">
            {selected.size} selected
            <MoveControl
              label="Move selected clients to class"
              targets={otherClasses}
              disabled={pending}
              onMove={moveSelected}
            />
          </span>
        )}
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">RM Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${member.name}`}
                    checked={selected.has(member.id)}
                    onChange={() => toggle(member.id)}
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={`/admin/clients/${member.id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {member.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {member.testable === 0 ? (
                    <span className="text-xs text-gray-500">No program</span>
                  ) : member.tested === member.testable ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      All tested
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {member.tested}/{member.testable} tested
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href={`/admin/clients/${member.id}/program/${classId}`}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      View Program
                    </Link>
                    <MoveControl
                      label={`Move ${member.name} to class`}
                      targets={otherClasses}
                      disabled={pending}
                      onMove={(toClass) =>
                        run(() => moveMembers(classId, toClass, [member.id], allowOver))
                      }
                    />
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${member.name} from class`}
                      className="text-sm text-gray-500 hover:text-red-700 disabled:opacity-50"
                      onClick={() => run(() => removeMember(classId, member.id))}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
