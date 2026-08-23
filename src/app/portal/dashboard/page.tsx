'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt, groupByDate } from '@/utils/format';

export default function DashboardPage() {
  const { storeId, branchName } = useStore();
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [catF, setCatF] = useState('All');

  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(w);
      setDateTo(todayStr);
    } else if (preset === 'month') {
      const m = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(m);
      setDateTo(todayStr);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const curBranch = branchName || 'Main Branch';
    const toEnd = dateTo + 'T23:59:59';

    const [{ data: allSales }, { data: allExpenses }, { data: invData }] = await Promise.all([
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
        .select('amount, category, note, date')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false }),
      supabase
        .from('inventory')
        .select('stock, reorder_level, cost_price, category')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch),
    ]);

    setSales(allSales || []);
    setExpenses(allExpenses || []);
    setInventory(invData || []);
    setLoading(false);
  }, [storeId, branchName, dateFrom, dateTo]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Categories list
  const allCategories = ['All', ...Array.from(new Set(sales.map(s => s.inventory?.category || 'General')))];

  // Apply Category Filter
  const filteredSales = sales.filter(s => catF === 'All' || (s.inventory?.category || 'General') === catF);
  const filteredExpenses = catF === 'All' ? expenses : []; // Expenses are store-level unless category is All

  // Derived Metrics for Filtered Period
  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.revenue), 0);
  const totalUnitsSold = filteredSales.reduce((sum, s) => sum + (s.units_sold || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCost = filteredSales.reduce((sum, s) => sum + (s.units_sold || 0) * (s.inventory?.cost_price || 0), 0);
  
  const allHaveCost = inventory.length > 0 && inventory.every(i => Number(i.cost_price) > 0);
  const netIncome = allHaveCost ? totalRevenue - totalCost - totalExpenses : totalRevenue - totalExpenses;
  const lowStockCount = inventory.filter(i => i.stock <= i.reorder_level).length;

  // Chart Data
  const chartData = groupByDate(filteredSales, filteredExpenses, allHaveCost ? 'net_profit' : 'net_sales');

  if (!storeId && !loading) {
    return (
      <div className="flex flex-col min-h-dvh pb-10 w-full">
        <Topbar title="Dashboard" sub="Overview" />
        <div className="p-10 text-center flex flex-col items-center justify-center gap-4 mt-10">
          <div className="text-[40px]">⚠️</div>
          <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">Account Setup Incomplete</h2>
          <p className="text-[14px] text-[var(--color-muted)] max-w-md">
            Your staff account is missing its profile record. Please ask the store owner to delete and recreate this account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Dashboard" sub="Operational Overview & Financial Health" />

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* ─── DASHBOARD FILTERS BAR ─── */}
        <div className="bg-white rounded-2xl p-4 border border-[var(--color-line-lt)] shadow-sm flex flex-col gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider mr-1">Timeframe:</span>
            {[
              { id: 'today', label: "Today" },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  datePreset === p.id 
                    ? 'bg-[var(--color-teal)] text-white shadow-sm' 
                    : 'bg-[var(--color-canvas)] text-[var(--color-slate)] hover:bg-[var(--color-line-lt)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Detailed Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-2 border-t border-[var(--color-line-lt)]">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">Filter by Category</label>
              <select
                value={catF}
                onChange={e => setCatF(e.target.value)}
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none bg-white font-medium focus:border-[var(--color-teal)] cursor-pointer"
              >
                {allCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
              </select>
            </div>

            {/* Date Range Start / End */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setDatePreset('custom'); }}
                  className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium text-[var(--color-ink)] focus:border-[var(--color-teal)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setDatePreset('custom'); }}
                  className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium text-[var(--color-ink)] focus:border-[var(--color-teal)]"
                />
              </div>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-[var(--color-teal)] text-white border-none rounded-xl font-bold text-[13px] cursor-pointer hover:opacity-90 whitespace-nowrap self-end h-[38px] shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* ─── DASHBOARD KPI CARDS (REVENUE, EXPENSES, UNITS SOLD, NET VALUE) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Revenue"
            value={fmt(totalRevenue)}
            sub={`${filteredSales.length} sales recorded`}
            accent="var(--color-teal)"
          />
          <StatCard
            label="Total Expenses"
            value={fmt(totalExpenses)}
            sub={catF === 'All' ? `${expenses.length} expense entries` : 'Store-wide expenses'}
            accent="var(--color-gold)"
          />
          <StatCard
            label="Units Sold"
            value={totalUnitsSold.toLocaleString()}
            sub="Products moved"
            accent="var(--color-slate)"
          />
          <StatCard
            label={allHaveCost ? "Net Profit" : "Net Revenue"}
            value={fmt(netIncome)}
            sub={allHaveCost ? "After cost & expenses" : "After expenses"}
            accent="var(--color-emerald)"
          />
        </div>

        {/* ─── CHART & RECENT ACTIVITY ─── */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4 sm:gap-5 items-start">
          {/* Trends Chart */}
          <div className="bg-white rounded-2xl p-5 border border-[var(--color-line-lt)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                Revenue · Expenses · Net Income Trends
              </h2>
              <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                {datePreset === 'today' ? 'Today' : `${dateFrom} to ${dateTo}`}
              </span>
            </div>

            <div className="h-[260px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">Loading chart data...</div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">No transaction data in this timeframe.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-lt)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} dy={10}
                      tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v)/1000}k`} />
                    <Tooltip
                      formatter={(val: any, name: any) => [fmt(Number(val)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                      labelFormatter={label => new Date(label as string).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--color-line)' }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="expenses" stroke="var(--color-gold)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="profit" stroke="var(--color-emerald)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex gap-4 mt-4 text-[12px] font-semibold text-[var(--color-slate)] justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-teal)]" /> Revenue</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 border-t-2 border-dashed border-[var(--color-gold)]" /> Expenses</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-emerald)]" /> Net Value</div>
            </div>
          </div>

          {/* Activity / Transaction Log */}
          <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--color-line-lt)] flex justify-between items-center">
              <div>
                <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Recent Sales</h2>
                <div className="text-[11px] text-[var(--color-muted)]">{filteredSales.length} items logged in period</div>
              </div>
              {lowStockCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-50 text-[var(--color-gold)] border border-amber-200 px-2 py-0.5 rounded-full">
                  ⚠️ {lowStockCount} Low Stock
                </span>
              )}
            </div>

            <div className="flex flex-col overflow-y-auto max-h-[320px] divide-y divide-[var(--color-line-lt)]">
              {loading ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading activity...</div>
              ) : filteredSales.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">No sales found for this filter.</div>
              ) : filteredSales.slice(0, 15).map(sale => (
                <div key={sale.id} className="p-3.5 flex items-center justify-between hover:bg-[var(--color-canvas)] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] text-[var(--color-teal)] flex items-center justify-center font-bold text-[12px] shrink-0">
                      S
                    </div>
                    <div>
                      <div className="font-bold text-[13px] text-[var(--color-ink)]">{sale.inventory?.name || 'Item'}</div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        {sale.units_sold} unit{sale.units_sold !== 1 ? 's' : ''} · {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="font-serif font-bold text-[13px] text-[var(--color-teal)]">
                    {fmt(sale.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
