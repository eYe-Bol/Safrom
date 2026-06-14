'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder_level: number;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('inventory').select('*').eq('user_id', user.id).order('name');
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const updateStock = async (id: string, currentStock: number, change: number) => {
    const newStock = Math.max(0, currentStock + change);
    if (newStock === currentStock) return;
    
    setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
    
    const supabase = createClient();
    await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
    fire('✓ Stock updated');
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Inventory" sub="Real-time stock levels and fast restocking" />
      
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      <div className="p-5 max-w-[1000px] mx-auto w-full flex flex-col gap-4">
        
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">Total Products</div>
            <div className="font-serif text-[20px] font-bold text-[var(--color-ink)]">{products.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">Total Items in Stock</div>
            <div className="font-serif text-[20px] font-bold text-[var(--color-teal)]">
              {products.reduce((acc, p) => acc + p.stock, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">Low Stock Alerts</div>
            <div className="font-serif text-[20px] font-bold text-[var(--color-amber)]">
              {products.filter(p => p.stock > 0 && p.stock <= p.reorder_level).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">Out of Stock</div>
            <div className="font-serif text-[20px] font-bold text-[var(--color-red)]">
              {products.filter(p => p.stock === 0).length}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
          <div className="p-3 border-b border-[var(--color-line-lt)] flex gap-2 flex-wrap items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
              className="flex-1 min-w-[130px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <div className="hidden md:grid grid-cols-4 gap-2 border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)] px-4 py-2.5 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">
              <div>Product</div>
              <div>Status</div>
              <div className="text-center">Stock Level</div>
              <div className="text-center">Quick Adjust</div>
            </div>
            
            {loading ? (
              <div className="text-center py-8 text-[13px] text-[var(--color-muted)]">Loading stock...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-[var(--color-muted)]">No products found. Add products in the Catalogue.</div>
            ) : filtered.map(p => {
              const isOut = p.stock === 0;
              const isLow = !isOut && p.stock <= p.reorder_level;
              
              return (
                <div key={p.id} className="flex flex-col md:grid md:grid-cols-4 gap-3 md:gap-2 items-start md:items-center px-4 py-4 md:py-3 border-b border-[var(--color-line-lt)] hover:bg-[#fafafa] last:border-0">
                  
                  <div className="flex flex-col w-full md:w-auto">
                    <div className="flex justify-between md:block items-center w-full">
                      <div>
                        <div className="font-semibold text-[14px] md:text-[13px] text-[var(--color-ink)]">{p.name}</div>
                        <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider">{p.category}</div>
                      </div>
                      
                      <div className="md:hidden">
                        {isOut ? (
                          <span className="bg-[var(--color-red-bg)] text-[var(--color-red)] text-[10px] font-bold px-2 py-1 rounded-full">OUT OF STOCK</span>
                        ) : isLow ? (
                          <span className="bg-[var(--color-amber-bg)] text-[var(--color-amber)] text-[10px] font-bold px-2 py-1 rounded-full">LOW STOCK</span>
                        ) : (
                          <span className="bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] text-[10px] font-bold px-2 py-1 rounded-full">IN STOCK</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    {isOut ? (
                      <span className="bg-[var(--color-red-bg)] text-[var(--color-red)] text-[10px] font-bold px-2 py-1 rounded-full">OUT OF STOCK</span>
                    ) : isLow ? (
                      <span className="bg-[var(--color-amber-bg)] text-[var(--color-amber)] text-[10px] font-bold px-2 py-1 rounded-full">LOW STOCK</span>
                    ) : (
                      <span className="bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] text-[10px] font-bold px-2 py-1 rounded-full">IN STOCK</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-center w-full md:w-auto mt-2 md:mt-0">
                    <span className="md:hidden text-[12px] font-bold text-[var(--color-slate)] uppercase">Stock</span>
                    <div className="font-serif text-[18px] font-bold text-[var(--color-ink)]">{p.stock} <span className="font-sans text-[11px] text-[var(--color-muted)] font-normal">{p.unit}</span></div>
                  </div>

                  <div className="flex items-center justify-between md:justify-center w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-[var(--color-line-lt)] md:border-0">
                    <span className="md:hidden text-[12px] font-bold text-[var(--color-slate)] uppercase">Adjust</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateStock(p.id, p.stock, -1)} className="w-9 h-9 md:w-8 md:h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[15px] md:text-[14px] font-bold hover:bg-[var(--color-red-bg)] hover:text-[var(--color-red)] hover:border-[var(--color-red-bg)] flex items-center justify-center transition-colors">-1</button>
                      <button onClick={() => updateStock(p.id, p.stock, 1)} className="w-9 h-9 md:w-8 md:h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[15px] md:text-[14px] font-bold hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)] hover:border-[var(--color-teal-bg)] flex items-center justify-center transition-colors">+1</button>
                      <button onClick={() => updateStock(p.id, p.stock, 10)} className="w-9 h-9 md:w-8 md:h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[12px] font-bold hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)] hover:border-[var(--color-teal-bg)] flex items-center justify-center transition-colors">+10</button>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
