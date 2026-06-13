'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<any>(null);
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
      setUserProfile(profile);
      setStoreName(profile?.store_name || '');

      // Get Today's boundaries
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Fetch Sales for Today
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
          const revenue = Number(sale.revenue);
          return sum + (revenue - (sale.units_sold * cost));
        }, 0);
        setTodayProfit(profit);
      }

      // Fetch Low Stock Items
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id);

      if (inventory) {
        const lowStock = inventory.filter(i => i.stock < i.reorder_level).length;
        setLowStockCount(lowStock);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div>
      <Topbar title="Dashboard" sub={userProfile?.role === 'admin' ? "Admin Access" : "Store Overview"} storeName={storeName || userProfile?.email?.split('@')[0]} />
      
      <div className="p-5 max-w-[1200px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Today's Sales" value={`KES ${todayRevenue.toLocaleString()}`} sub="Revenue from shifts" accent="var(--color-emerald)" />
          <StatCard label="Transactions" value={todayTransactions.toString()} sub="Items logged today" />
          <StatCard label="Low Stock Items" value={lowStockCount.toString()} sub="Review Situation Room" accent={lowStockCount > 0 ? "var(--color-red)" : "var(--color-amber)"} />
          <StatCard label="Est. Profit" value={`KES ${todayProfit.toLocaleString()}`} sub="Based on cost price" accent="var(--color-teal)" />
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-4">
          <div className="bg-white rounded-[16px] p-5 border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)]">
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-4">Sales Trend (Demo)</h2>
            <div className="h-[240px] flex items-end gap-2 text-[10px] text-[var(--color-muted)]">
              {/* Dummy chart bars for visualization since historical data might not exist yet */}
              {[40, 60, 30, 80, 100, 120, 50].map((h, i) => (
                <div key={i} className="flex-1 bg-[var(--color-teal-bg)] rounded-t-md relative group hover:bg-[var(--color-teal)] transition-colors" style={{ height: `${h}%` }}>
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-[var(--color-ink)] text-white px-2 py-1 rounded text-[10px] whitespace-nowrap transition-opacity">
                     KES {h * 100}
                   </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-[var(--color-slate)] font-semibold">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>

          <div className="bg-white rounded-[16px] p-5 border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)]">
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-4">Recent Activity</h2>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px]">
              {recentSales.length === 0 ? (
                <div className="text-[13px] text-[var(--color-muted)]">No sales logged today.</div>
              ) : recentSales.map(sale => (
                <div key={sale.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] text-[var(--color-teal)] flex items-center justify-center font-bold text-[12px] shrink-0">
                    S
                  </div>
                  <div>
                    <div className="text-[13px] text-[var(--color-ink)]">
                      <span className="font-bold">{sale.inventory?.name || 'Unknown Item'}</span> sold
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)]">{sale.units_sold} units · KES {sale.revenue}</div>
                    <div className="text-[10px] text-[var(--color-slate)] mt-1">
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
