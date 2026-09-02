'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { fmt } from '@/utils/format';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  sell_price: number;
  cost_price: number;
  stock: number;
  unit: string;
};

type SaleLog = {
  id: string;
  inventory_id: string;
  units_sold: number;
  revenue: number;
  created_at: string;
  product_name: string;
};

export default function SalesTrackerPage() {
  const { storeId, branchName } = useStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [saleLogs, setSaleLogs] = useState<SaleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('All');

  const [sel, setSel] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ opening: '', added: '', closing: '', wastage: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<'pos' | 'log' | 'history'>('pos');
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  // Pagination for sales history
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 50;

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAll = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();

    const curBranch = branchName || 'Main Branch';
    const [{ data: inv }, { data: logs }] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', storeId).eq('branch_name', curBranch).order('name'),
      supabase.from('sales')
        .select('id, inventory_id, units_sold, revenue, created_at, inventory(name)')
        .eq('user_id', storeId)
        .eq('branch_name', curBranch)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (inv) setItems(inv as InventoryItem[]);
    if (logs) {
      const mapped = logs.map((s: any) => ({
        id: s.id,
        inventory_id: s.inventory_id,
        units_sold: s.units_sold,
        revenue: s.revenue,
        created_at: s.created_at,
        product_name: s.inventory?.name || 'Unknown',
      }));
      setSaleLogs(mapped);

      // Auto-populate logged tags from today's sales so they persist across refresh
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLoggedIds = new Set(
        mapped.filter((s: SaleLog) => s.created_at.startsWith(todayStr))
             .map((s: SaleLog) => s.inventory_id)
      );
      setLoggedIds(todayLoggedIds);
    }
    setLoading(false);
  }, [storeId, branchName]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const cats = ['All', ...Array.from(new Set(items.map(p => p.category || 'General')))];
  const filtered = items.filter(p =>
    (catF === 'All' || (p.category || 'General') === catF) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase()))
  );

  const opening = parseInt(form.opening) || 0;
  const added = parseInt(form.added) || 0;
  const closing = parseInt(form.closing);
  const wastage = parseInt(form.wastage) || 0;
  const closingErr = !isNaN(closing) && closing > (opening + added);
  const canSave = sel && form.closing !== '' && !closingErr && !isNaN(closing);
  const units = (opening + added) - closing - wastage;
  const rev = sel ? units * sel.sell_price : 0;

  const handleSave = async () => {
    if (!canSave || !sel || !storeId) return;
    setSaving(true);
    const supabase = createClient();

    const newStock = closing;
    const { error: invErr } = await supabase.from('inventory').update({ stock: newStock }).eq('id', sel.id);

    if (!invErr && units > 0) {
      // created_at is auto-set by Supabase
      await supabase.from('sales').insert({
        user_id: storeId,
        inventory_id: sel.id,
        units_sold: units,
        revenue: rev,
        branch_name: branchName || 'Main Branch',
      });
    }

    if (!invErr) {
      setLoggedIds(prev => new Set([...prev, sel.id]));
      fire(`✓ ${sel.name} — ${units} units sold · ${fmt(rev)}`);
      setForm({ opening: '', added: '', closing: '', wastage: '' });
      setSel(null);
      setSearch('');
      fetchAll();
    } else {
      fire('⚠ Error saving. Please try again.');
    }
    setSaving(false);
  };

  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      if (ex) {
        if (ex.qty >= item.stock) return prev;
        return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      if (item.stock < 1) {
        fire('⚠ Out of stock');
        return prev;
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id !== id) return c;
      const newQty = c.qty + delta;
      if (newQty < 1 || newQty > c.item.stock) return c;
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.item.id !== id));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.item.sell_price * c.qty, 0);

  const handlePOSCheckout = async () => {
    if (cart.length === 0 || !storeId) return;
    setCheckingOut(true);
    const supabase = createClient();

    // Step 1: Verify stock is still available before processing
    const stockChecks = await Promise.all(
      cart.map(c =>
        supabase
          .from('inventory')
          .select('id, stock')
          .eq('id', c.item.id)
          .single()
      )
    );

    const stockError = stockChecks.find((r, i) => {
      const current = (r.data as { id: string; stock: number } | null)?.stock ?? 0;
      return current < cart[i].qty;
    });

    if (stockError) {
      fire('⚠ Stock changed while cart was open. Please review and retry.');
      fetchAll(); // Refresh to show latest stock
      setCheckingOut(false);
      return;
    }

    // Step 2: Deduct all stock based on verified live stock
    const deductions = cart.map((c, i) => {
      const liveStock = (stockChecks[i].data as { id: string; stock: number } | null)?.stock ?? c.item.stock;
      return supabase.from('inventory').update({ stock: Math.max(0, liveStock - c.qty) }).eq('id', c.item.id);
    });
    await Promise.all(deductions);

    // Step 3: Insert all sales in a single batch insert
    const salesData = cart.map(c => ({
      user_id: storeId,
      inventory_id: c.item.id,
      units_sold: c.qty,
      revenue: c.qty * c.item.sell_price,
      branch_name: branchName || 'Main Branch',
    }));

    const { error } = await supabase.from('sales').insert(salesData);

    if (error) {
      fire('⚠ Sale recorded but stock deducted — contact admin if totals mismatch.');
      console.error('Sales insert error:', error);
    } else {
      fire(`✓ Checkout successful! ${fmt(cartTotal)} collected.`);
      setCart([]);
      fetchAll();
    }
    setCheckingOut(false);
  };

  // Today's summary from logs
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = saleLogs.filter(s => s.created_at.startsWith(todayStr));
  const todayRevenue = todayLogs.reduce((sum, s) => sum + Number(s.revenue), 0);
  const todayUnits = todayLogs.reduce((sum, s) => sum + s.units_sold, 0);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Sales Tracker" sub="End-of-shift sales tracking and stock reconciliation" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* Today's summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Today's Revenue", val: fmt(todayRevenue), color: 'var(--color-teal)' },
            { label: "Units Sold Today", val: todayUnits.toString(), color: 'var(--color-ink)' },
            { label: "Sales Logged", val: todayLogs.length.toString(), color: 'var(--color-emerald)' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl p-3.5 border border-[var(--color-line-lt)] shadow-sm">
              <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">{k.label}</div>
              <div className="font-serif text-[18px] font-bold" style={{ color: k.color }}>{loading ? '—' : k.val}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pos')} className={`px-4 py-2 rounded-xl font-semibold text-[13px] border-[1.5px] transition-all cursor-pointer ${activeTab === 'pos' ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
            🛒 POS Checkout
          </button>
          <button onClick={() => setActiveTab('log')} className={`px-4 py-2 rounded-xl font-semibold text-[13px] border-[1.5px] transition-all cursor-pointer ${activeTab === 'log' ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
            📝 Log Shift
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl font-semibold text-[13px] border-[1.5px] transition-all cursor-pointer ${activeTab === 'history' ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
            📋 Sales History
          </button>
        </div>

        {/* ─── TAB: POS CHECKOUT ─── */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Left: Product Grid */}
            <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm flex flex-col min-h-[500px]">
              <div className="p-3 border-b border-[var(--color-line-lt)] flex gap-2.5 flex-wrap items-center">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                  className="flex-1 min-w-[140px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
                <select value={catF} onChange={e => setCatF(e.target.value)}
                  className="w-[140px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="col-span-full text-center text-[13px] text-[var(--color-muted)] p-10">Loading products...</div>
                ) : filtered.length === 0 ? (
                  <div className="col-span-full text-center text-[13px] text-[var(--color-muted)] p-10">No products found.</div>
                ) : (
                  filtered.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={p.stock < 1}
                      className={`text-left flex flex-col p-3 rounded-xl border-[1.5px] transition-all ${p.stock < 1 ? 'opacity-50 border-[var(--color-line-lt)] cursor-not-allowed bg-[var(--color-canvas)]' : 'border-[var(--color-line-lt)] hover:border-[var(--color-teal)] bg-white cursor-pointer hover:shadow-md'}`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate)] mb-1 truncate">{p.category || 'General'}</div>
                      <div className="font-semibold text-[13px] text-[var(--color-ink)] leading-tight mb-2 flex-1">{p.name}</div>
                      <div className="flex justify-between items-end w-full mt-auto">
                        <div className="font-bold text-[14px] text-[var(--color-teal)]">{fmt(p.sell_price)}</div>
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.stock < 10 ? 'bg-[var(--color-red-bg)] text-[var(--color-red)]' : 'bg-[var(--color-canvas)] text-[var(--color-slate)]'}`}>
                          {p.stock} left
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: Cart */}
            <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm sticky top-[80px] flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
                <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)] flex justify-between">
                  <span>Current Sale</span>
                  <span className="text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2 rounded-full text-[13px]">{cart.length} items</span>
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {cart.length === 0 ? (
                  <div className="text-center text-[13px] text-[var(--color-muted)] p-10 flex flex-col items-center gap-3">
                    <span className="text-[40px]">🛒</span>
                    Cart is empty.<br/>Tap products to add them.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {cart.map(c => (
                      <div key={c.item.id} className="p-3 border-b border-[var(--color-line-lt)] last:border-0 flex gap-2 items-center">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{c.item.name}</div>
                          <div className="text-[12px] text-[var(--color-teal)]">{fmt(c.item.sell_price)}</div>
                        </div>
                        <div className="flex items-center gap-2 bg-[var(--color-canvas)] rounded-lg p-1 border border-[var(--color-line-lt)]">
                          <button onClick={() => updateCartQty(c.item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded text-[16px] font-bold border border-[var(--color-line-lt)] text-[var(--color-slate)] hover:text-[var(--color-ink)] cursor-pointer">−</button>
                          <span className="text-[13px] font-bold w-4 text-center">{c.qty}</span>
                          <button onClick={() => updateCartQty(c.item.id, 1)} disabled={c.qty >= c.item.stock} className="w-6 h-6 flex items-center justify-center bg-white rounded text-[16px] font-bold border border-[var(--color-line-lt)] text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-50 cursor-pointer">+</button>
                        </div>
                        <button onClick={() => removeFromCart(c.item.id)} className="w-8 h-8 flex items-center justify-center text-[var(--color-red)] bg-[var(--color-red-bg)] rounded-lg hover:bg-[var(--color-red)] hover:text-white transition-colors cursor-pointer">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-[var(--color-line-lt)] bg-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[14px] font-bold text-[var(--color-slate)]">Total</span>
                  <span className="font-serif text-[24px] font-bold text-[var(--color-teal)]">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={handlePOSCheckout}
                  disabled={cart.length === 0 || checkingOut}
                  className="w-full py-3.5 rounded-xl border-none font-bold text-[15px] transition-all flex items-center justify-center gap-2 bg-[var(--color-teal)] text-white shadow-[0_4px_14px_rgba(10,92,107,0.25)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {checkingOut ? 'Processing...' : 'Charge ' + fmt(cartTotal)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: LOG SALE ─── */}
        {activeTab === 'log' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Product list */}
            <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
              <div className="p-3 border-b border-[var(--color-line-lt)] flex gap-2.5 flex-wrap items-center">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                  className="flex-1 min-w-[140px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
                <select value={catF} onChange={e => setCatF(e.target.value)}
                  className="w-[140px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* ─── MOBILE CARD VIEW (< md) ─── */}
              <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading products…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">No products found. Add them in the Catalogue.</div>
                ) : filtered.map(p => {
                  const isSel = sel?.id === p.id;
                  const isLogged = loggedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isLogged) {
                          setSel(p);
                          setForm({ opening: '', added: '', closing: '', wastage: '' });
                          setLoggedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                        } else {
                          setSel(p);
                          setForm({ opening: String(p.stock), added: '', closing: '', wastage: '' });
                        }
                      }}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isLogged ? 'bg-[var(--color-emerald-bg)]/40' : isSel ? 'bg-[#f0f7f8] border-l-4 border-[var(--color-teal)]' : 'bg-white hover:bg-[var(--color-canvas)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13px] text-[var(--color-ink)] truncate">{p.name}</span>
                          {isLogged && (
                            <span className="text-[9px] font-bold bg-[var(--color-emerald)] text-white px-1.5 py-0.2 rounded-full shrink-0">
                              ✓ Logged
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
                          <span>{p.category || 'General'}</span>
                          <span>·</span>
                          <span className={p.stock < 10 ? 'text-[var(--color-red)] font-semibold' : 'text-[var(--color-slate)]'}>
                            {p.stock} {p.unit}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-[13px] text-[var(--color-ink)]">{fmt(p.sell_price)}</div>
                        <span className={`inline-block text-[11px] font-bold mt-1 px-2.5 py-1 rounded-md transition-all ${
                          isSel ? 'bg-[var(--color-teal)] text-white' : 'bg-[var(--color-teal-bg)] text-[var(--color-teal)]'
                        }`}>
                          {isSel ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── DESKTOP DATA TABLE (md+) ─── */}
              <div className="hidden md:block overflow-auto max-h-[70vh]">
                <table className="w-full border-collapse" style={{ minWidth: 420 }}>
                  <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                    <tr className="bg-[var(--color-canvas)]">
                      {['Product', 'Category', 'Sell Price', 'Stock', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading products…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No products found. Add them in the Catalogue.</td></tr>
                    ) : filtered.map(p => {
                      const isSel = sel?.id === p.id;
                      const isLogged = loggedIds.has(p.id);
                      return (
                        <tr key={p.id} className={`border-b border-[var(--color-line-lt)] last:border-0 transition-colors ${
                          isLogged ? 'bg-[var(--color-emerald-bg)]/60' : isSel ? 'bg-[#f0f7f8]' : 'hover:bg-[#fafafa]'
                        }`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[13px] text-[var(--color-ink)]">{p.name}</span>
                              {isLogged && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[var(--color-emerald)] text-white px-2 py-0.5 rounded-full">
                                  ✓ Logged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-bold text-[var(--color-ink)]">{fmt(p.sell_price)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[13px] font-semibold ${p.stock < 10 ? 'text-[var(--color-red)]' : 'text-[var(--color-slate)]'}`}>
                              {p.stock} <span className="text-[11px] font-normal">{p.unit}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isLogged ? (
                              <button
                                onClick={() => { setSel(p); setForm({ opening: '', added: '', closing: '', wastage: '' }); setLoggedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }); }}
                                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border bg-white text-[var(--color-emerald)] border-[var(--color-emerald)]/30 hover:bg-[var(--color-emerald-bg)] transition-all"
                              >
                                Re-log
                              </button>
                            ) : (
                              <button
                                onClick={() => { setSel(p); setForm({ opening: String(p.stock), added: '', closing: '', wastage: '' }); }}
                                className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border transition-all ${isSel ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]' : 'bg-[var(--color-teal-bg)] text-[var(--color-teal)] border-[var(--color-teal)]/20 hover:bg-[var(--color-teal)] hover:text-white'}`}
                              >
                                {isSel ? '✓ Selected' : 'Log Stock'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Logging form */}
            <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm sticky top-[80px]">
              <div className={`p-4 border-b border-[var(--color-line-lt)] transition-colors ${sel ? 'bg-[#f0f7f8]' : 'bg-[var(--color-canvas)]'}`}>
                <div className={`font-serif text-[15px] font-bold ${sel ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)]'}`}>
                  {sel ? `📦 ${sel.name}` : 'Select a product to log'}
                </div>
                {sel && (
                  <div className="text-[12px] text-[var(--color-teal)] mt-1 font-medium">
                    Sell: {fmt(sel.sell_price)}{sel.cost_price > 0 ? ` · Cost: ${fmt(sel.cost_price)}` : ''}
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3">
                {[
                  { key: 'opening', label: 'Opening Stock', hint: 'Auto-filled', locked: true },
                  { key: 'added', label: 'Stock Added', hint: 'Restocked this shift' },
                  { key: 'closing', label: 'Closing Stock', hint: 'Count at end of shift', err: closingErr },
                  { key: 'wastage', label: 'Wastage / Spillage', hint: 'Damaged or wasted' },
                ].map(f => (
                  <div key={f.key}>
                    <label className={`block text-[12px] font-bold mb-1 ${f.err ? 'text-[var(--color-red)]' : 'text-[var(--color-slate)]'}`}>
                      {f.label} {f.locked && <span className="font-normal text-[var(--color-muted)]">(auto-filled)</span>}
                    </label>
                    <input
                      type="number" min="0" placeholder="0"
                      value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      disabled={!sel || f.locked}
                      className={`w-full px-3 py-2 border-[1.5px] rounded-lg text-[15px] outline-none transition-all ${f.err ? 'border-[var(--color-red)] text-[var(--color-red)]' : 'border-[var(--color-line)] text-[var(--color-ink)] focus:border-[var(--color-teal)]'} ${f.locked ? 'bg-[var(--color-canvas)]' : 'bg-white'} ${!sel ? 'opacity-50' : ''}`}
                    />
                    {f.err
                      ? <div className="text-[11px] text-[var(--color-red)] mt-1 font-medium">⚠ Cannot exceed opening + added</div>
                      : <div className="text-[11px] text-[var(--color-muted)] mt-1">{f.hint}</div>}
                  </div>
                ))}

                {sel && form.closing !== '' && !closingErr && !isNaN(closing) && (
                  <div className="mt-2 bg-[#f0f7f8] rounded-xl p-3.5 border-[1.5px] border-[var(--color-teal)]/20">
                    <div className="text-[10px] font-bold text-[var(--color-teal)] uppercase tracking-[0.08em] mb-1.5">Auto-Calculation</div>
                    <div className="text-[11px] text-[var(--color-slate)] font-mono mb-1">
                      ({form.opening || 0} + {form.added || 0}) − {form.closing} − {form.wastage || 0}
                    </div>
                    <div className="font-serif text-[24px] font-bold text-[var(--color-ink)]">
                      {units} <span className="text-[13px] font-normal text-[var(--color-slate)] font-sans">units sold</span>
                    </div>
                    <div className="text-[15px] font-bold text-[var(--color-teal)] mt-1">
                      {fmt(rev)} <span className="text-[11px] text-[var(--color-teal)]/70 font-normal">revenue</span>
                    </div>
                    {sel.cost_price > 0 && (
                      <div className="text-[12px] font-semibold text-[var(--color-emerald)] mt-1.5">
                        Margin: {fmt(units * (sel.sell_price - sel.cost_price))} profit
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className={`mt-2 py-3 rounded-xl border-none font-bold text-[14px] transition-all ${canSave && !saving ? 'bg-[var(--color-teal)] text-white cursor-pointer shadow-[0_4px_14px_rgba(10,92,107,0.25)] hover:opacity-90' : 'bg-[var(--color-line-lt)] text-[var(--color-muted)] cursor-not-allowed'}`}>
                  {saving ? 'Saving...' : 'Save & Log Sale'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: SALES HISTORY ─── */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
            <div className="p-3.5 border-b border-[var(--color-line-lt)] flex justify-between items-center flex-wrap gap-2">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">Sales History</span>
              <span className="text-[12px] text-[var(--color-muted)]">
                {saleLogs.length} total transactions · timestamps auto-recorded
              </span>
            </div>
            {/* ─── MOBILE CARD VIEW (< md) ─── */}
            <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading…</div>
              ) : saleLogs.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[var(--color-muted)]">No sales recorded yet.</div>
              ) : saleLogs
                  .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                  .map(s => (
                <div key={s.id} className="p-3.5 flex justify-between items-center bg-white hover:bg-[var(--color-canvas)] transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <div className="font-semibold text-[13px] text-[var(--color-ink)]">{s.product_name}</div>
                    <div className="text-[11px] text-[var(--color-muted)]">
                      {new Date(s.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} · {new Date(s.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[12px] text-[var(--color-slate)] font-medium mt-0.5">{s.units_sold} units sold</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-[15px] font-bold text-[var(--color-teal)]">{fmt(Number(s.revenue))}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── DESKTOP DATA TABLE (md+) ─── */}
            <div className="hidden md:block overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                  <tr className="bg-[var(--color-canvas)]">
                    {['Date & Time', 'Product', 'Units Sold', 'Revenue'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading…</td></tr>
                  ) : saleLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No sales recorded yet.</td></tr>
                  ) : saleLogs
                      .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                      .map(s => (
                    <tr key={s.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-muted)]">
                        <div>{new Date(s.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[11px] opacity-70">{new Date(s.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[13px] text-[var(--color-ink)]">{s.product_name}</td>
                      <td className="px-4 py-2.5 text-[13px] text-[var(--color-slate)]">{s.units_sold}</td>
                      <td className="px-4 py-2.5 font-serif text-[14px] font-bold text-[var(--color-teal)]">{fmt(Number(s.revenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {saleLogs.length > HISTORY_PAGE_SIZE && (
              <div className="p-3 border-t border-[var(--color-line-lt)] flex items-center justify-between gap-2">
                <button
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(p => p - 1)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-slate)] bg-white hover:bg-[var(--color-canvas)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="text-[12px] text-[var(--color-muted)]">
                  Page {historyPage} of {Math.ceil(saleLogs.length / HISTORY_PAGE_SIZE)}
                </span>
                <button
                  disabled={historyPage >= Math.ceil(saleLogs.length / HISTORY_PAGE_SIZE)}
                  onClick={() => setHistoryPage(p => p + 1)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-slate)] bg-white hover:bg-[var(--color-canvas)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
