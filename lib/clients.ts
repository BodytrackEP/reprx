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
