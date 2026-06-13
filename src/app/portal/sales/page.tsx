'use client';

import { Topbar } from '@/components/Topbar';
import { Chip } from '@/components/Chip';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  sell_price: number;
  cost_price: number;
  stock: number;
};

export default function SalesPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  
  const [form, setForm] = useState({ added: "", closing: "", wastage: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error'|'success', text: string } | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('inventory').select('*').order('name');
    if (data) setItems(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filtered = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  const opening = selected?.stock || 0;
  const added = parseFloat(form.added) || 0;
  const closing = parseFloat(form.closing) || 0;
  const wastage = parseFloat(form.wastage) || 0;
  
  const unitsSold = Math.max(0, (opening + added) - closing - wastage);
  const revenue = selected ? unitsSold * selected.sell_price : 0;
  const closingErr = form.closing !== "" && closing > (opening + added);
  const canSave = selected && form.closing !== "" && !closingErr && ((opening + added) - closing - wastage) >= 0;

  const handleSave = async () => {
    if (!canSave || !selected) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: 'error', text: 'Authentication error' });
      setSaving(false);
      return;
    }

    // 1. Insert into Sales
    const { error: salesError } = await supabase.from('sales').insert({
      user_id: user.id,
      inventory_id: selected.id,
      units_sold: unitsSold,
      revenue: revenue
    });

    if (salesError) {
      setMessage({ type: 'error', text: salesError.message });
      setSaving(false);
      return;
    }

    // 2. Update Inventory Stock
    const { error: invError } = await supabase.from('inventory').update({
      stock: closing
    }).eq('id', selected.id);

    if (invError) {
      setMessage({ type: 'error', text: invError.message });
      setSaving(false);
      return;
    }

    setMessage({ type: 'success', text: `✓ ${selected.name} logged: ${unitsSold} units sold.` });
    
    // Reset state
    setForm({ added: "", closing: "", wastage: "" });
    setSelected(null);
    setSearch("");
    fetchInventory();
    setSaving(false);
  };

  return (
    <div>
      <Topbar title="Sales & Stock Logging" sub="Log end-of-shift stock to auto-calculate daily sales" />
      
      <div className="p-5 max-w-[1200px] mx-auto grid md:grid-cols-[1fr_400px] gap-5 items-start">
        {/* Left Column: Product Selection */}
        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-line-lt)]">
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search products to log…"
              className="w-full py-[8px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--color-teal)]"
            />
          </div>
          
          <div className="overflow-y-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                  {["Product", "Cat", "Price", "Current Stock", ""].map(h => (
                    <th key={h} className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No products found.</td></tr>
                ) : filtered.map(p => {
                  const isSel = selected?.id === p.id;
                  return (
                    <tr key={p.id} className={`border-b border-[var(--color-line-lt)] hover:bg-[var(--color-teal-bg)] transition-colors ${isSel ? 'bg-[var(--color-teal-bg)]' : ''}`}>
                      <td className="p-3 text-[13px] font-semibold text-[var(--color-ink)]">{p.name}</td>
                      <td className="p-3"><Chip label={p.category} color="var(--color-slate)" bg="var(--color-canvas)"/></td>
                      <td className="p-3 text-[12px] font-bold text-[var(--color-ink)]">KES {p.sell_price}</td>
                      <td className="p-3 text-[12px] text-[var(--color-slate)]">{p.stock} {p.unit}</td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => { setSelected(p); setForm({ added: "", closing: "", wastage: "" }); setMessage(null); }}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-[8px] ${isSel ? 'bg-[var(--color-teal)] text-white' : 'bg-[var(--color-teal-bg)] text-[var(--color-teal)] hover:opacity-80'}`}
                        >
                          {isSel ? "Selected ✓" : "Log Shift"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Logging Form */}
        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)] overflow-hidden sticky top-[20px]">
          <div className={`p-4 border-b border-[var(--color-line-lt)] ${selected ? 'bg-[var(--color-teal-bg)]' : 'bg-[var(--color-canvas)]'}`}>
            <div className={`font-serif text-[16px] font-bold ${selected ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)]'}`}>
              {selected ? `📦 ${selected.name}` : "Select a product to log"}
            </div>
            {selected && (
              <div className="text-[12px] text-[var(--color-teal)] mt-1 font-semibold">
                Sell: KES {selected.sell_price} · Cost: KES {selected.cost_price}
              </div>
            )}
          </div>
          
          <div className="p-5 flex flex-col gap-4">
            <div>
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Opening Stock <span className="font-normal text-[var(--color-muted)]">(auto-filled)</span></label>
              <input type="number" disabled value={opening} className="w-full p-[10px] bg-[var(--color-canvas)] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[14px] outline-none text-[var(--color-ink)]" />
            </div>
            
            <div>
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Stock Added <span className="font-normal text-[var(--color-muted)]">(restocked this shift)</span></label>
              <input type="number" disabled={!selected} value={form.added} onChange={e => setForm({ ...form, added: e.target.value })} placeholder="0" className="w-full p-[10px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[14px] outline-none focus:border-[var(--color-teal)]" />
            </div>

            <div>
              <label className={`text-[12px] font-bold ${closingErr ? 'text-[var(--color-red)]' : 'text-[var(--color-slate)]'} block mb-1`}>Closing Stock <span className="font-normal text-[var(--color-muted)]">(count at end of shift)</span></label>
              <input type="number" disabled={!selected} value={form.closing} onChange={e => setForm({ ...form, closing: e.target.value })} placeholder="0" className={`w-full p-[10px] border-[1.5px] ${closingErr ? 'border-[var(--color-red)] text-[var(--color-red)]' : 'border-[var(--color-line)] focus:border-[var(--color-teal)]'} rounded-[8px] text-[14px] outline-none`} />
              {closingErr && <div className="text-[11px] text-[var(--color-red)] mt-1">⚠ Cannot exceed opening + added</div>}
            </div>

            <div>
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Wastage / Spillage <span className="font-normal text-[var(--color-muted)]">(damaged items)</span></label>
              <input type="number" disabled={!selected} value={form.wastage} onChange={e => setForm({ ...form, wastage: e.target.value })} placeholder="0" className="w-full p-[10px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[14px] outline-none focus:border-[var(--color-teal)]" />
            </div>

            {selected && form.closing !== "" && !closingErr && (
              <div className="bg-[var(--color-teal-bg)] rounded-[12px] p-4 border border-[var(--color-teal)]/20 mt-2">
                <div className="text-[10px] font-bold text-[var(--color-teal)] uppercase tracking-[0.08em] mb-1">Auto-Calculation</div>
                <div className="text-[10px] text-[var(--color-slate)] font-mono mb-2">
                  ({opening} + {added}) - {closing} - {wastage}
                </div>
                <div className="font-serif text-[24px] font-bold text-[var(--color-ink)]">
                  {unitsSold} <span className="text-[13px] font-normal text-[var(--color-slate)]">units sold</span>
                </div>
                <div className="text-[15px] font-bold text-[var(--color-teal)] mt-1">
                  KES {revenue} <span className="text-[11px] font-normal text-[var(--color-muted)]">revenue</span>
                </div>
                {selected.cost_price > 0 && (
                  <div className="text-[12px] text-[var(--color-emerald)] mt-1 font-semibold">
                    Margin: KES {unitsSold * (selected.sell_price - selected.cost_price)} profit
                  </div>
                )}
              </div>
            )}

            {message && (
              <div className={`text-[12px] font-bold py-[8px] px-[12px] rounded-[8px] ${message.type === 'error' ? 'bg-[var(--color-red-bg)] text-[var(--color-red)]' : 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]'}`}>
                {message.text}
              </div>
            )}

            <button 
              onClick={handleSave} 
              disabled={!canSave || saving}
              className={`w-full py-[12px] rounded-[10px] font-bold text-[14px] mt-2 transition-all ${canSave ? 'bg-[var(--color-teal)] text-white shadow-[0_4px_14px_rgba(10,92,107,0.27)] hover:opacity-90 cursor-pointer' : 'bg-[var(--color-line-lt)] text-[var(--color-muted)] cursor-not-allowed'}`}
            >
              {saving ? "Saving..." : "Save & Log Sales"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
