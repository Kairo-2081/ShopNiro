import React from 'react';
import { api } from './api';
import { monthKey } from '../components/charts/months';

export interface MonthTotals { orders: number; billable: number; value: number; units: number; delivered: number }

/** Counts per calendar month from the database, keyed like `monthBuckets`; null until loaded or if the request fails. */
export function useMonthlyTotals(enabled = true): Map<string, MonthTotals> | null {
  const [totals, setTotals] = React.useState<Map<string, MonthTotals> | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let active = true;
    api.getMonthlyTotals()
      .then((rows) => {
        if (!active) return;
        setTotals(new Map(rows.map((row) => [monthKey(new Date(row.year, row.month - 1, 1)), { orders: row.orders, billable: row.billable, value: row.value, units: row.units, delivered: row.delivered }])));
      })
      .catch(() => { if (active) setTotals(null); });
    return () => { active = false; };
  }, [enabled]);
  return totals;
}
