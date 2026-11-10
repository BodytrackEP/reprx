type ClientName = {
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
};

export function clientName(client: ClientName) {
  const full = `${client.first_name} ${client.last_name}`;
  return client.preferred_name ? `${full} (${client.preferred_name})` : full;
}

/** Sort order for people: surname, then first name. */
export function byName(a: ClientName, b: ClientName) {
  return (
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
  );
}

type Named = { id: number; first_name: string; last_name: string };

/**
 * Column headings for the session grid: first name and surname initial ("Sarah M.").
 * Clashing names take more of the surname ("Sarah Mi.", "Sarah Mo."), and identical full
 * names are numbered in id order.
 */
export function abbreviateNames(clients: Named[]) {
  const result = new Map<number, string>();
  const groups = new Map<string, Named[]>();

  for (const client of clients) {
    const key = `${client.first_name} ${client.last_name.slice(0, 1)}`.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), client]);
  }

  for (const group of groups.values()) {
    for (const client of group) {
      let length = 1;
      const clash = (n: number) =>
        group.some(
          (other) =>
            other.id !== client.id &&
            other.last_name.slice(0, n).toLowerCase() ===
              client.last_name.slice(0, n).toLowerCase(),
        );
      while (length < client.last_name.length && clash(length)) length += 1;

      let label = `${client.first_name} ${client.last_name.slice(0, length)}`;
      if (length < client.last_name.length) label += ".";

      const twins = group
        .filter((other) => other.last_name.toLowerCase() === client.last_name.toLowerCase())
        .sort((a, b) => a.id - b.id);
      if (twins.length > 1) label += ` (${twins.findIndex((twin) => twin.id === client.id) + 1})`;

      result.set(client.id, label);
    }
  }
  return result;
}
