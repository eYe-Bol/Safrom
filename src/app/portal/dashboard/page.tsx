'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DEMO_TREND = [
  { day: "Mon", revenue: 14200, expenses: 3100 },
  { day: "Tue", revenue: 18500, expenses: 4200 },
  { day: "Wed", revenue: 12100, expenses: 2800 },
  { day: "Thu", revenue: 21000, expenses: 5000 },
  { day: "Fri", revenue: 25400, expenses: 6100 },
  { day: "Sat", revenue: 32000, expenses: 8400 },
  { day: "Sun", revenue: 27900, expenses: 11300 },
].map(d => ({ ...d, profit: d.revenue - d.expenses }));

export default function DashboardPage() {
  const [storeName, setStoreName] = useState('');
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
      setStoreName(profile?.store_name || '');

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { data: sales } = await supabase
        .from('sales')
        .select('*, inventory(*)')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: false });

      if (sales) {
        setRecentSales(sales);
        const revenue = sales.reduce((sum, sale) => sum + Number(sale.revenue), 0);
        setTodayRevenue(revenue);
        setTodayTransactions(sales.length);
        
        const profit = sales.reduce((sum, sale) => {
          const cost = sale.inventory?.cost_price || 0;
          return sum + (Number(sale.revenue) - (sale.units_sold * cost));
        }, 0);
        setTodayProfit(profit);
      }

      const { data: inventory } = await supabase.from('inventory').select('*').eq('user_id', user.id);
      if (inventory) setLowStockCount(inventory.filter(i => i.stock < i.reorder_level).length);
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Dashboard" sub="Store Overview" />
      
      <div className="p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Today's Sales" value={`KES ${todayRevenue.toLocaleString()}`} sub="Revenue from shifts" accent="var(--color-teal)" />
          <StatCard label="Transactions" value={todayTransactions.toString()} sub="Items logged today" accent="var(--color-slate)" />
          <StatCard label="Low Stock Items" value={lowStockCount.toString()} sub="Review Situation Room" accent={lowStockCount > 0 ? "var(--color-red)" : "var(--color-amber)"} />
          <StatCard label="Est. Profit" value={`KES ${todayProfit.toLocaleString()}`} sub="Based on cost price" accent="var(--color-emerald)" />
        </div>

        <div className="grid md:grid-cols-[1fr_360px] gap-5 items-start">
          {/* Chart */}
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] shadow-sm">
            <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">Revenue · Expenses · Profit (Weekly Demo)</h2>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMO_TREND} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-lt)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                  <Tooltip 
                    formatter={(val: number, name: string) => [`KES ${val.toLocaleString()}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--color-line)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="expenses" stroke="var(--color-gold)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-emerald)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 text-[12px] font-semibold text-[var(--color-slate)] justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-teal)]" /> Revenue</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 border-t-2 border-dashed border-[var(--color-gold)]" /> Expenses</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-emerald)]" /> Profit</div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Recent Activity</h2>
              <div className="text-[11px] text-[var(--color-muted)]">Sales recorded today</div>
            </div>
            <div className="flex flex-col overflow-y-auto max-h-[300px]">
              {recentSales.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">No sales logged today.</div>
              ) : recentSales.map((sale, i) => (
                <div key={sale.id} className={`p-4 flex gap-3 ${i < recentSales.length - 1 ? 'border-b border-[var(--color-line-lt)]' : ''} hover:bg-[var(--color-canvas)] transition-colors`}>
                  <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] text-[var(--color-teal)] flex items-center justify-center font-bold text-[12px] shrink-0">
                    K
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-[var(--color-ink)] mb-0.5">
                      <span className="font-bold">{sale.inventory?.name || 'Unknown Item'}</span> sold
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
