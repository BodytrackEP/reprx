import { formatRate, linearTrend, MIN_TREND_SESSIONS, type TrendPoint } from "@/lib/trend";
import { formatDate } from "@/lib/time";

const WIDTH = 360;
const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/**
 * Est. 1RM per testing session with a least-squares trend line. Plain SVG: presentation
 * attributes and classes only, no inline styles, so it works under the strict CSP.
 */
export function RmTrendChart({
  id,
  exerciseName,
  points,
  today,
}: {
  id: string;
  exerciseName: string;
  points: TrendPoint[];
  today: string;
}) {
  const trend = linearTrend(points, today);

  if (!trend) {
    return (
      <figure data-testid="trend-chart" className="rounded-xl border border-gray-200 bg-white p-4">
        <figcaption className="text-sm font-medium text-gray-900">{exerciseName}</figcaption>
        <p className="mt-2 text-sm text-gray-500">
          Needs {MIN_TREND_SESSIONS} sessions for a trend ({points.length} so far).
        </p>
      </figure>
    );
  }

  const first = points[0].date;
  const last = today > points.at(-1)!.date ? today : points.at(-1)!.date;
  const values = [...points.map((point) => point.value), trend.at(first), trend.at(last)];
  const low = Math.floor(Math.min(...values) * 0.95);
  const high = Math.ceil(Math.max(...values) * 1.05);

  const x = (date: string) =>
    PAD.left + ((day(date) - day(first)) / Math.max(1, day(last) - day(first))) *
      (WIDTH - PAD.left - PAD.right);
  const y = (value: number) =>
    HEIGHT - PAD.bottom - ((value - low) / Math.max(1, high - low)) *
      (HEIGHT - PAD.top - PAD.bottom);

  const ticks = [low, (low + high) / 2, high];
  const summary = `Trend ${formatRate(trend.slopePerWeek, "week")} (${formatRate(
    trend.slopePerMonth,
    "month",
  )}). Trend-line estimate today: ${trend.estimateToday.toFixed(1)} kg.`;

  return (
    <figure data-testid="trend-chart" className="rounded-xl border border-gray-200 bg-white p-4">
      <figcaption className="text-sm font-medium text-gray-900">{exerciseName}</figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-labelledby={`${id}-summary`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)}
              className="stroke-gray-200" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end"
              className="fill-gray-500 text-[10px]">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 8} className="fill-gray-500 text-[10px]">
          {formatDate(first)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end"
          className="fill-gray-500 text-[10px]">
          {formatDate(last)}
        </text>

        <line
          data-testid="trend-line"
          x1={x(first)} y1={y(trend.at(first))} x2={x(last)} y2={y(trend.at(last))}
          className="stroke-gray-500" strokeWidth={2} strokeDasharray="5 4"
        />
        {points.map((point) => (
          <circle key={point.date + point.value} cx={x(point.date)} cy={y(point.value)} r={4}
            className="fill-indigo-600">
            <title>{`${formatDate(point.date)}: ${point.value} kg est. 1RM`}</title>
          </circle>
        ))}
      </svg>
      <p id={`${id}-summary`} className="mt-1 text-xs text-gray-600">
        {summary}
      </p>
    </figure>
  );
}
