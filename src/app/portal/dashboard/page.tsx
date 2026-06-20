'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;

function groupByDay(sales: any[], expenses: any[], mode: 'net_sales' | 'net_profit') {
  const map: Record<string, { revenue: number; expenses: number; profit: number }> = {};

  sales.forEach(r => {
    const day = r.created_at.slice(0, 10);
    if (!map[day]) map[day] = { revenue: 0, expenses: 0, profit: 0 };
    const rev = Number(r.revenue);
    map[day].revenue += rev;
    if (mode === 'net_profit') {
      map[day].profit += rev - (r.units_sold * (r.inventory?.cost_price || 0));
    }
  });

  expenses.forEach(e => {
    const day = e.date;
    if (!map[day]) map[day] = { revenue: 0, expenses: 0, profit: 0 };
    map[day].expenses += Number(e.amount);
  });

  // compute net for each day
  Object.values(map).forEach(d => {
    if (mode === 'net_profit') {
      d.profit = d.profit - d.expenses;
    } else {
      d.profit = d.revenue - d.expenses;
    }
  });

  return Object.entries(map)
    .map(([day, data]) => ({ day, ...data }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14); // last 14 days
}

export default function DashboardPage() {
  const { storeId } = useStore();
  const [storeName, setStoreName] = useState('');
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [todayNetValue, setTodayNetValue] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [profitMode, setProfitMode] = useState<'net_profit' | 'net_sales'>('net_sales');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      if (!storeId) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from('users').select('*').eq('id', storeId!).single();
      setStoreName(profile?.store_name || '');

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Fetch last 14 days for chart
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
      fourteenDaysAgo.setHours(0, 0, 0, 0);

      const [{ data: allSales }, { data: allExpenses }, { data: inventory }] = await Promise.all([
        supabase.from('sales').select('*, inventory(cost_price)').eq('user_id', storeId!)
          .gte('created_at', fourteenDaysAgo.toISOString()).order('created_at', { ascending: false }),
        supabase.from('expenses').select('amount, date').eq('user_id', storeId!)
          .gte('date', fourteenDaysAgo.toISOString().split('T')[0]),
        supabase.from('inventory').select('stock, reorder_level, cost_price').eq('user_id', storeId!),
      ]);

      // Determine mode: all products have cost_price?
      const allHaveCost = inventory
        ? inventory.length > 0 && inventory.every(i => Number(i.cost_price) > 0)
        : false;
      const mode: 'net_profit' | 'net_sales' = allHaveCost ? 'net_profit' : 'net_sales';
      setProfitMode(mode);

      // Today's sales
      const todaySales = (allSales || []).filter(s => s.created_at >= startOfToday.toISOString());
      setRecentSales(todaySales);
      const revenue = todaySales.reduce((sum, s) => sum + Number(s.revenue), 0);
      setTodayRevenue(revenue);
      setTodayTransactions(todaySales.length);

      // Today's expenses
      const todayStr = startOfToday.toISOString().split('T')[0];
      const todayExpenses = (allExpenses || []).filter(e => e.date === todayStr);
      const todayExpTotal = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Today net value
      if (mode === 'net_profit') {
        const costTotal = todaySales.reduce((sum, s) => sum + s.units_sold * (s.inventory?.cost_price || 0), 0);
        setTodayNetValue(revenue - costTotal - todayExpTotal);
      } else {
        setTodayNetValue(revenue - todayExpTotal);
      }

      // Low stock
      if (inventory) setLowStockCount(inventory.filter(i => i.stock < i.reorder_level).length);

      // Chart data
      setChartData(groupByDay(allSales || [], allExpenses || [], mode));
      setLoading(false);
    };
    fetchDashboardData();
  }, [storeId]);

  const modeLabel = profitMode === 'net_profit' ? 'Net Profit' : 'Net Sales';
  const modeHint = profitMode === 'net_profit'
    ? 'Revenue – Cost – Expenses'
    : 'Revenue – Expenses (add cost prices to unlock Net Profit)';

  if (loading) {
    return <div className="p-10 text-center text-[var(--color-muted)] text-[14px]">Loading dashboard...</div>;
  }

  if (!storeId) {
    return (
      <div className="flex flex-col min-h-screen pb-10">
        <Topbar title="Dashboard" sub="Overview" />
        <div className="p-10 text-center flex flex-col items-center justify-center gap-4 mt-10">
          <div className="text-[40px]">⚠️</div>
          <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">Account Setup Incomplete</h2>
          <p className="text-[14px] text-[var(--color-muted)] max-w-md">
            Your staff account is missing its profile record. This usually happens if the account creation process was interrupted.
            <br /><br />
            <strong>Please ask the store owner to delete this staff account in their settings and recreate it.</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Dashboard" sub="Store Overview" />

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* Mode banner when in Net Sales mode */}
        {!loading && profitMode === 'net_sales' && (
          <div className="bg-[var(--color-amber-bg)] border border-[var(--color-amber)]/30 rounded-xl px-4 py-3 flex items-center gap-3 text-[13px]">
            <span className="text-[18px]">💡</span>
            <span className="text-[var(--color-amber)] font-semibold">
              <strong>Net Sales Mode:</strong> Add cost prices to all products in the Catalogue to unlock Net Profit tracking.
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Today's Revenue" value={`KES ${todayRevenue.toLocaleString()}`} sub="Gross sales today" accent="var(--color-teal)" />
          <StatCard label="Transactions" value={todayTransactions.toString()} sub="Items logged today" accent="var(--color-slate)" />
          <StatCard label="Low Stock Items" value={lowStockCount.toString()} sub="Review Order Tracker" accent={lowStockCount > 0 ? "var(--color-red)" : "var(--color-amber)"} />
          <StatCard
            label={modeLabel}
            value={`KES ${todayNetValue.toLocaleString()}`}
            sub={profitMode === 'net_profit' ? 'After cost & expenses' : 'After expenses'}
            accent="var(--color-emerald)"
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-4 sm:gap-5 items-start">
          {/* Chart */}
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                Revenue · Expenses · {modeLabel} <span className="text-[12px] font-normal text-[var(--color-muted)]">(Last 14 days)</span>
              </h2>
            </div>
            <div className="h-[260px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">Loading chart...</div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">No data yet — log some sales to see trends.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-lt)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} dy={10}
                      tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip
                      formatter={(val: any, name: any) => [fmt(Number(val)), name === 'profit' ? modeLabel : name.charAt(0).toUpperCase() + name.slice(1)]}
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
            <div className="flex gap-4 mt-4 text-[12px] font-semibold text-[var(--color-slate)] justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-teal)]" /> Revenue</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 border-t-2 border-dashed border-[var(--color-gold)]" /> Expenses</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-emerald)]" /> {modeLabel}</div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Recent Activity</h2>
              <div className="text-[11px] text-[var(--color-muted)]">Sales recorded today</div>
            </div>
            <div className="flex flex-col overflow-y-auto max-h-[300px]">
              {loading ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading...</div>
              ) : recentSales.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">No sales logged today.</div>
              ) : recentSales.map((sale, i) => (
                <div key={sale.id} className={`p-4 flex gap-3 ${i < recentSales.length - 1 ? 'border-b border-[var(--color-line-lt)]' : ''} hover:bg-[var(--color-canvas)] transition-colors`}>
                  <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] text-[var(--color-teal)] flex items-center justify-center font-bold text-[12px] shrink-0">
                    S
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-[var(--color-ink)] mb-0.5">
                      <span className="font-bold">{sale.inventory?.name || 'Item'}</span> sold
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-[11px] text-[var(--color-muted)]">{sale.units_sold} units</div>
                      <div className="text-[13px] font-bold text-[var(--color-teal)]">KES {Number(sale.revenue).toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] text-[var(--color-slate)] mt-1 opacity-70">
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
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
