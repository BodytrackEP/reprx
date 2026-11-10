"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type DragHandleProps = ReturnType<typeof useSortable>["attributes"] &
  NonNullable<ReturnType<typeof useSortable>["listeners"]>;

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (handle: DragHandleProps) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  // React applies this through the DOM style API, which the CSP permits.
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-80" : undefined}
    >
      {children({ ...attributes, ...listeners } as DragHandleProps)}
    </div>
  );
}

/** Drag with a pointer, or focus a handle and use Space, the arrow keys and Space again. */
export function SortableList<T>({
  items,
  getId,
  onMove,
  children,
}: {
  items: T[];
  getId: (item: T) => string;
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number, handle: DragHandleProps) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((item, index) => (
            <SortableItem key={ids[index]} id={ids[index]}>
              {(handle) => children(item, index, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function DragHandle({ label, handle }: { label: string; handle: DragHandleProps }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="cursor-grab touch-none rounded px-1 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
      {...handle}
    >
      <svg aria-hidden="true" width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
        {[3, 9, 15].flatMap((y) => [
          <circle key={`l${y}`} cx="3" cy={y} r="1.5" />,
          <circle key={`r${y}`} cx="9" cy={y} r="1.5" />,
        ])}
      </svg>
    </button>
  );
}
