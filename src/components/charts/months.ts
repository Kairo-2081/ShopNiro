// Calendar-month windows for the dashboards. Kept free of React so the maths can be tested.

export interface MonthBucket {
  key: string;
  label: string;
}

export const monthKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}`;

/**
 * `count` calendar months ending `endOffset` months before the current month, oldest first. With endOffset 0 this is
 * the window up to and including this month; with endOffset equal to `count` it is the window just before that; with
 * endOffset 12 it is the same months a year earlier.
 */
export function monthBuckets(count: number, now: Date = new Date(), endOffset = 0, locale?: string): MonthBucket[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'short' });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - endOffset - (count - 1 - index), 1);
    return { key: monthKey(date), label: format.format(date) };
  });
}

/** The order's placed month key, or null for a missing or invalid date. */
export function placedMonthKey(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : monthKey(date);
}
