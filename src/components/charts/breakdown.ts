// The arithmetic behind the share breakdown, kept free of React so it can be tested.

export interface ShareRow {
  /** Share of the whole as a percentage, 0 to 100, unrounded so the ribbon stays exact. */
  percent: number;
  /** Whole-number percentage for display. */
  label: number;
}

/**
 * Shares for a list of values. Negative, missing or non-numeric values count as zero, and when everything is zero every
 * share is zero instead of NaN. Display labels are rounded with the largest-remainder method so they always add up to
 * 100, which plain rounding does not (33.4 + 33.3 + 33.3 would show 33 + 33 + 33).
 */
export function shareRows(values: readonly number[]): ShareRow[] {
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total === 0) return clean.map(() => ({ percent: 0, label: 0 }));

  const exact = clean.map((value) => (value / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    if (clean[index] > 0) {
      floors[index] += 1;
      remaining -= 1;
    }
  }
  return exact.map((percent, index) => ({ percent, label: floors[index] }));
}
