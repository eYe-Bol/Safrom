/**
 * Shared formatting utilities — single source of truth.
 * Import from here instead of re-declaring in every page.
 */

/** Format a number as a KES currency string */
export const fmt = (n: number): string => `KES ${Number(n).toLocaleString()}`;

/** Format a number as a plain integer string */
export const fmtInt = (n: number): string => Number(n).toLocaleString();

type SaleRow = {
  created_at: string;
  revenue: number;
  units_sold: number;
  inventory?: { cost_price?: number } | null;
};

type ExpenseRow = {
  date: string;
  amount: number;
};

type ChartDay = {
  day: string;
  revenue: number;
  expenses: number;
  profit: number;
};

/**
 * Group sales and expenses by calendar day, computing revenue, expenses,
 * and net profit (or net sales) per day.
 */
export function groupByDate(
  sales: SaleRow[],
  expenses: ExpenseRow[],
  mode: 'net_profit' | 'net_sales',
): ChartDay[] {
  const map: Record<string, ChartDay> = {};

  for (const r of sales) {
    const day = r.created_at.slice(0, 10);
    if (!map[day]) map[day] = { day, revenue: 0, expenses: 0, profit: 0 };
    const rev = Number(r.revenue);
    map[day].revenue += rev;
    if (mode === 'net_profit') {
      map[day].profit += rev - r.units_sold * (r.inventory?.cost_price ?? 0);
    }
  }

  for (const e of expenses) {
    const day = e.date;
    if (!map[day]) map[day] = { day, revenue: 0, expenses: 0, profit: 0 };
    map[day].expenses += Number(e.amount);
  }

  for (const d of Object.values(map)) {
    if (mode === 'net_profit') {
      d.profit = d.profit - d.expenses;
    } else {
      d.profit = d.revenue - d.expenses;
    }
  }

  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

/** Convert an array of objects to a CSV string and trigger a browser download */
export function downloadCSV(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h] ?? '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str}"`
            : str;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
