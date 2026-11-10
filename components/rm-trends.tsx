import type { ExerciseTrend } from "@/lib/rm-data";
import { RmTrendChart } from "./rm-trend-chart";

/** One chart per tested exercise; those with 3+ sessions show a trend line. */
export function RmTrends({ trends, today }: { trends: ExerciseTrend[]; today: string }) {
  if (trends.length === 0) {
    return <p className="text-sm text-gray-500">No results to graph yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {trends.map((trend) => (
        <RmTrendChart
          key={trend.exerciseId}
          id={`trend-${trend.exerciseId}`}
          exerciseName={trend.exerciseName}
          points={trend.points}
          today={today}
        />
      ))}
    </div>
  );
}
