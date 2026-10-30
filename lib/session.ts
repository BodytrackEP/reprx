type AmrEntry = { timestamp?: number };

/** When the user last proved who they are. Token refreshes don't move this. */
export function lastAuthenticatedAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  const times = amr
    .map((entry: AmrEntry) => entry?.timestamp)
    .filter((time): time is number => typeof time === "number");
  return times.length > 0 ? Math.max(...times) : null;
}

export function isSessionExpired(amr: unknown, timeoutHours: number, nowMs: number) {
  const authenticatedAt = lastAuthenticatedAt(amr);
  if (authenticatedAt === null) return false;
  return nowMs / 1000 - authenticatedAt > timeoutHours * 3600;
}
