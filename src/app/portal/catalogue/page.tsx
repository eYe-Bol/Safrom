'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';

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

const margin = (p: Product) =>
  p.sell_price > 0 ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100) : 0;

const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 9px', borderRadius: 99, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>
      {label}
    </span>
  );
}

const BLANK = { name: '', category: '', supplier: '', unit: 'pcs', sell_price: '', cost_price: '', reorder_level: '' };

export default function CataloguePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prods }, { data: sups }] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', user.id).order('name'),
      supabase.from('suppliers').select('name').eq('user_id', user.id),
    ]);
    if (prods) setProducts(prods);
    if (sups) setSuppliers(sups.map((s: any) => s.name));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAdd(true); };
  const openEdit = (p: Product) => {
    setForm({ name: p.name, category: p.category, supplier: p.supplier, unit: p.unit,
      sell_price: String(p.sell_price), cost_price: String(p.cost_price), reorder_level: String(p.reorder_level) });
    setEditItem(p); setShowAdd(true);
  };

  const save = async () => {
    if (!form.name || !form.sell_price) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entry = {
      user_id: user.id,
      name: form.name,
      category: form.category || 'General',
      supplier: form.supplier || 'N/A',
      unit: form.unit || 'pcs',
      sell_price: parseFloat(form.sell_price),
      cost_price: parseFloat(form.cost_price) || 0,
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

      <div className="p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden">
          {/* toolbar */}
          <div className="p-3 border-b border-[var(--color-line-lt)] flex gap-2 flex-wrap items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
              className="flex-1 min-w-[130px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={openAdd}
              className="px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90 whitespace-nowrap">
              + Add Product
            </button>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)]">
                  {['Product','Category','Supplier','Sell Price','Cost Price','Margin','Reorder','Stock',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[13px] text-[var(--color-muted)]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[13px] text-[var(--color-muted)]">No products found. Click "+ Add Product" to start.</td></tr>
                ) : filtered.map((p, i) => {
                  const m = margin(p);
                  return (
                    <tr key={p.id} className="hover:bg-[#f0f7f8] border-b border-[var(--color-line-lt)] last:border-0">
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]">{p.name}</td>
                      <td className="px-3 py-2.5"><Chip label={p.category} color="#4A6670" bg="#FAF8F4" /></td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-muted)]">{p.supplier}</td>
                      <td className="px-3 py-2.5 text-[13px] font-bold text-[var(--color-ink)]">{fmt(p.sell_price)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-slate)]">{fmt(p.cost_price)}</td>
                      <td className="px-3 py-2.5"><Chip label={`${m}%`} color={marginColor(m)} bg={marginBg(m)} /></td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-slate)]">{p.reorder_level}</td>
                      <td className="px-3 py-2.5 text-[12px]" style={{ fontWeight: p.stock < p.reorder_level ? 700 : 400, color: p.stock < p.reorder_level ? '#C0392B' : '#4A6670' }}>
                        {p.stock} {p.stock < p.reorder_level && '⚠'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border-none rounded px-2 py-1 cursor-pointer">Edit</button>
                          <button onClick={() => del(p)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] border-none rounded px-2 py-1 cursor-pointer">Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)]">
            {filtered.length} of {products.length} products
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[480px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-5">{editItem ? 'Edit Product' : 'Add New Product'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Product Name</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
                <input value={form.category} onChange={e => setForm((p: any) => ({...p, category: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" placeholder="e.g. Beer, Grocery…" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Supplier</label>
                <input value={form.supplier} list="sup-list" onChange={e => setForm((p: any) => ({...p, supplier: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" placeholder="Select supplier" />
                <datalist id="sup-list">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Unit</label>
                <select value={form.unit} onChange={e => setForm((p: any) => ({...p, unit: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {['pcs','btl','tub','kg','litres','pack','box'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Reorder Qty</label>
                <input type="number" value={form.reorder_level} onChange={e => setForm((p: any) => ({...p, reorder_level: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Selling Price (KES)</label>
                <input type="number" value={form.sell_price} onChange={e => setForm((p: any) => ({...p, sell_price: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Cost Price (KES)</label>
                <input type="number" value={form.cost_price} onChange={e => setForm((p: any) => ({...p, cost_price: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
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
