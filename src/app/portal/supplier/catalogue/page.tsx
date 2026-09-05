'use client';

import { useState, useEffect, useMemo } from 'react';
import { Topbar } from '@/components/Topbar';
import { useStore } from '@/context/StoreContext';
import { createClient } from '@/utils/supabase/client';
import ProperCaseInput from '@/components/ProperCaseInput';
import { WholesaleProduct, DEFAULT_MOCK_CATALOGUES } from '@/types/catalogue';

const CATEGORIES = [
  'All',
  'Alcohol / Beer',
  'Spirits',
  'Edible Oils',
  'Dairy',
  'Grains & Flour',
  'Pharmaceuticals',
  'Beverages & Soft Drinks',
  'Household & Cleaning',
  'Hardware & Building'
];

export default function SupplierCataloguePage() {
  const { storeId, storeName } = useStore();
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [toast, setToast] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<WholesaleProduct | null>(null);

  // Form State
  const BLANK_FORM: Omit<WholesaleProduct, 'id' | 'supplier_id'> = {
    name: '',
    brand: '',
    category: 'Alcohol / Beer',
    pack_size: 'Crate (25 bottles)',
    wholesale_price: 3500,
    rrp: 200,
    moq_packs: 3,
    stock_status: 'in_stock',
    batch_lot_prefix: 'LOT-2026',
    active_deal: '',
    description: '',
  };
  const [form, setForm] = useState(BLANK_FORM);

  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // Load products: Query Supabase wholesale_products first, fallback to cache
  useEffect(() => {
    const fetchCatalogue = async () => {
      if (storeId) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('wholesale_products')
            .select('*')
            .eq('supplier_id', storeId)
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            setProducts(data as WholesaleProduct[]);
            localStorage.setItem(`sfs_wholesale_catalogue_${storeId}`, JSON.stringify(data));
            return;
          }
        } catch (e) {
          console.warn('Using local fallback for wholesale catalogue:', e);
        }
      }

      // Local cache fallback
      const key = `sfs_wholesale_catalogue_${storeId || 'default'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setProducts(JSON.parse(saved));
          return;
        } catch (e) {
          console.error('Error parsing catalogue cache:', e);
        }
      }

      // Default initial mock seed
      const defaultList = [
        ...DEFAULT_MOCK_CATALOGUES['sup_eabl_thika_rd'],
        ...DEFAULT_MOCK_CATALOGUES['sup_brookside_kapa_fmcg']
      ];
      setProducts(defaultList);
    };

    fetchCatalogue();
  }, [storeId]);

  // Persist helper
  const saveProducts = (updated: WholesaleProduct[]) => {
    setProducts(updated);
    const key = `sfs_wholesale_catalogue_${storeId || 'default'}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  // Open modal for Create / Edit
  const openCreateModal = () => {
    setEditingProd(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  };

  const openEditModal = (p: WholesaleProduct) => {
    setEditingProd(p);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      pack_size: p.pack_size,
      wholesale_price: p.wholesale_price,
      rrp: p.rrp,
      moq_packs: p.moq_packs,
      stock_status: p.stock_status,
      batch_lot_prefix: p.batch_lot_prefix,
      active_deal: p.active_deal || '',
      description: p.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.brand.trim()) {
      fire('⚠️ Product name and brand are required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      pack_size: form.pack_size.trim(),
      wholesale_price: Number(form.wholesale_price) || 0,
      rrp: Number(form.rrp) || 0,
      moq_packs: Number(form.moq_packs) || 1,
      stock_status: form.stock_status,
      batch_lot_prefix: form.batch_lot_prefix.trim(),
      active_deal: form.active_deal?.trim() || null,
      description: form.description?.trim() || null,
    };

    if (editingProd) {
      const updated = products.map(p =>
        p.id === editingProd.id
          ? { ...p, ...payload, active_deal: payload.active_deal || undefined, description: payload.description || undefined }
          : p
      );
      saveProducts(updated);

      // Sync to Supabase
      if (storeId && editingProd.id && !editingProd.id.startsWith('wp_') && !editingProd.id.startsWith('prod_')) {
        try {
          const supabase = createClient();
          await supabase.from('wholesale_products').update(payload).eq('id', editingProd.id);
        } catch (err) {
          console.warn('Supabase update fallback:', err);
        }
      }
      fire('✓ Product updated in wholesale catalogue!');
    } else {
      let createdId = 'wp_' + Math.random().toString(36).slice(2, 9);
      if (storeId) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.from('wholesale_products').insert({
            supplier_id: storeId,
            ...payload,
          }).select().single();

          if (!error && data) {
            createdId = data.id;
          }
        } catch (err) {
          console.warn('Supabase insert fallback:', err);
        }
      }

      const newProd: WholesaleProduct = {
        id: createdId,
        supplier_id: storeId || 'sup_current',
        ...payload,
        active_deal: payload.active_deal || undefined,
        description: payload.description || undefined,
      };
      saveProducts([newProd, ...products]);
      fire('✓ New wholesale product listed!');
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this product from your wholesale catalogue?')) return;
    const updated = products.filter(p => p.id !== id);
    saveProducts(updated);

    if (storeId && !id.startsWith('wp_') && !id.startsWith('prod_')) {
      try {
        const supabase = createClient();
        await supabase.from('wholesale_products').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete fallback:', err);
      }
    }
    fire('Product removed from catalogue.');
  };

  const toggleStockStatus = async (id: string, newStatus: WholesaleProduct['stock_status']) => {
    const updated = products.map(p => (p.id === id ? { ...p, stock_status: newStatus } : p));
    saveProducts(updated);

    if (storeId && !id.startsWith('wp_') && !id.startsWith('prod_')) {
      try {
        const supabase = createClient();
        await supabase.from('wholesale_products').update({ stock_status: newStatus }).eq('id', id);
      } catch (err) {
        console.warn('Supabase status toggle fallback:', err);
      }
    }
    fire(`Stock status updated to ${newStatus.replace('_', ' ')}`);
  };

  // Filtered list
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.batch_lot_prefix.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCat === 'All' || p.category.toLowerCase().includes(selectedCat.toLowerCase());
      const matchStatus = selectedStatus === 'all' || p.stock_status === selectedStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, search, selectedCat, selectedStatus]);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full bg-[var(--color-canvas)]">
      <Topbar
        title="Wholesale Catalogue & Inventory"
        sub="Manage crate & pack pricing, minimum order quantities, batch codes, and trade deals for connected stores"
      />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-5">
        {/* Header Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-[var(--color-line-lt)] shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-[17px] sm:text-[18px] font-bold text-[var(--color-ink)]">
                {storeName || 'Wholesale Depot'} — Product Catalogue
              </h2>
              <span className="text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {products.length} Active SKUs
              </span>
            </div>
            <p className="text-[11px] sm:text-[12px] text-[var(--color-muted)] mt-0.5">
              Wholesale prices and deals listed here are automatically visible to connected retail shops during replenishment.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[13px] rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>+</span> Add Wholesale Product
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-3.5 rounded-xl border border-[var(--color-line-lt)] flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search by product, brand, or batch prefix…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] outline-none focus:border-[var(--color-teal)] w-full sm:flex-1"
          />

          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              className="px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] font-medium text-[var(--color-ink)] outline-none cursor-pointer w-full sm:w-auto"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] font-medium text-[var(--color-ink)] outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="pre_order">Pre-Order</option>
            </select>
          </div>
        </div>

        {/* Products Grid / Cards */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-[var(--color-line-lt)] flex flex-col items-center gap-3">
            <div className="text-[40px]">📦</div>
            <div className="font-serif text-[18px] font-bold text-[var(--color-ink)]">No Wholesale Products Found</div>
            <p className="text-[13px] text-[var(--color-muted)] max-w-md">
              Try adjusting your search terms or category filter, or click "Add Wholesale Product" to list a new line item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-4 border border-[var(--color-line-lt)] shadow-xs flex flex-col justify-between hover:border-[var(--color-teal)]/40 transition-colors"
              >
                <div>
                  {/* Top Bar: Brand & Stock Badge */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line)] px-2 py-0.5 rounded-md">
                      {p.brand}
                    </span>

                    <select
                      value={p.stock_status}
                      onChange={e => toggleStockStatus(p.id, e.target.value as any)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border outline-none cursor-pointer ${
                        p.stock_status === 'in_stock'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : p.stock_status === 'low_stock'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      <option value="in_stock">● In Stock</option>
                      <option value="low_stock">▲ Low Stock</option>
                      <option value="out_of_stock">✕ Out of Stock</option>
                      <option value="pre_order">⏱ Pre-Order</option>
                    </select>
                  </div>

                  {/* Title & Pack Size */}
                  <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)] leading-snug mb-1">
                    {p.name}
                  </h3>
                  <div className="text-[12px] text-[var(--color-muted)] mb-2 font-medium">
                    📦 Pack: <strong className="text-[var(--color-slate)]">{p.pack_size}</strong>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="p-3 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)] mb-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-[var(--color-muted)] text-[11px] block">Wholesale / Pack</span>
                      <strong className="text-[15px] text-[var(--color-teal)] font-serif">
                        KES {p.wholesale_price.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] text-[11px] block">RRP per Unit</span>
                      <strong className="text-[14px] text-[var(--color-ink)]">
                        KES {p.rrp.toLocaleString()}
                      </strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-[var(--color-line-lt)] flex justify-between text-[11px] text-[var(--color-slate)]">
                      <span>MOQ: <strong>{p.moq_packs} packs</strong></span>
                      <span>Batch: <code className="font-mono text-[10px] bg-white px-1 py-0.2 rounded border">{p.batch_lot_prefix}</code></span>
                    </div>
                  </div>

                  {/* Active Deal Badge */}
                  {p.active_deal && (
                    <div className="mb-3 p-2 bg-amber-50/80 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
                      <span>🎁</span> {p.active_deal}
                    </div>
                  )}

                  {p.description && (
                    <p className="text-[11px] text-[var(--color-muted)] mb-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-[var(--color-line-lt)] flex gap-2 justify-end">
                  <button
                    onClick={() => openEditModal(p)}
                    className="flex-1 sm:flex-initial text-center px-3 py-1.5 border border-[var(--color-line)] rounded-lg text-[12px] font-bold text-[var(--color-slate)] hover:bg-[var(--color-canvas)] cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-[12px] font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT PRODUCT                                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-4 sm:p-5 w-full max-w-[550px] shadow-2xl border border-[var(--color-line-lt)] max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--color-line-lt)]">
              <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                {editingProd ? 'Edit Wholesale Product' : 'Add Wholesale Product'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-[20px] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    Product Title & Variant *
                  </label>
                  <ProperCaseInput
                    value={form.name}
                    onChange={v => setForm({ ...form, name: v })}
                    placeholder="e.g. Tusker Lager 500ml or Rina Cooking Oil 1L"
                    required
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">Brand *</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. EABL, Brookside, Kapa"
                    required
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] bg-white"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    Packaging / Pack Size *
                  </label>
                  <input
                    type="text"
                    value={form.pack_size}
                    onChange={e => setForm({ ...form, pack_size: e.target.value })}
                    placeholder="e.g. Crate (25 bottles), Carton (12 x 1L)"
                    required
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    Batch / Lot Number Prefix
                  </label>
                  <input
                    type="text"
                    value={form.batch_lot_prefix}
                    onChange={e => setForm({ ...form, batch_lot_prefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. EABL-TUS-2026"
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] font-mono text-[12px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    Wholesale Price (KES) *
                  </label>
                  <input
                    type="number"
                    value={form.wholesale_price}
                    onChange={e => setForm({ ...form, wholesale_price: Number(e.target.value) })}
                    min={1}
                    required
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    RRP per Unit (KES)
                  </label>
                  <input
                    type="number"
                    value={form.rrp}
                    onChange={e => setForm({ ...form, rrp: Number(e.target.value) })}
                    min={1}
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                    MOQ (Packs) *
                  </label>
                  <input
                    type="number"
                    value={form.moq_packs}
                    onChange={e => setForm({ ...form, moq_packs: Number(e.target.value) })}
                    min={1}
                    required
                    className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                  Active Trade Promotion / Volume Rebate (Optional)
                </label>
                <input
                  type="text"
                  value={form.active_deal}
                  onChange={e => setForm({ ...form, active_deal: e.target.value })}
                  placeholder="e.g. Buy 20 Crates → Get 1 Free or 5% Cash Rebate"
                  className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                  Description / Order Specifications
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Returnable glass bottles. Empty crates exchange required at offloading point."
                  rows={2}
                  className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] text-[12px]"
                />
              </div>

              <div className="mt-3 flex flex-col-reverse sm:flex-row gap-2 justify-end pt-3 border-t border-[var(--color-line-lt)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-[var(--color-line)] rounded-xl text-[12px] font-bold text-[var(--color-slate)] hover:bg-[var(--color-canvas)] cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-xl hover:bg-[#104347] transition-colors cursor-pointer shadow-sm text-center"
                >
                  {editingProd ? 'Save Changes' : 'List Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
