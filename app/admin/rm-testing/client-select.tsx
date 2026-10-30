"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/form";

export function ClientSelect({
  clients,
  selected,
}: {
  clients: { id: number; name: string }[];
  selected?: number;
}) {
  const router = useRouter();

  return (
    <SelectField
      label="Client"
      value={selected ?? ""}
      onChange={(event) => router.push(`/admin/rm-testing?client=${event.target.value}`)}
    >
      <option value="" disabled>
        Select a client...
      </option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </SelectField>
  );
}
