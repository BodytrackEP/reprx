type DbError = { code?: string; message: string };

/**
 * Our own SQLSTATEs (RX...) carry messages written for staff. Anything else may
 * expose schema details, so it is replaced by the fallback.
 */
export function dbErrorMessage(error: DbError, fallback: string) {
  return error.code?.startsWith("RX") ? error.message : fallback;
}

export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
