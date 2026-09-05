'use client';

import { useState, useEffect, useMemo } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import ProperCaseInput from '@/components/ProperCaseInput';
import { autoDeduplicateSuppliers } from '@/utils/dedup';
import { getBusinessTypeLabel } from '@/utils/businessTypes';
import { VerifiedSupplier, SupplierConnection } from '@/types/supplier';
import { MOCK_VERIFIED_SUPPLIERS, evaluateSupplierCorridorMatch } from '@/utils/mockVerifiedSuppliers';
import PurchaseOrderModal from '@/components/PurchaseOrderModal';

type Supplier = {
  id: string;
  name: string;
  category: string;
  contact_person: string;
  phone: string;
  email: string;
  terms: string;
  rating: number;
  products: string;
  verified_supplier_id?: string | null;
};

const CATS = ['General', 'Beverages', 'Produce', 'Meat', 'Dairy', 'Alcohol', 'Packaging', 'Pharmaceuticals', 'Hardware', 'Cosmetics'];

export default function SuppliersPage() {
  const { storeId, branchName, storeName, businessType, branchProfiles } = useStore();
  
  // Dual-Track View Mode
  const [activeTab, setActiveTab] = useState<'custom' | 'verified'>('custom');

  // Tab 1: Custom / Offline Suppliers State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);

  const BLANK = { name: '', category: 'General', contact_person: '', phone: '', email: '', terms: '', rating: 5, products: '' };
  const [form, setForm] = useState<any>(BLANK);
  const [toast, setToast] = useState('');

  // WhatsApp Order Modal State
  const [waModal, setWaModal] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [waOrderText, setWaOrderText] = useState('');
  const [waDeliveryDate, setWaDeliveryDate] = useState('');

  // Tab 2: Verified Wholesale Network State
  const [verifiedList] = useState<VerifiedSupplier[]>(MOCK_VERIFIED_SUPPLIERS);
  const [verifiedSearch, setVerifiedSearch] = useState('');
  const [verifiedCategory, setVerifiedCategory] = useState<string>('All');
  const [verifiedRegion, setVerifiedRegion] = useState<string>('All');
  const [connections, setConnections] = useState<Record<string, SupplierConnection>>({});

  // Sync Location Modal State
  const [syncModal, setSyncModal] = useState<{ open: boolean; supplier: VerifiedSupplier | null }>({ open: false, supplier: null });
  const [syncLandmark, setSyncLandmark] = useState('');
  const [syncNotes, setSyncNotes] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Purchase Order Modal State
  const [poModal, setPoModal] = useState<{ open: boolean; supplier: VerifiedSupplier | null }>({ open: false, supplier: null });

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // ── Tab 1: Fetch Custom Suppliers ──────────────────────────────────────────
  const fetchSuppliers = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const curBranch = branchName || 'Main Branch';

    // Auto-clean any pre-existing duplicate suppliers
    const cleaned = await autoDeduplicateSuppliers(supabase, storeId, curBranch);
    if (cleaned > 0) {
      fire(`✓ Auto-cleaned ${cleaned} duplicate supplier ${cleaned === 1 ? 'entry' : 'entries'}!`);
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', storeId)
      .eq('branch_name', curBranch)
      .order('name', { ascending: true });

    if (!error && data) setSuppliers(data as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [storeId, branchName]);

  // Load saved connections from local storage for seamless persistence
  useEffect(() => {
    if (typeof window !== 'undefined' && storeId) {
      try {
        const saved = localStorage.getItem(`sfs_supplier_connections_${storeId}`);
        if (saved) {
          setConnections(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error loading connections:', e);
      }
    }
  }, [storeId]);

  const cats = ['All', ...Array.from(new Set(suppliers.map(s => s.category || 'General')))];
  const filteredCustom = suppliers.filter(s =>
    (catF === 'All' || (s.category || 'General') === catF) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || (s.contact_person || '').toLowerCase().includes(search.toLowerCase()) || (s.products || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAddForm(true); };
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, category: s.category || 'General', contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', terms: s.terms || '', rating: s.rating || 5, products: s.products || '' });
    setEditItem(s); setShowAddForm(true);
  };

  const save = async () => {
    if (!form.name || !storeId) return;

    const normalizedName = form.name.trim().toLowerCase();
    if (!editItem) {
      const existing = suppliers.find(s => s.name.trim().toLowerCase() === normalizedName);
      if (existing) {
        fire(`⚠️ Supplier "${existing.name}" is already registered. Duplicate entries are blocked.`);
        return;
      }
    } else {
      const duplicate = suppliers.find(s => s.id !== editItem.id && s.name.trim().toLowerCase() === normalizedName);
      if (duplicate) {
        fire(`⚠️ Another supplier named "${duplicate.name}" already exists.`);
        return;
      }
    }

    const supabase = createClient();
    const entry = {
      user_id: storeId,
      name: form.name,
      category: form.category,
      contact_person: form.contact_person,
      phone: form.phone,
      email: form.email,
      terms: form.terms,
      rating: parseInt(form.rating) || 5,
      products: form.products,
      branch_name: branchName || 'Main Branch',
    };

    let error;
    if (editItem) {
      const res = await supabase.from('suppliers').update(entry).eq('id', editItem.id);
      error = res.error;
      if (!error) fire(`✓ ${form.name} updated`);
    } else {
      const res = await supabase.from('suppliers').insert([entry]);
      error = res.error;
      if (!error) fire(`✓ ${form.name} added`);
    }

    if (!error) { setShowAddForm(false); fetchSuppliers(); }
    else { fire('⚠ Error saving. Check console.'); console.error(error); }
  };

  const del = async (s: Supplier) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const supabase = createClient();
    await supabase.from('suppliers').delete().eq('id', s.id);
    fire(`${s.name} removed`);
    fetchSuppliers();
  };

  // ── WhatsApp Order Composer ────────────────────────────────────────────────
  const openWhatsAppOrder = (s: Supplier) => {
    const curBranch = branchName || 'Main Branch';
    const storeLabel = storeName || 'My Store';
    const defaultText = s.products 
      ? `Hi ${s.contact_person || s.name},\nThis is ${storeLabel} (${curBranch}).\n\nWe would like to place a restock order for:\n• ${s.products.split(',').join('\n• ')}\n\nPlease confirm availability, total price, and delivery window.`
      : `Hi ${s.contact_person || s.name},\nThis is ${storeLabel} (${curBranch}).\n\nWe would like to place a restock order:\n• [Item 1 - Quantity]\n• [Item 2 - Quantity]\n\nPlease confirm current wholesale prices.`;

    setWaOrderText(defaultText);
    setWaDeliveryDate('');
    setWaModal({ open: true, supplier: s });
  };

  const executeWhatsAppOrder = () => {
    if (!waModal.supplier || !waModal.supplier.phone) {
      fire('⚠️ Supplier does not have a valid phone number.');
      return;
    }
    const cleanPhone = waModal.supplier.phone.replace(/\D/g, '');
    let fullMsg = waOrderText;
    if (waDeliveryDate) {
      fullMsg += `\n\nRequested Delivery Date: ${waDeliveryDate}`;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`;
    window.open(url, '_blank');
    setWaModal({ open: false, supplier: null });
    fire(`✓ Order drafted to ${waModal.supplier.name} via WhatsApp!`);
  };

  // ── Tab 2: Smart Filtered Verified Wholesale Network ───────────────────────
  const filteredVerified = useMemo(() => {
    return verifiedList.filter(s => {
      // 1. Category matching
      const matchesCategory = verifiedCategory === 'All' 
        ? (businessType ? s.business_categories.includes(businessType) || s.business_categories.includes('retail_store') : true)
        : s.business_categories.includes(verifiedCategory);

      // 2. Region / Territory matching
      const matchesRegion = verifiedRegion === 'All'
        ? true
        : s.county.toLowerCase().includes(verifiedRegion.toLowerCase()) || s.town.toLowerCase().includes(verifiedRegion.toLowerCase());

      // 3. Search query
      const matchesSearch = !verifiedSearch
        ? true
        : s.company_name.toLowerCase().includes(verifiedSearch.toLowerCase()) ||
          s.brand_authorizations.some(b => b.toLowerCase().includes(verifiedSearch.toLowerCase())) ||
          s.depot_address.toLowerCase().includes(verifiedSearch.toLowerCase());

      return matchesCategory && matchesRegion && matchesSearch;
    });
  }, [verifiedList, verifiedCategory, verifiedRegion, verifiedSearch, businessType]);

  // ── Sync Location Modal Logic ──────────────────────────────────────────────
  const openSyncModal = (s: VerifiedSupplier) => {
    const curBranch = branchName || 'Main Branch';
    const existingConn = connections[s.id];
    setSyncLandmark(existingConn?.synced_landmark || '');
    setSyncNotes('');
    setSyncModal({ open: true, supplier: s });
  };

  const corridorEval = useMemo(() => {
    if (!syncModal.supplier) return null;
    return evaluateSupplierCorridorMatch(syncModal.supplier, syncLandmark);
  }, [syncModal.supplier, syncLandmark]);

  const handleConfirmLocationSync = async () => {
    if (!syncModal.supplier || !syncLandmark) {
      fire('⚠️ Please specify your store landmark or offloading area.');
      return;
    }
    setSyncing(true);

    const sup = syncModal.supplier;
    const curBranch = branchName || 'Main Branch';
    const evalResult = evaluateSupplierCorridorMatch(sup, syncLandmark);

    const newConn: SupplierConnection = {
      id: `conn_${sup.id}_${Date.now()}`,
      store_id: storeId || 'unknown_store',
      branch_name: curBranch,
      supplier_id: sup.id,
      supplier_name: sup.company_name,
      synced_landmark: syncLandmark,
      corridor_matched: evalResult.matchedCorridor || 'General Transit Route',
      delivery_days: evalResult.deliveryDays,
      cutoff_time: evalResult.cutoffTime,
      is_inside_corridor: evalResult.isMatched,
      synced_at: new Date().toISOString(),
    };

    // Update state
    const updated = { ...connections, [sup.id]: newConn };
    setConnections(updated);
    if (typeof window !== 'undefined' && storeId) {
      localStorage.setItem(`sfs_supplier_connections_${storeId}`, JSON.stringify(updated));
    }

    // Auto-create or link in custom suppliers table for unified visibility
    const normalizedSupName = sup.company_name.trim().toLowerCase();
    const existingInStore = suppliers.find(s => s.name.trim().toLowerCase() === normalizedSupName);
    
    if (!existingInStore && storeId) {
      const supabase = createClient();
      await supabase.from('suppliers').insert([{
        user_id: storeId,
        name: sup.company_name,
        category: sup.business_categories[0] || 'General',
        contact_person: 'Wholesale Depot Desk',
        phone: sup.phone,
        email: sup.email,
        terms: `Min KES ${sup.moq_amount.toLocaleString()} · ${evalResult.deliveryDays.join('/')}`,
        rating: Math.round(sup.rating),
        products: sup.brand_authorizations.join(', '),
        branch_name: curBranch,
        verified_supplier_id: sup.id,
      }]);
      await fetchSuppliers();
    }

    setSyncing(false);
    setSyncModal({ open: false, supplier: null });
    fire(`🎉 Synced with ${sup.company_name}! Scheduled days: ${evalResult.deliveryDays.join(', ')}`);
  };

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Suppliers & Procurement" sub="Manage offline vendors, discover verified distributors, and sync delivery corridors" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      {/* Top Header Tabs */}
      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-3 bg-white p-2.5 rounded-2xl border border-[var(--color-line-lt)] shadow-sm">
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)]">
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'custom'
                  ? 'bg-white text-[var(--color-teal)] shadow-sm'
                  : 'text-[var(--color-slate)] hover:text-[var(--color-ink)]'
              }`}
            >
              <span>📋 My Store Suppliers</span>
              <span className="text-[11px] bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-2 py-0.2 rounded-full font-mono">
                {suppliers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('verified')}
              className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'verified'
                  ? 'bg-white text-[var(--color-teal)] shadow-sm border border-[var(--color-teal)]/20'
                  : 'text-[var(--color-slate)] hover:text-[var(--color-ink)]'
              }`}
            >
              <span>🏆 Verified Wholesale Network</span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.2 rounded-full uppercase tracking-wider">
                Direct
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'custom' ? (
              <button
                onClick={openAdd}
                className="px-4 py-2 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[13px] rounded-xl shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <span>+</span> Add Custom Vendor
              </button>
            ) : (
              <div className="text-[12px] font-bold text-[var(--color-muted)] bg-[var(--color-canvas)] px-3 py-1.5 rounded-xl border border-[var(--color-line)]">
                📍 Active Store: <span className="text-[var(--color-ink)]">{storeName || 'Main Store'}</span> ({getBusinessTypeLabel(businessType || 'retail_store')})
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: CUSTOM / PRIVATE SUPPLIERS ROLODEX                              */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'custom' && (
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-3.5 border-b border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Search vendor, contact, or item…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg text-[13px] outline-none w-56 focus:border-[var(--color-teal)]"
                />
                <select
                  value={catF}
                  onChange={e => setCatF(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-slate)] font-medium cursor-pointer"
                >
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="text-[12px] text-[var(--color-muted)]">
                Showing {filteredCustom.length} of {suppliers.length} vendors
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--color-line-lt)] bg-[var(--color-canvas)] text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                    <th className="px-4 py-2.5 sticky left-0 z-10 bg-[var(--color-canvas)]">Vendor / Products</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Contact Person</th>
                    <th className="px-4 py-2.5">WhatsApp / Phone</th>
                    <th className="px-4 py-2.5">Payment Terms</th>
                    <th className="px-4 py-2.5">Rating</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[var(--color-muted)]">Loading vendors…</td></tr>
                  ) : filteredCustom.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="text-[32px] mb-2">📦</div>
                        <div className="font-serif text-[15px] font-bold text-[var(--color-ink)] mb-1">No custom suppliers found</div>
                        <div className="text-[12px] text-[var(--color-muted)] max-w-sm mx-auto mb-4">
                          Record your local informal vendors (bakers, egg suppliers, farmers) or connect with verified distributors.
                        </div>
                        <button onClick={openAdd} className="px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-lg cursor-pointer">
                          + Add Your First Vendor
                        </button>
                      </td>
                    </tr>
                  ) : filteredCustom.map(s => {
                    const isLinkedVerified = Boolean(s.verified_supplier_id);
                    return (
                      <tr key={s.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors group">
                        <td className="px-4 py-3 sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line-lt)] group-hover:bg-[#fafafa] transition-colors">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-[var(--color-ink)]">{s.name}</span>
                            {isLinkedVerified && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full">
                                ✓ Verified Partner
                              </span>
                            )}
                          </div>
                          {s.products && <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate max-w-[200px]">{s.products}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-2 py-1 rounded-full">
                            {s.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">{s.contact_person || '—'}</td>
                        <td className="px-4 py-3">
                          {s.phone ? (
                            <button
                              onClick={() => openWhatsAppOrder(s)}
                              className="text-[12px] font-semibold text-[#128C7E] hover:underline flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                              title="Click to draft a direct WhatsApp Purchase Order"
                            >
                              <span>💬</span> +{s.phone.replace(/\D/g, '')}
                            </button>
                          ) : <span className="text-[12px] text-[var(--color-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">{s.terms || '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-gold)] text-[12px]">{stars(s.rating || 5)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openWhatsAppOrder(s)}
                              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-emerald-100 transition-colors"
                              title="Draft WhatsApp Purchase Order"
                            >
                              📲 Order
                            </button>
                            <button
                              onClick={() => openEdit(s)}
                              className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] rounded-lg px-2.5 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => del(s)}
                              className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] rounded-lg px-2.5 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: VERIFIED WHOLESALE NETWORK (THE B2B MARKETPLACE)                */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'verified' && (
          <div className="flex flex-col gap-4">
            {/* Smart Matching Alert Banner */}
            <div className="bg-[var(--color-teal-bg)] border border-[var(--color-teal)]/30 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">🎯</span>
                  <h3 className="font-serif text-[15px] font-bold text-[var(--color-teal)]">
                    Smart Category Match Active ({getBusinessTypeLabel(businessType || 'retail_store')})
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    ✓ Verified Tier-1
                  </span>
                </div>
                <p className="text-[12px] text-[var(--color-slate)] mt-1 max-w-2xl">
                  Showing authorized distributors supplying genuine manufacturer-backed stock (anti-counterfeit, batch-tracked) delivering across Kenyan transit corridors.
                </p>
              </div>

              {/* Quick Filter Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={verifiedRegion}
                  onChange={e => setVerifiedRegion(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-xl text-[12px] font-bold text-[var(--color-ink)] outline-none shadow-sm cursor-pointer"
                >
                  <option value="All">All Regions / Corridors</option>
                  <option value="Nairobi">Nairobi Metropolitan</option>
                  <option value="Kiambu">Kiambu / Thika Road</option>
                  <option value="Nakuru">Nakuru County</option>
                </select>

                <input
                  type="text"
                  placeholder="Search brand (EABL, Kapa, Bidco)…"
                  value={verifiedSearch}
                  onChange={e => setVerifiedSearch(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-xl text-[12px] outline-none shadow-sm focus:border-[var(--color-teal)] w-48"
                />
              </div>
            </div>

            {/* Verified Supplier Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVerified.map(sup => {
                const conn = connections[sup.id];
                const isConnected = Boolean(conn);

                return (
                  <div key={sup.id} className="bg-white rounded-2xl p-5 border border-[var(--color-line-lt)] shadow-sm flex flex-col justify-between hover:border-[var(--color-teal)]/40 transition-colors">
                    <div>
                      {/* Top Badges */}
                      <div className="flex justify-between items-start mb-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span>🛡️</span> SAFROM VERIFIED
                          </span>
                          <span className="text-[10px] font-bold text-[var(--color-muted)]">
                            Depot: {sup.town}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-slate)]">
                          <span className="text-[var(--color-gold)]">★</span> {sup.rating} ({sup.rating_count} trades)
                        </div>
                      </div>

                      {/* Company Name */}
                      <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-1">
                        {sup.company_name}
                      </h3>
                      <p className="text-[11px] text-[var(--color-muted)] mb-3">
                        📍 {sup.depot_address}
                      </p>

                      {/* Authorized Brands */}
                      <div className="mb-3">
                        <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                          Authorized Manufacturer Brands:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sup.brand_authorizations.map(b => (
                            <span key={b} className="text-[11px] font-bold bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-line)] px-2 py-0.5 rounded-md">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Active Trade Promotion */}
                      {sup.active_trade_deal && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 font-semibold flex items-center gap-2">
                          <span className="text-[14px]">🎁</span>
                          <span>{sup.active_trade_deal}</span>
                        </div>
                      )}

                      {/* Serviced Corridors & Delivery Schedule */}
                      <div className="p-3 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)] mb-4 space-y-1 text-[11px]">
                        <div className="font-bold text-[var(--color-slate)]">
                          🚚 Serviced Corridors & Schedules:
                        </div>
                        {sup.corridors.map(c => (
                          <div key={c.id} className="text-[var(--color-muted)] pl-2 border-l-2 border-[var(--color-teal)]/40 leading-relaxed">
                            <strong className="text-[var(--color-ink)]">{c.name.split('(')[0]}:</strong> Runs on <strong>{c.delivery_days.join(' & ')}</strong> (Cutoff {c.cutoff_time})
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer / Action Section */}
                    <div>
                      {/* Synced State Preview */}
                      {isConnected ? (
                        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>✅</span>
                            <span>Synced: {conn.synced_landmark}</span>
                          </div>
                          <span className="font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                            {conn.delivery_days.join(', ')} Run
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-[11px] text-[var(--color-muted)] mb-3">
                          <span>Min Order: <strong>KES {sup.moq_amount.toLocaleString()}</strong></span>
                          <span>Payment: <strong>M-Pesa Direct / POD</strong> <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded font-semibold ml-1">✓ Instant Settlement</span></span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => openSyncModal(sup)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-[12px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                            isConnected
                              ? 'bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-teal)] hover:bg-[var(--color-line-lt)]'
                              : 'bg-[var(--color-teal)] text-white hover:bg-[#104347]'
                          }`}
                        >
                          <span>{isConnected ? '📍 Edit Route Sync' : '📍 Sync Location & Connect'}</span>
                        </button>

                        <button
                          onClick={() => setPoModal({ open: true, supplier: sup })}
                          className="px-3.5 py-2.5 bg-[var(--color-gold)] hover:bg-[#b07d10] text-white rounded-xl font-bold text-[12px] transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                          title="Open live wholesale catalogue & place Purchase Order"
                        >
                          <span>🛒</span> Catalogue & Order
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: SYNC LOCATION WITH SUPPLIER                                     */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {syncModal.open && syncModal.supplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[999] p-4" onClick={() => setSyncModal({ open: false, supplier: null })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-[0_24px_64px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                  📍 Sync Delivery Location
                </h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  Connect your store route with <strong>{syncModal.supplier.company_name}</strong>
                </p>
              </div>
              <button onClick={() => setSyncModal({ open: false, supplier: null })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            {/* Landmark input */}
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  Store Landmark & Offload Area *
                </label>
                <div className="flex gap-2 mb-1.5">
                  <ProperCaseInput
                    value={syncLandmark}
                    onChange={v => setSyncLandmark(v)}
                    className="flex-1 px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none focus:border-[var(--color-teal)]"
                    placeholder="e.g. Kasarani, near Shell Petrol Station"
                  />
                  <button
                    type="button"
                    onClick={() => setSyncLandmark(branchProfiles?.[branchName || 'Main Branch'] || branchName || 'Kasarani')}
                    className="px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[11px] font-bold text-[var(--color-teal)] hover:bg-[var(--color-line-lt)]"
                    title="Fill from active branch profile"
                  >
                    Auto-Fill
                  </button>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Specific landmark helps the delivery driver navigate directly to your shop without calling for directions.
                </p>
              </div>

              {/* Live Corridor Evaluation Result */}
              {corridorEval && (
                <div className={`p-4 rounded-xl border ${corridorEval.isMatched ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'}`}>
                  {corridorEval.isMatched ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-900">
                        <span>✅</span>
                        <span>Matched Route: {corridorEval.matchedCorridor?.split('(')[0]}</span>
                      </div>
                      <div className="text-[12px] text-emerald-800">
                        • Scheduled Delivery Days: <strong>{corridorEval.deliveryDays.join(' & ')}</strong>
                      </div>
                      <div className="text-[12px] text-emerald-800">
                        • Order Cutoff: <strong>{corridorEval.cutoffTime}</strong> for next-morning dispatch
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-1 pt-1 border-t border-emerald-200">
                        ✓ Eligible for standard route delivery with zero transit surcharge.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-amber-900">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold">
                        <span>⚠️</span>
                        <span>Outside Regular Serviced Corridor</span>
                      </div>
                      <p className="text-[12px] leading-relaxed">
                        This supplier primarily services: <strong>{syncModal.supplier.corridors.map(c => c.name.split('(')[0]).join(', ')}</strong>.
                      </p>
                      <div className="text-[11px] bg-white/80 p-2.5 rounded-lg border border-amber-200 mt-2 space-y-1">
                        <strong>Available Alternative Options:</strong>
                        <div>• <strong>Depot Self-Pickup:</strong> Collect directly at {syncModal.supplier.town} depot.</div>
                        <div>• <strong>Dedicated Courier/Van:</strong> Negotiable transit surcharge (+KES 600) on bulk orders.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  Delivery Access Notes (Optional)
                </label>
                <input
                  value={syncNotes}
                  onChange={e => setSyncNotes(e.target.value)}
                  placeholder="e.g. Back door loading bay, ground floor"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none focus:border-[var(--color-teal)]"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSyncModal({ open: false, supplier: null })}
                  className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={syncing || !syncLandmark}
                  onClick={handleConfirmLocationSync}
                  className="flex-1 py-2.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[13px] rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {syncing ? 'Saving…' : 'Confirm & Sync Route'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: DRAFT WHATSAPP PURCHASE ORDER                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {waModal.open && waModal.supplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[999] p-4" onClick={() => setWaModal({ open: false, supplier: null })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-[0_24px_64px_rgba(0,0,0,0.25)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                  📲 Send WhatsApp Order
                </h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  Draft an instant order to <strong>{waModal.supplier.name}</strong> ({waModal.supplier.phone})
                </p>
              </div>
              <button onClick={() => setWaModal({ open: false, supplier: null })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  Order Message Preview
                </label>
                <textarea
                  rows={5}
                  value={waOrderText}
                  onChange={e => setWaOrderText(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none font-mono focus:border-[var(--color-teal)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  Requested Delivery Date (Optional)
                </label>
                <input
                  type="date"
                  value={waDeliveryDate}
                  onChange={e => setWaDeliveryDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setWaModal({ open: false, supplier: null })}
                  className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeWhatsAppOrder}
                  className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-[13px] rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>💬</span> Open in WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT CUSTOM SUPPLIER                                      */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[500] p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[500px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-5">{editItem ? 'Edit Vendor Profile' : 'Add New Vendor'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Vendor / Business Name *</label>
                <ProperCaseInput value={form.name} onChange={v => setForm((p: any) => ({...p, name: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Mama Mary Fresh Bakery" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Contact Person</label>
                <ProperCaseInput value={form.contact_person} onChange={v => setForm((p: any) => ({...p, contact_person: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Mary Wambui" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm((p: any) => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="vendor@example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">WhatsApp Phone (e.g. 254…)</label>
                <input value={form.phone} onChange={e => setForm((p: any) => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="254700000000" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Payment Terms</label>
                <ProperCaseInput mode="sentence" value={form.terms} onChange={v => setForm((p: any) => ({...p, terms: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. COD, Net 14 Days" />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Products Supplied (comma-separated)</label>
                <ProperCaseInput value={form.products} onChange={v => setForm((p: any) => ({...p, products: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Fresh Bread, Scones, Cakes" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
                <select value={form.category} onChange={e => setForm((p: any) => ({...p, category: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Rating (1–5)</label>
                <select value={form.rating} onChange={e => setForm((p: any) => ({...p, rating: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)} {n}/5</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAddForm(false)} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] cursor-pointer text-[var(--color-slate)]">Cancel</button>
              <button onClick={save} disabled={!form.name} className="flex-1 py-2.5 bg-[var(--color-teal)] text-white rounded-xl font-bold text-[14px] cursor-pointer disabled:opacity-50">
                {editItem ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Composer Modal */}
      <PurchaseOrderModal
        isOpen={poModal.open}
        onClose={() => setPoModal({ open: false, supplier: null })}
        supplier={poModal.supplier}
        connection={poModal.supplier ? connections[poModal.supplier.id] : null}
        onOrderCreated={(ord) => {
          fire(`✓ Purchase Order ${ord.id} transmitted to ${poModal.supplier?.company_name}!`);
        }}
      />
    </div>
  );
}
