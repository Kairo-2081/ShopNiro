// Number formatting and trend maths shared by every chart. Kept free of React so it can be unit-tested.

/** 1_250 -> "1.3k", 48_000 -> "48k", 2_400_000 -> "2.4m". Used on axes, where space is tight. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(value)) return '0';
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}m`;
  if (abs >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (abs >= 1_000) return `${trim(value / 1_000)}k`;
  return String(Math.round(value));
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

/**
 * Percentage change from `previous` to `current`. Returns null when there is nothing to compare against (previous is
 * zero or missing), so the interface shows no chip instead of an invented "+Infinity%".
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** +12.4% / -3% / 0%. Whole numbers above 100% so the chip stays short. */
export function formatPercent(change: number): string {
  const rounded = Math.abs(change) >= 100 ? Math.round(change) : Math.round(change * 10) / 10;
  if (rounded === 0) return '0%';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toLocaleString('en-US')}%`;
}

export type Trend = 'up' | 'down' | 'flat';

export function trendOf(change: number | null): Trend {
  if (change === null || Math.abs(change) < 0.05) return 'flat';
  return change > 0 ? 'up' : 'down';
}

/** Share of a total as a whole percent, 0 when the total is 0. */
export function shareOf(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
