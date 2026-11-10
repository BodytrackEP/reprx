export type WeightSource = "override" | "calculated" | "fallback" | "not_tested" | "bodyweight";

export type EffectiveWeight = {
  effective_kg: number | null;
  weight_source: string;
  override_note: string | null;
  override_review_date: string | null;
};

export const isReviewDue = (reviewDate: string | null, today: string) =>
  reviewDate !== null && reviewDate <= today;

/** The §5 treatments. Sizes come from the caller, so this works in cards and in the session grid. */
export function WeightDisplay({
  weight,
  today,
  weightClassName,
  labelClassName,
}: {
  weight: EffectiveWeight;
  today: string;
  weightClassName: string;
  labelClassName: string;
}) {
  const source = weight.weight_source as WeightSource;

  if (source === "not_tested") {
    return <span className={`${labelClassName} text-gray-500`}>Not tested</span>;
  }
  if (source === "bodyweight") {
    return <span className={`${labelClassName} text-gray-500`}>Bodyweight</span>;
  }

  return (
    <>
      <span
        className={`${weightClassName} ${
          source === "override" ? "text-amber-800" : "text-gray-900"
        }`}
      >
        {weight.effective_kg} kg
      </span>
      {/* The full note replaces the "Override" label and wraps; with no note, the amber
          styling alone marks the override. */}
      {source === "override" && weight.override_note && (
        <span className={`${labelClassName} block whitespace-normal break-words text-amber-900`}>
          {weight.override_note}
        </span>
      )}
      {source === "override" && isReviewDue(weight.override_review_date, today) && (
        <span className={`${labelClassName} block font-semibold text-red-700`}>Review due</span>
      )}
      {source === "fallback" && (
        <span className={`${labelClassName} block text-gray-500`}>Starting weight</span>
      )}
    </>
  );
}
