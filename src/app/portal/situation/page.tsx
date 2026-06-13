'use client';

import { Topbar } from '@/components/Topbar';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type LowStockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorder_level: number;
  unit: string;
  sell_price: number;
};

export default function SituationRoomPage() {
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [outOfStock, setOutOfStock] = useState<LowStockItem[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const { data: inv } = await supabase.from('inventory').select('*').order('stock');
      if (inv) {
        setOutOfStock(inv.filter(i => i.stock === 0));
        setLowStock(inv.filter(i => i.stock > 0 && i.stock < i.reorder_level));
      }

      const { data: exp } = await supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(5);
      if (exp) setRecentExpenses(exp);

      setLoading(false);
    };
    fetchData();
  }, []);

  const totalAlerts = outOfStock.length + lowStock.length;

  return (
    <div>
      <Topbar title="Situation Room" sub="Live alerts and critical business signals" />
      <div className="p-4 max-w-[1000px] mx-auto">

        {/* Alert Banner */}
        {totalAlerts > 0 && !loading && (
          <div className="bg-[var(--color-red)] text-white rounded-[14px] p-4 mb-5 flex items-center gap-3">
            <span className="text-[28px]">⚠️</span>
            <div>
              <div className="font-bold text-[15px]">{totalAlerts} alert{totalAlerts > 1 ? 's' : ''} require your attention</div>
              <div className="text-[12px] text-white/80 mt-0.5">{outOfStock.length} out of stock · {lowStock.length} running low</div>
            </div>
          </div>
        )}

        {totalAlerts === 0 && !loading && (
          <div className="bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] rounded-[14px] p-4 mb-5 flex items-center gap-3">
            <span className="text-[28px]">✅</span>
            <div className="font-bold text-[15px]">All clear! No critical alerts right now.</div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Out of Stock */}
          <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)] flex items-center justify-between">
              <div>
                <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Out of Stock</div>
                <div className="text-[11px] text-[var(--color-muted)]">Items at zero units</div>
              </div>
              <div className="bg-[var(--color-red)] text-white text-[12px] font-bold px-3 py-1 rounded-full">{outOfStock.length}</div>
            </div>
            <div className="p-3 flex flex-col gap-2 max-h-[250px] overflow-y-auto">
              {loading ? <div className="text-[13px] text-[var(--color-muted)]">Loading…</div> :
               outOfStock.length === 0 ? <div className="text-[13px] text-[var(--color-muted)] py-2">No out-of-stock items 🎉</div> :
               outOfStock.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-[var(--color-red-bg)] rounded-[10px]">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--color-ink)]">{item.name}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">{item.category}</div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--color-red)]">0 {item.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock */}
          <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)] flex items-center justify-between">
              <div>
                <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Running Low</div>
                <div className="text-[11px] text-[var(--color-muted)]">Below reorder level</div>
              </div>
              <div className="bg-[var(--color-amber)] text-white text-[12px] font-bold px-3 py-1 rounded-full">{lowStock.length}</div>
            </div>
            <div className="p-3 flex flex-col gap-2 max-h-[250px] overflow-y-auto">
              {loading ? <div className="text-[13px] text-[var(--color-muted)]">Loading…</div> :
               lowStock.length === 0 ? <div className="text-[13px] text-[var(--color-muted)] py-2">All stock levels are healthy 👍</div> :
               lowStock.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-[var(--color-amber-bg)] rounded-[10px]">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--color-ink)]">{item.name}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">Reorder at {item.reorder_level} {item.unit}</div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--color-amber)]">{item.stock} {item.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Expenses */}
          <div className="md:col-span-2 bg-white rounded-[16px] border border-[var(--color-line-lt)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Recent Expenses</div>
              <div className="text-[11px] text-[var(--color-muted)]">Last 5 logged costs</div>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {loading ? <div className="text-[13px] text-[var(--color-muted)]">Loading…</div> :
               recentExpenses.length === 0 ? <div className="text-[13px] text-[var(--color-muted)] py-2">No expenses recorded yet.</div> :
               recentExpenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded-[10px]">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--color-ink)]">{exp.description}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">{exp.category} · {exp.date}</div>
                  </div>
                  <div className="text-[13px] font-bold text-[var(--color-red)]">KES {Number(exp.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
