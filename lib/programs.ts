/** Fraction to the percentage staff enter, e.g. 0.7 -> 70, 0.675 -> 67.5. */
export function toPercent(fraction: number) {
  return Number((fraction * 100).toFixed(1));
}

/** Percentage as entered to the stored fraction, e.g. 70 -> 0.7. */
export function toFraction(percent: number) {
  return Number((percent / 100).toFixed(3));
}

/** "3 × 10 SL @70%", or "3 × 10 SL" without a percentage. */
export function formatPrescription(sets: number, reps: string, rmPercentage: number | null) {
  const load = rmPercentage === null ? "" : ` @${toPercent(rmPercentage)}%`;
  return `${sets} × ${reps}${load}`;
}

/** Whether an assignment covers a date. Dates are YYYY-MM-DD, so they compare as strings. */
export function isCurrent(
  assignment: { start_date: string; end_date: string | null },
  today: string,
) {
  return assignment.start_date <= today && (!assignment.end_date || assignment.end_date >= today);
}
