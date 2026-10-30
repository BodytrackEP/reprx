export function CategoryBadge({ label, colour }: { label: string; colour: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colour}`}>
      {label}
    </span>
  );
}
