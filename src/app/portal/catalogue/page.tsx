'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

type Product = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  unit: string;
  sell_price: number;
  cost_price: number;
  reorder_level: number;
  stock: number;
};

const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;
const margin = (p: Product) =>
  p.sell_price > 0 && p.cost_price > 0
    ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100)
    : null;

const BLANK = { name: '', category: '', supplier: '', unit: 'pcs', sell_price: '', cost_price: '', reorder_level: '' };

export default function CataloguePage() {
  const { storeId } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(BLANK);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const [{ data: prods }, { data: sups }] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', storeId).order('name'),
      supabase.from('suppliers').select('name').eq('user_id', storeId),
    ]);
    if (prods) setProducts(prods);
    if (sups) setSupplierNames(sups.map((s: any) => s.name));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [storeId]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || 'General')))];
  const filtered = products.filter(p =>
    (catFilter === 'All' || (p.category || 'General') === catFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAdd(true); };
  const openEdit = (p: Product) => {
    setForm({ name: p.name, category: p.category, supplier: p.supplier, unit: p.unit,
      sell_price: String(p.sell_price), cost_price: p.cost_price > 0 ? String(p.cost_price) : '', reorder_level: String(p.reorder_level) });
    setEditItem(p); setShowAdd(true);
  };

  const save = async () => {
    if (!form.name || !form.sell_price) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !storeId) return;
    const entry = {
      user_id: storeId!,
      name: form.name,
      category: form.category || 'General',
      supplier: form.supplier || 'N/A',
      unit: form.unit || 'pcs',
      sell_price: parseFloat(form.sell_price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
      reorder_level: parseInt(form.reorder_level) || 0,
    };
    if (editItem) {
      await supabase.from('inventory').update(entry).eq('id', editItem.id);
      fire(`✓ ${form.name} updated`);
    } else {
      await supabase.from('inventory').insert([{ ...entry, stock: 0 }]);
      fire(`✓ ${form.name} added to catalogue`);
    }
    setShowAdd(false); setEditItem(null); setSaving(false);
    loadData();
  };

  const del = async (p: Product) => {
    if (!confirm(`Remove "${p.name}" from catalogue?`)) return;
    const supabase = createClient();
    await supabase.from('inventory').delete().eq('id', p.id);
    fire(`${p.name} removed`);
    loadData();
  };

  const marginColor = (m: number) => m >= 30 ? '#1A7A4A' : m >= 15 ? '#D97706' : '#C0392B';
  const marginBg = (m: number) => m >= 30 ? '#E8F5EE' : m >= 15 ? '#FFFBEB' : '#FDF0EE';

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Product Catalogue" sub="Manage products, prices, and reorder levels" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-[var(--color-line-lt)] flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">All Products</span>
              <span className="text-[13px] text-[var(--color-muted)]">{filtered.length} of {products.length}</span>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                className="px-3 py-1.5 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] min-w-[150px]" />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="px-3 py-1.5 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={openAdd}
                className="px-4 py-1.5 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90 whitespace-nowrap">
                + Add Product
              </button>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col divide-y divide-[var(--color-line-lt)]">
            {loading ? (
              <div className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-[14px] font-semibold text-[var(--color-ink)] mb-1">No products found</div>
                <div className="text-[12px] text-[var(--color-muted)]">Click "+ Add Product" to start building your catalogue.</div>
              </div>
            ) : filtered.map(p => {
              const m = margin(p);
              const isLow = p.stock < p.reorder_level;
              return (
                <div key={p.id} className="p-4 flex flex-col gap-3 hover:bg-[#fafafa] transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-[14px] text-[var(--color-ink)]">{p.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">{p.unit}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-[var(--color-muted)] block text-[10px] uppercase font-bold mb-0.5">Supplier</span>
                      <span className="text-[var(--color-slate)]">{p.supplier || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] block text-[10px] uppercase font-bold mb-0.5">Stock</span>
                      <span className={`font-semibold ${isLow ? 'text-[var(--color-red)]' : 'text-[var(--color-ink)]'}`}>
                        {p.stock} {isLow && '⚠'} <span className="font-normal text-[10px] text-[var(--color-muted)]">(min {p.reorder_level})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] block text-[10px] uppercase font-bold mb-0.5">Sell Price</span>
                      <span className="font-bold text-[var(--color-ink)]">{fmt(p.sell_price)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] block text-[10px] uppercase font-bold mb-0.5">Margin</span>
                      {m !== null ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full inline-block" style={{ color: marginColor(m), background: marginBg(m) }}>{m}%</span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-muted)] italic">—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end items-center mt-1 pt-3 border-t border-[var(--color-line-lt)]">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] rounded px-3 py-1.5">Edit</button>
                      <button onClick={() => del(p)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] rounded px-3 py-1.5">Del</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 720 }}>
              <thead>
                <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
                  {['Product', 'Category', 'Supplier', 'Sell Price', 'Cost Price', 'Margin', 'Stock', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="text-[14px] font-semibold text-[var(--color-ink)] mb-1">No products found</div>
                      <div className="text-[12px] text-[var(--color-muted)]">Click "+ Add Product" to start building your catalogue.</div>
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const m = margin(p);
                  const isLow = p.stock < p.reorder_level;
                  return (
                    <tr key={p.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[13px] text-[var(--color-ink)]">{p.name}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">{p.unit}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--color-muted)]">{p.supplier || '—'}</td>
                      <td className="px-4 py-3 font-bold text-[13px] text-[var(--color-ink)]">{fmt(p.sell_price)}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">
                        {p.cost_price > 0 ? fmt(p.cost_price) : <span className="text-[var(--color-muted)] italic text-[11px]">Not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        {m !== null ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: marginColor(m), background: marginBg(m) }}>{m}%</span>
                        ) : (
                          <span className="text-[10px] text-[var(--color-muted)] italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold text-[13px] ${isLow ? 'text-[var(--color-red)]' : 'text-[var(--color-ink)]'}`}>
                          {p.stock} {isLow && '⚠'}
                        </span>
                        <div className="text-[10px] text-[var(--color-muted)]">min {p.reorder_level}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">Edit</button>
                          <button onClick={() => del(p)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[480px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-5">{editItem ? 'Edit Product' : 'Add New Product'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Product Name *</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
                <input value={form.category} onChange={e => setForm((p: any) => ({...p, category: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Beer, Grocery…" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Supplier</label>
                <input value={form.supplier} list="sup-list" onChange={e => setForm((p: any) => ({...p, supplier: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Select supplier" />
                <datalist id="sup-list">{supplierNames.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Unit</label>
                <select value={form.unit} onChange={e => setForm((p: any) => ({...p, unit: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {['pcs','btl','tub','kg','litres','pack','box'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Reorder Qty</label>
                <input type="number" value={form.reorder_level} onChange={e => setForm((p: any) => ({...p, reorder_level: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Selling Price (KES) *</label>
                <input type="number" value={form.sell_price} onChange={e => setForm((p: any) => ({...p, sell_price: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  Cost Price (KES) <span className="text-[var(--color-muted)] font-normal">— optional, enables Net Profit tracking</span>
                </label>
                <input type="number" value={form.cost_price} onChange={e => setForm((p: any) => ({...p, cost_price: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Leave blank if unknown" />
              </div>
              {form.sell_price && form.cost_price && (
                <div className="col-span-2 bg-[var(--color-teal-bg)] rounded-xl px-3 py-2.5 text-[12px] text-[var(--color-teal)] font-semibold">
                  Margin: {fmt(parseFloat(form.sell_price) - parseFloat(form.cost_price))} per unit
                  ({parseFloat(form.sell_price) > 0 ? Math.round(((parseFloat(form.sell_price) - parseFloat(form.cost_price)) / parseFloat(form.sell_price)) * 100) : 0}%)
                </div>
              )}
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] cursor-pointer text-[var(--color-slate)]">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.sell_price} className="flex-1 py-2.5 bg-[var(--color-teal)] text-white rounded-xl font-bold text-[14px] cursor-pointer disabled:opacity-50">
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
