import type { Order } from '../../types';

const WINDOW_DAYS = 90;

/** Counts orders by day of the week over the last 90 days, Saturday first because that is the start of the week in Bangladesh. */
export function ordersByWeekday(orders: readonly Order[], now: Date = new Date()): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const since = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  orders.forEach((order) => {
    const placed = new Date(order.Order_Placed_At).getTime();
    if (Number.isNaN(placed) || placed < since || placed > now.getTime()) return;
    const day = new Date(placed).getDay(); // 0 = Sunday
    counts[(day + 1) % 7] += 1; // Saturday -> 0
  });
  return counts;
}
