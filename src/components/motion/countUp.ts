/** Starts fast and settles gently, so a number lands on its value instead of stopping dead. */
export const easeOutCubic = (progress: number): number => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;

/** The value to show `elapsedMs` into a count from `from` to `to` over `durationMs`; it always ends exactly on `to`. */
export function countUpValue(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(to)) return 0;
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  return from + (to - from) * easeOutCubic(elapsedMs / durationMs);
}
