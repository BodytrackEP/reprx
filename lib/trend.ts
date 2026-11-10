export type TrendPoint = { date: string; value: number };

export type Trend = {
  /** kg per day, on the fitted line. */
  slopePerDay: number;
  slopePerWeek: number;
  slopePerMonth: number;
  /** The fitted line's value on `today`. */
  estimateToday: number;
  /** The fitted line's value on a date. */
  at: (date: string) => number;
};

export const MIN_TREND_SESSIONS = 3;
const DAYS_PER_MONTH = 365.25 / 12;

const dayNumber = (date: string) => Date.UTC(
  Number(date.slice(0, 4)),
  Number(date.slice(5, 7)) - 1,
  Number(date.slice(8, 10)),
) / 86_400_000;

/**
 * Least-squares line through est. 1RM against test date, one point per session. Needs
 * 3+ sessions on at least two different dates; otherwise there is no trend to report.
 */
export function linearTrend(points: TrendPoint[], today: string): Trend | null {
  if (points.length < MIN_TREND_SESSIONS) return null;

  const xs = points.map((point) => dayNumber(point.date));
  const ys = points.map((point) => point.value);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;

  const spread = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (spread === 0) return null;

  const slope = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / spread;
  const at = (date: string) => meanY + slope * (dayNumber(date) - meanX);

  return {
    slopePerDay: slope,
    slopePerWeek: slope * 7,
    slopePerMonth: slope * DAYS_PER_MONTH,
    estimateToday: at(today),
    at,
  };
}

/** "+1.25 kg/week" style, with the sign shown. */
export function formatRate(kg: number, unit: "week" | "month") {
  const rounded = Number(kg.toFixed(2));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} kg/${unit}`;
}
