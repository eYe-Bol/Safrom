'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/context/StoreContext';
import { fmt, groupByDate, downloadCSV } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

type SaleRow = {
  id: string;
  units_sold: number;
  revenue: number;
  created_at: string;
  inventory: { name: string; category: string; cost_price: number; sell_price: number } | null;
};

type ExpenseRow = { amount: number; category: string; date: string };

type InventoryRow = { cost_price: number };

// ─── Page ─────────────────────────────────────────────────────────────────────

const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const defaultTo = new Date().toISOString().split('T')[0];

export default function ReportsPage() {
  const { storeId, branchName } = useStore();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catF, setCatF] = useState('All');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [profitMode, setProfitMode] = useState<'net_profit' | 'net_sales'>('net_sales');

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();

    const toEnd = dateTo + 'T23:59:59';
    const curBranch = branchName || 'Main Branch';

    const [{ data: salesData }, { data: expData }, { data: inventory }] = await Promise.all([
      supabase
        .from('sales')
        .select('id, units_sold, revenue, created_at, inventory(name, category, cost_price, sell_price)')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch)
        .gte('created_at', dateFrom + 'T00:00:00')
        .lte('created_at', toEnd)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('amount, category, date')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false }),
      supabase
        .from('inventory')
        .select('cost_price')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch),
    ]);

    if (salesData) setSales(salesData as unknown as SaleRow[]);
    if (expData) setExpenses(expData as ExpenseRow[]);

    const invRows = inventory as InventoryRow[] | null;
    const allHaveCost =
      invRows && invRows.length > 0 && invRows.every(i => Number(i.cost_price) > 0);
    setProfitMode(allHaveCost ? 'net_profit' : 'net_sales');

    setLoading(false);
  }, [dateFrom, dateTo, storeId, branchName]);

  useEffect(() => { fetchData(); }, [storeId, branchName, fetchData]);

  // ─── Derived Values ──────────────────────────────────────────────────────────

  const filteredSales = sales.filter(s => catF === 'All' || s.inventory?.category === catF);
  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.revenue), 0);
  const totalExpenses = catF === 'All' ? expenses.reduce((s, e) => s + Number(e.amount), 0) : 0;
  const totalCost = filteredSales.reduce((s, r) => s + r.units_sold * (r.inventory?.cost_price || 0), 0);
  const netValue =
    profitMode === 'net_profit'
      ? totalRevenue - totalCost - totalExpenses
      : totalRevenue - totalExpenses;
  const unitsSold = filteredSales.reduce((s, r) => s + r.units_sold, 0);
  const modeLabel = profitMode === 'net_profit' ? 'Net Profit' : 'Net Sales';

  const lineData = groupByDate(filteredSales, catF === 'All' ? expenses : [], profitMode);
  const cats = ['All', ...Array.from(new Set(sales.map(s => s.inventory?.category || 'General')))];

  // Product summary table
  const productMap: Record<string, { cat: string; units: number; revenue: number; cost: number; sell: number }> = {};
  filteredSales.forEach(r => {
    const name = r.inventory?.name || 'Unknown';
    if (!productMap[name]) {
      productMap[name] = {
        cat: r.inventory?.category || 'General',
        units: 0,
        revenue: 0,
        cost: r.inventory?.cost_price || 0,
        sell: r.inventory?.sell_price || 0,
      };
    }
    productMap[name].revenue += Number(r.revenue);
    productMap[name].units += r.units_sold;
  });
  const topProducts = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue);

  // ─── CSV Export ──────────────────────────────────────────────────────────────

  const handleExportSalesCSV = () => {
    const rows = topProducts.map(([name, r]) => ({
      Product: name,
      Category: r.cat,
      Units_Sold: r.units,
      Sell_Price: r.sell,
      Cost_Price: r.cost,
      Revenue: r.revenue,
      Margin_Pct: r.sell > 0 && r.cost > 0 ? Math.round(((r.sell - r.cost) / r.sell) * 100) : '',
    }));
    downloadCSV(rows, `sales_report_${dateFrom}_to_${dateTo}.csv`);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Reports" sub="Analyse performance across any period" />

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* Filters Bar */}
        <div className="bg-white rounded-xl p-3 border border-[var(--color-line-lt)] flex gap-2.5 flex-wrap items-center">
          <select value={catF} onChange={e => setCatF(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white focus:border-[var(--color-teal)]">
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-slate)] focus:border-[var(--color-teal)]"
          />
          <span className="text-[var(--color-muted)] hidden sm:inline">→</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-slate)] focus:border-[var(--color-teal)]"
          />
          <button
            onClick={fetchData}
            className="px-5 py-2 bg-[var(--color-teal)] text-white border-none rounded-lg font-bold text-[13px] cursor-pointer hover:opacity-90 whitespace-nowrap"
          >
            Apply
          </button>
          <button
            onClick={handleExportSalesCSV}
            disabled={topProducts.length === 0}
            className="px-3.5 py-2 bg-[var(--color-canvas)] text-[var(--color-slate)] border-[1.5px] border-[var(--color-line)] rounded-lg font-semibold text-[13px] cursor-pointer hover:bg-white ml-auto whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* Mode hint */}
        {!loading && profitMode === 'net_sales' && (
          <div className="bg-[var(--color-amber-bg)] border border-[var(--color-amber)]/30 rounded-xl px-4 py-2.5 text-[12px] text-[var(--color-amber)] font-semibold">
            💡 <strong>Net Sales Mode:</strong> Add cost prices to all products in the Catalogue to unlock Net Profit tracking.
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub="Gross sales" accent="var(--color-teal)" />
          <StatCard label="Total Expenses" value={fmt(totalExpenses)} sub="All costs in period" accent="var(--color-amber)" />
          <StatCard
            label={modeLabel}
            value={fmt(netValue)}
            sub={`${totalRevenue > 0 ? Math.round((netValue / totalRevenue) * 100) : 0}% margin`}
            accent="var(--color-emerald)"
          />
          <StatCard label="Units Sold" value={unitsSold.toLocaleString()} sub="Products moved" accent="var(--color-slate)" />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl p-5 pb-3 border border-[var(--color-line-lt)] shadow-sm">
          <div className="font-serif text-[14px] font-bold text-[var(--color-ink)] mb-4">
            Revenue · Expenses · {modeLabel}
          </div>
          <div className="h-[200px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">Loading chart...</div>
            ) : lineData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">No data for this period. Adjust the date range and click Apply.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-lt)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} dy={10}
                    tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v) / 1000}k`} />
                  <Tooltip
                    formatter={(val, name) => [fmt(Number(val)), name === 'profit' ? modeLabel : String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                    labelFormatter={label => new Date(label as string).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--color-line)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="expenses" stroke="var(--color-gold)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-emerald)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-[12px] font-semibold text-[var(--color-slate)] justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-teal)]" /> Revenue</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 border-t-2 border-dashed border-[var(--color-gold)]" /> Expenses</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-emerald)]" /> {modeLabel}</div>
          </div>
        </div>

        {/* Sales by Product Table */}
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-[var(--color-line-lt)] flex justify-between items-center">
            <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">Sales by Product</span>
            <span className="text-[12px] text-[var(--color-muted)] font-semibold">{topProducts.length} items</span>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading products...</div>
            ) : topProducts.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[var(--color-muted)]">No sales for this period. Click Apply after adjusting filters.</div>
            ) : topProducts.map(([name, r]) => {
              const m = r.sell > 0 && r.cost > 0 ? Math.round(((r.sell - r.cost) / r.sell) * 100) : null;
              const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={name} className="p-3.5 flex flex-col gap-2 bg-white hover:bg-[var(--color-canvas)] transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-[14px] text-[var(--color-ink)]">{name}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-0.5 rounded-full border border-[var(--color-line)] shrink-0">
                      {r.cat}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-line-lt)] text-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Units</div>
                      <div className="font-bold text-[13px] text-[var(--color-ink)] mt-0.5">{r.units}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Revenue</div>
                      <div className="font-bold text-[13px] text-[var(--color-ink)] mt-0.5">{fmt(r.revenue)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Margin</div>
                      <div className="mt-0.5">
                        {m !== null ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m >= 30 ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : m >= 15 ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]' : 'bg-[var(--color-red-bg)] text-[var(--color-red)]'}`}>
                            {m}%
                          </span>
                        ) : <span className="text-[11px] text-[var(--color-muted)] italic">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Revenue Share Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-[var(--color-muted)] shrink-0">Share:</span>
                    <div className="flex-1 h-2 bg-[var(--color-line-lt)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-teal)] rounded-full" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-slate)] shrink-0">{share.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── DESKTOP DATA TABLE (md+) ─── */}
          <div className="hidden md:block overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse" style={{ minWidth: 600 }}>
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]">
                  {['Product', 'Category', 'Units', 'Sell Price', 'Cost', 'Revenue', 'Margin', 'Share'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em] whitespace-nowrap ${i === 0 ? 'sticky left-0 z-20 bg-[var(--color-canvas)] shadow-[1px_0_0_var(--color-line-lt)]' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading products...</td></tr>
                ) : topProducts.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No sales for this period. Click Apply after adjusting filters.</td></tr>
                ) : topProducts.map(([name, r]) => {
                  const m = r.sell > 0 && r.cost > 0 ? Math.round(((r.sell - r.cost) / r.sell) * 100) : null;
                  const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
                  return (
                    <tr key={name} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors group">
                      <td className="px-4 py-3 sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line-lt)] group-hover:bg-[#fafafa] transition-colors">
                        <div className="font-semibold text-[13px] text-[var(--color-ink)]">{name}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{r.cat}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-slate)]">{r.units}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-slate)]">{r.sell > 0 ? fmt(r.sell) : '—'}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-muted)]">{r.cost > 0 ? fmt(r.cost) : '—'}</td>
                      <td className="px-4 py-2.5 font-serif text-[14px] font-bold text-[var(--color-ink)]">{fmt(r.revenue)}</td>
                      <td className="px-4 py-2.5">
                        {m !== null ? (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${m >= 30 ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : m >= 15 ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]' : 'bg-[var(--color-red-bg)] text-[var(--color-red)]'}`}>
                            {m}%
                          </span>
                        ) : <span className="text-[11px] text-[var(--color-muted)] italic">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-[60px] h-1.5 bg-[var(--color-line-lt)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-teal)] rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-[var(--color-slate)]">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
