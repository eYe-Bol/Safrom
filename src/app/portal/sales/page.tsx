'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  sell_price: number;
  cost_price: number;
  stock: number;
  unit: string;
};

const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catF, setCatF] = useState("All");
  
  const [sel, setSel] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ opening: "", added: "", closing: "", wastage: "" });
  const [saved, setSaved] = useState<Record<string, {units: number, rev: number}>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchInventory = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase.from('inventory').select('*').eq('user_id', user.id).order('name');
    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const cats = ["All", ...Array.from(new Set(items.map(p => p.category || 'General')))];
  const filtered = items.filter(p => 
    (catF === "All" || (p.category || 'General') === catF) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase()))
  );

  const opening = parseInt(form.opening) || 0;
  const added   = parseInt(form.added)   || 0;
  const closing = parseInt(form.closing);
  const wastage = parseInt(form.wastage) || 0;
  const closingErr = !isNaN(closing) && closing > (opening + added);
  const canSave = sel && form.closing !== "" && !closingErr && !isNaN(closing);
  
  const units = (opening + added) - closing - wastage;
  const rev = sel ? units * sel.sell_price : 0;

  const handleSave = async () => {
    if (!canSave || !sel) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Update inventory stock to the new closing amount
    const newStock = closing;
    const { error: invErr } = await supabase.from('inventory').update({ stock: newStock }).eq('id', sel.id);

    // 2. Log sale if units > 0
    if (!invErr && units > 0) {
      await supabase.from('sales').insert({
        user_id: user.id,
        inventory_id: sel.id,
        units_sold: units,
        revenue: rev
      });
    }

    if (!invErr) {
      setSaved(p => ({ ...p, [sel.id]: { units, rev } }));
      
      // Update local state so we don't need to refetch everything immediately
      setItems(items.map(i => i.id === sel.id ? { ...i, stock: newStock } : i));
      
      fire(`✓ ${sel.name} — ${units} units sold · ${fmt(rev)}`);
      setForm({ opening: "", added: "", closing: "", wastage: "" });
      setSel(null);
      setSearch("");
    } else {
      fire('⚠ Error saving stock. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Sales Log" sub="End-of-shift sales tracking and stock reconciliation" />
      
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      <div className="p-5 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        
        {/* Left Col: Products Table */}
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
            <table className="w-full border-collapse" style={{ minWidth: 400 }}>
              <thead>
                <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
                  {['Product','Cat','Sell Price','Stock',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading products…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No products found. Add them in the Catalogue.</td></tr>
                ) : filtered.map(p => {
                  const isLogged = !!saved[p.id];
                  const isSel = sel?.id === p.id;
                  
                  return (
                    <tr key={p.id} className={`border-b border-[var(--color-line-lt)] last:border-0 transition-colors ${isSel ? 'bg-[#f0f7f8]' : isLogged ? 'bg-[#FAFFF8]' : 'hover:bg-[#fafafa]'}`}>
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]">{p.name}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-slate)]">{fmt(p.sell_price)}</td>
                      <td className={`px-3 py-2.5 text-[12px] ${p.stock < 10 ? 'font-bold text-[var(--color-red)]' : 'text-[var(--color-slate)]'}`}>
                        {p.stock} <span className="hidden sm:inline">{p.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isLogged ? (
                          <span className="text-[12px] font-bold text-[var(--color-emerald)]">✓ Logged</span>
                        ) : (
                          <button 
                            onClick={() => {
                              setSel(p);
                              setForm({ opening: String(p.stock), added: "", closing: "", wastage: "" });
                            }}
                            className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border transition-all ${isSel ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]' : 'bg-[var(--color-teal-bg)] text-[var(--color-teal)] border-[var(--color-teal)]/20 hover:bg-[var(--color-teal)] hover:text-white'}`}>
                            {isSel ? "Selected ✓" : "Log Stock"}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Logging Form */}
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm sticky top-[80px]">
          <div className={`p-4 border-b border-[var(--color-line-lt)] transition-colors ${sel ? 'bg-[#f0f7f8]' : 'bg-[var(--color-canvas)]'}`}>
            <div className={`font-serif text-[15px] font-bold ${sel ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)]'}`}>
              {sel ? `📦 ${sel.name}` : "Select a product to log"}
            </div>
            {sel && (
              <div className="text-[12px] text-[var(--color-teal)] mt-1 font-medium">
                Sell: {fmt(sel.sell_price)} · Cost: {fmt(sel.cost_price)}
              </div>
            )}
          </div>
          
          <div className="p-4 flex flex-col gap-3">
            {[
              { key: "opening", label: "Opening Stock", hint: "Auto-filled", locked: true },
              { key: "added", label: "Stock Added", hint: "Restocked this shift" },
              { key: "closing", label: "Closing Stock", hint: "Count at end of shift", err: closingErr },
              { key: "wastage", label: "Wastage / Spillage", hint: "Damaged or wasted" },
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
                {f.err ? (
                  <div className="text-[11px] text-[var(--color-red)] mt-1 font-medium">⚠ Cannot exceed opening + added</div>
                ) : (
                  <div className="text-[11px] text-[var(--color-muted)] mt-1">{f.hint}</div>
                )}
              </div>
            ))}

            {sel && form.closing !== "" && !closingErr && !isNaN(closing) && (
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
              {saving ? 'Saving...' : 'Save & Log Sales'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
