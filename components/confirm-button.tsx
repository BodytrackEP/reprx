"use client";

/** A form button that asks first. Without JS the form still submits. */
export function ConfirmButton({
  action,
  id,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number | string;
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
