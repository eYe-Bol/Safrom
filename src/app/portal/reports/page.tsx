'use client';

import { Topbar } from '@/components/Topbar';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type SaleRow = {
  id: string;
  units_sold: number;
  revenue: number;
  created_at: string;
  inventory: { name: string; cost_price: number } | null;
};

type ExpenseRow = { amount: number; category: string; date: string };

function groupByDate(rows: SaleRow[]) {
  const map: Record<string, { revenue: number; profit: number; count: number }> = {};
  rows.forEach(r => {
    const day = r.created_at.slice(0, 10);
    if (!map[day]) map[day] = { revenue: 0, profit: 0, count: 0 };
    map[day].revenue += Number(r.revenue);
    map[day].profit += Number(r.revenue) - (r.units_sold * (r.inventory?.cost_price || 0));
    map[day].count++;
  });
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
}

export default function ReportsPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, inventory(name, cost_price)')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: expData } = await supabase
        .from('expenses')
        .select('amount, category, date')
        .order('date', { ascending: false })
        .limit(200);

      if (salesData) setSales(salesData as any);
      if (expData) setExpenses(expData as any);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalRevenue = sales.reduce((s, r) => s + Number(r.revenue), 0);
  const totalProfit = sales.reduce((s, r) => s + Number(r.revenue) - (r.units_sold * (r.inventory?.cost_price || 0)), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalProfit - totalExpenses;

  const dailyRows = groupByDate(sales);

  // Product summary
  const productMap: Record<string, { revenue: number; units: number }> = {};
  sales.forEach(r => {
    const name = r.inventory?.name || 'Unknown';
    if (!productMap[name]) productMap[name] = { revenue: 0, units: 0 };
    productMap[name].revenue += Number(r.revenue);
    productMap[name].units += r.units_sold;
  });
  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  return (
    <div>
      <Topbar title="Reports" sub="Business performance overview" />
      <div className="p-4 max-w-[1100px] mx-auto">

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Revenue', value: `KES ${totalRevenue.toLocaleString()}`, color: 'text-[var(--color-emerald)]' },
            { label: 'Gross Profit', value: `KES ${totalProfit.toLocaleString()}`, color: 'text-[var(--color-teal)]' },
            { label: 'Total Expenses', value: `KES ${totalExpenses.toLocaleString()}`, color: 'text-[var(--color-red)]' },
            { label: 'Net Profit', value: `KES ${netProfit.toLocaleString()}`, color: netProfit >= 0 ? 'text-[var(--color-emerald)]' : 'text-[var(--color-red)]' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-[14px] p-4 border border-[var(--color-line-lt)] shadow-sm">
              <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">{kpi.label}</div>
              <div className={`font-serif text-[20px] font-bold ${kpi.color}`}>{loading ? '…' : kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_300px] gap-4">
          {/* Daily Breakdown Table */}
          <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Daily Breakdown</div>
              <div className="text-[11px] text-[var(--color-muted)]">Last 30 days of sales activity</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                    {['Date', 'Revenue', 'Gross Profit', 'Transactions'].map(h => (
                      <th key={h} className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading...</td></tr>
                  ) : dailyRows.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No sales data yet.</td></tr>
                  ) : dailyRows.map(([date, data]) => (
                    <tr key={date} className="border-b border-[var(--color-line-lt)] hover:bg-[var(--color-canvas)]">
                      <td className="p-3 text-[12px] font-semibold text-[var(--color-slate)]">{date}</td>
                      <td className="p-3 text-[13px] font-bold text-[var(--color-ink)]">KES {data.revenue.toLocaleString()}</td>
                      <td className="p-3 text-[12px] font-semibold text-[var(--color-emerald)]">KES {Math.round(data.profit).toLocaleString()}</td>
                      <td className="p-3 text-[12px] text-[var(--color-slate)]">{data.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Top Products</div>
              <div className="text-[11px] text-[var(--color-muted)]">By revenue generated</div>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {loading ? <div className="text-[13px] text-[var(--color-muted)]">Loading…</div> :
               topProducts.length === 0 ? <div className="text-[13px] text-[var(--color-muted)] py-2">No data yet.</div> :
               topProducts.map(([name, data], i) => (
                <div key={name} className="p-3 rounded-[10px] bg-[var(--color-canvas)] flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-teal)] text-white font-bold text-[11px] flex items-center justify-center shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{name}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">{data.units} units sold</div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--color-teal)] shrink-0">KES {data.revenue.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
