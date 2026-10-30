// The server runs in UTC, so "today" must be worked out in the practice's timezone.
export const PRACTICE_TIME_ZONE = "Australia/Brisbane";

/** Today's date as YYYY-MM-DD in the practice's timezone. */
export function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PRACTICE_TIME_ZONE }).format(now);
}

/** 0 = Sunday, matching classes.day_of_week. */
export function todayDayOfWeek(now = new Date()) {
  const [year, month, day] = todayIso(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Trims a Postgres time ("09:00:00") to "09:00". */
export function formatTime(time: string) {
  return time.slice(0, 5);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PRACTICE_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
