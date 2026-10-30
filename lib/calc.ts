// Client-side mirror of the database calculation, used for live previews only.
// Postgres is authoritative (rm_tests.estimated_1rm_kg, round_to_increment,
// effective_weights). Values are scaled to integers so that half-way cases
// round as Postgres numeric does, not as binary floats happen to fall.

const roundHalfUp = (numerator: number, denominator: number) =>
  Math.floor((2 * numerator + denominator) / (2 * denominator));

const toCents = (kg: number) => Math.round(kg * 100);

/** Epley estimate of 1RM. A true 1RM (reps = 1) is the weight itself. */
export function estimate1Rm(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return roundHalfUp(toCents(weightKg) * (30 + reps), 30) / 100;
}

/** Rounds half away from zero to the nearest increment. Weights are never negative. */
export function roundToIncrement(kg: number, incrementKg: number): number {
  const inc = toCents(incrementKg);
  return (roundHalfUp(toCents(kg), inc) * inc) / 100;
}

/** Working weight for a percentage of 1RM, rounded to the increment. */
export function calculateWeight(
  oneRmKg: number,
  rmPercentage: number,
  incrementKg: number,
): number {
  const inc = toCents(incrementKg);
  const product = toCents(oneRmKg) * Math.round(rmPercentage * 1000);
  return (roundHalfUp(product, inc * 1000) * inc) / 100;
}
