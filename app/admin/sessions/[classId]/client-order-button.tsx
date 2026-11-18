"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { DragHandle, SortableList } from "@/components/sortable-list";
import { setClientOrder } from "./actions";

export type OrderMember = { id: number; name: string };

const iconButton =
  "rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30";

function OrderForm({
  classId,
  members,
  hiddenIds,
  onDone,
}: {
  classId: number;
  members: OrderMember[];
  hiddenIds: number[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState(members);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const move = (from: number, to: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  const sortByName = () =>
    setRows((current) => [...current].sort((a, b) => a.name.localeCompare(b.name)));

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      // Soft-deleted members aren't shown, but keep a place at the end.
      const result = await setClientOrder(classId, [...rows.map((row) => row.id), ...hiddenIds]);
      if (result.error) setError(result.error);
      else onDone();
    });

  return (
    <div className="space-y-4 text-base">
      <p className="text-sm text-gray-600">
        Drag a client, or focus the handle and use Space and the arrow keys. The order is kept for
        every session of this class, on screen, in print and on take-home sheets. New members go
        at the end.
      </p>
      <div className="max-h-[50vh] overflow-auto pr-1">
        <SortableList items={rows} getId={(row) => String(row.id)} onMove={move}>
          {(row, index, handle) => (
            <div data-testid="order-row"
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <DragHandle label={`Drag ${row.name} to reorder`} handle={handle} />
              <span className="w-6 text-sm text-gray-500">{index + 1}</span>
              <span className="flex-1 text-sm font-medium text-gray-900">{row.name}</span>
              <button type="button" className={iconButton} disabled={index === 0}
                aria-label={`Move ${row.name} up`} onClick={() => move(index, index - 1)}>↑</button>
              <button type="button" className={iconButton} disabled={index === rows.length - 1}
                aria-label={`Move ${row.name} down`} onClick={() => move(index, index + 1)}>↓</button>
            </div>
          )}
        </SortableList>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={sortByName}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Sort A–Z by first name
        </button>
        <button type="button" onClick={save} disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Save order
        </button>
      </div>
    </div>
  );
}

/** Opens the client-order editor for a class. */
export function ClientOrderButton({
  classId,
  members,
  hiddenIds,
  className,
}: {
  classId: number;
  members: OrderMember[];
  hiddenIds: number[];
  className: string;
}) {
  return (
    <Modal label="Client order" title="Client order" buttonClassName={className}>
      {(close) => (
        <OrderForm key={members.map((member) => member.id).join()} classId={classId}
          members={members} hiddenIds={hiddenIds} onDone={close} />
      )}
    </Modal>
  );
}
