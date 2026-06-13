'use client';

import { Topbar } from '@/components/Topbar';
import { Chip } from '@/components/Chip';
import { Modal } from '@/components/Modal';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type InventoryItem = {
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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  
  const blankForm = { name: "", category: "", supplier: "", unit: "pcs", sell_price: "", cost_price: "", reorder_level: "" };
  const [form, setForm] = useState(blankForm);

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

  const openAdd = () => { setForm(blankForm); setEditItem(null); setShowAdd(true); };
  const openEdit = (p: InventoryItem) => { 
    setForm({ 
      name: p.name, 
      category: p.category, 
      supplier: p.supplier, 
      unit: p.unit, 
      sell_price: String(p.sell_price), 
      cost_price: String(p.cost_price), 
      reorder_level: String(p.reorder_level) 
    });
    setEditItem(p); 
    setShowAdd(true); 
  };

  const handleSave = async () => {
    if (!form.name || !form.sell_price) return;
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entry = {
      user_id: user.id,
      name: form.name,
      category: form.category || 'General',
      supplier: form.supplier || 'N/A',
      unit: form.unit || 'pcs',
      sell_price: parseFloat(form.sell_price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      reorder_level: parseInt(form.reorder_level) || 0,
    };

    if (editItem) {
      await supabase.from('inventory').update(entry).eq('id', editItem.id);
    } else {
      await supabase.from('inventory').insert({ ...entry, stock: 0 }); // New items start with 0 stock
    }

    setShowAdd(false);
    fetchInventory();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      const supabase = createClient();
      await supabase.from('inventory').delete().eq('id', id);
      fetchInventory();
    }
  };

  const filtered = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Topbar title="Inventory Catalogue" sub="Manage products, prices, and reorder levels" />
      
      <div className="p-5 max-w-[1200px] mx-auto">
        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)]">
          <div className="p-4 border-b border-[var(--color-line-lt)] flex gap-3 flex-wrap items-center">
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search products…"
              className="flex-1 min-w-[180px] py-[8px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--color-teal)]"
            />
            <button 
              onClick={openAdd}
              className="px-[16px] py-[8px] bg-[var(--color-teal)] text-white border-none rounded-[8px] font-bold text-[13px] cursor-pointer hover:opacity-90 whitespace-nowrap"
            >
              + Add Product
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                  <th className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Product</th>
                  <th className="hidden md:table-cell p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Category</th>
                  <th className="hidden md:table-cell p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Supplier</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Sell Price</th>
                  <th className="hidden md:table-cell p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Cost Price</th>
                  <th className="hidden md:table-cell p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Reorder</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">Stock</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading inventory...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No products found. Add one to get started!</td></tr>
                ) : filtered.map((p) => {
                  const isLowStock = p.stock < p.reorder_level;
                  return (
                    <tr key={p.id} className="border-b border-[var(--color-line-lt)] hover:bg-[var(--color-teal-bg)] transition-colors">
                      <td className="p-3 text-[13px] font-semibold text-[var(--color-ink)]">{p.name}</td>
                      <td className="hidden md:table-cell p-3"><Chip label={p.category} color="var(--color-slate)" bg="var(--color-canvas)"/></td>
                      <td className="hidden md:table-cell p-3 text-[12px] text-[var(--color-muted)]">{p.supplier}</td>
                      <td className="p-3 text-[13px] font-bold text-[var(--color-ink)]">KES {p.sell_price}</td>
                      <td className="hidden md:table-cell p-3 text-[12px] text-[var(--color-slate)]">KES {p.cost_price}</td>
                      <td className="hidden md:table-cell p-3 text-[12px] text-[var(--color-slate)]">{p.reorder_level}</td>
                      <td className={`p-3 text-[12px] ${isLowStock ? 'font-bold text-[var(--color-red)]' : 'text-[var(--color-slate)]'}`}>
                        {p.stock} <span className="hidden sm:inline">{p.unit}</span> {isLowStock && '⚠'}
                      </td>
                      <td className="p-3 flex gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2 py-1 rounded-[6px] hover:opacity-80">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] px-2 py-1 rounded-[6px] hover:opacity-80">Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)]">
            {filtered.length} products
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-4">
          {editItem ? "Edit Product" : "Add New Product"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Product Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" placeholder="e.g. Tusker Lager 500ml" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Category</label>
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" placeholder="e.g. Beverages" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Supplier</label>
            <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" placeholder="e.g. EABL" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Selling Price (KES)</label>
            <input type="number" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Cost Price (KES)</label>
            <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Unit</label>
            <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" placeholder="pcs, btl, kg" />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Reorder Level (Low Stock Alert)</label>
            <input type="number" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" placeholder="10" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowAdd(false)} className="flex-1 py-[11px] bg-[var(--color-canvas)] text-[var(--color-slate)] border-[1.5px] border-[var(--color-line)] rounded-[10px] font-bold text-[14px]">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-[11px] bg-[var(--color-teal)] text-white border-none rounded-[10px] font-bold text-[14px]">
            {editItem ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
