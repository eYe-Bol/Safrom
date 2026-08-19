'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

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

const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;

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
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAll = async () => {
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
  };

  useEffect(() => { fetchAll(); }, [storeId, branchName]);

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

  // Today's summary from logs
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = saleLogs.filter(s => s.created_at.startsWith(todayStr));
  const todayRevenue = todayLogs.reduce((sum, s) => sum + Number(s.revenue), 0);
  const todayUnits = todayLogs.reduce((sum, s) => sum + s.units_sold, 0);

  return (
    <div className="flex flex-col min-h-screen pb-10">
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
          <button onClick={() => setActiveTab('log')} className={`px-4 py-2 rounded-xl font-semibold text-[13px] border-[1.5px] transition-all cursor-pointer ${activeTab === 'log' ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
            📝 Log Sale
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl font-semibold text-[13px] border-[1.5px] transition-all cursor-pointer ${activeTab === 'history' ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
            📋 Sales History
          </button>
        </div>

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

              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 420 }}>
                  <thead>
                    <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
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
              <span className="text-[12px] text-[var(--color-muted)]">Last 100 transactions · timestamps auto-recorded</span>
            </div>
            {/* Responsive Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                <thead>
                  <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
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
                  ) : saleLogs.map(s => (
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
          </div>
        )}

      </div>
    </div>
  );
}
