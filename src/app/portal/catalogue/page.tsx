'use client';

import { useState, useEffect, useRef } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { fmt } from '@/utils/format';
import ProperCaseInput from '@/components/ProperCaseInput';
import * as XLSX from 'xlsx';

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
  expiry_date?: string | null;
  branch_name?: string;
  pending_sell_price?: number | null;
  pending_price_staff?: string | null;
  pending_price_at?: string | null;
};

type ProductForm = {
  name: string;
  category: string;
  supplier: string;
  unit: string;
  sell_price: string;
  cost_price: string;
  reorder_level: string;
  expiry_date: string;
};

const margin = (p: Product) =>
  p.sell_price > 0 && p.cost_price > 0
    ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100)
    : null;

const BLANK: ProductForm = { name: '', category: '', supplier: '', unit: 'pcs', sell_price: '', cost_price: '', reorder_level: '', expiry_date: '' };

// ─── Import types ─────────────────────────────────────────────────────────────
type ImportRow = {
  name: string;
  category: string;
  supplier: string;
  unit: string;
  sell_price: number;
  cost_price: number;
  reorder_level: number;
  stock: number;
  expiry_date: string;
  _valid: boolean;
  _errors: string[];
};

export default function CataloguePage() {
  const { storeId, branchName, role, scale } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(BLANK);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });

  // ── Sync Catalogue State ─────────────────────────────────────────────────
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSource, setSyncSource] = useState('Main Branch');
  const [syncTarget, setSyncTarget] = useState(branchName || 'Branch 2');
  const [syncing, setSyncing] = useState(false);
  const [branchBizTypes, setBranchBizTypes] = useState<Record<string, string>>({});

  // ── Price Approvals State ────────────────────────────────────────────────
  const [pendingApprovals, setPendingApprovals] = useState<Product[]>([]);
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // ── Import state ─────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ added: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadData = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const curBranch = branchName || 'Main Branch';

    // 1. Fetch current branch inventory & suppliers
    const [{ data: prods }, { data: sups }, { data: branchData }, { data: allPending }] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', storeId).eq('branch_name', curBranch).order('name'),
      supabase.from('suppliers').select('name').eq('user_id', storeId).eq('branch_name', curBranch),
      supabase.from('branch_profiles').select('branch_name, business_type').eq('owner_id', storeId),
      supabase.from('inventory').select('*').eq('user_id', storeId).not('pending_sell_price', 'is', null),
    ]);

    if (prods) setProducts(prods);
    if (sups) setSupplierNames(sups.map((s: any) => s.name));
    if (allPending) setPendingApprovals(allPending);

    const bMap: Record<string, string> = { 'Main Branch': 'retail', 'Branch 2': 'retail', 'Branch 3': 'retail' };
    (branchData || []).forEach((b: any) => {
      bMap[b.branch_name] = b.business_type || 'retail';
    });
    setBranchBizTypes(bMap);

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [storeId, branchName]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || 'General')))];
  const filtered = products.filter(p =>
    (catFilter === 'All' || (p.category || 'General') === catFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAdd(true); };
  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      category: p.category,
      supplier: p.supplier,
      unit: p.unit,
      sell_price: String(p.sell_price),
      cost_price: p.cost_price > 0 ? String(p.cost_price) : '',
      reorder_level: String(p.reorder_level),
      expiry_date: p.expiry_date || '',
    });
    setEditItem(p); setShowAdd(true);
  };

  const save = async () => {
    if (!form.name || !form.sell_price) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !storeId) return;

    const curBranch = branchName || 'Main Branch';
    const isEmployee = role === 'employee';

    if (editItem) {
      if (isEmployee) {
        const newSellPrice = parseFloat(form.sell_price);
        
        // Check if branches are diversified vs homogeneous
        // If different business types, staff does not need authorization
        const uniqueTypes = new Set(Object.values(branchBizTypes));
        const isDiversified = uniqueTypes.size > 1;

        if (isDiversified) {
          // Direct update without approval
          await supabase.from('inventory').update({ sell_price: newSellPrice }).eq('id', editItem.id);
          fire(`✓ Selling price updated to ${fmt(newSellPrice)}!`);
        } else {
          // Requires Owner Approval
          await supabase.from('inventory').update({
            pending_sell_price: newSellPrice,
            pending_price_staff: user.email || 'Staff',
            pending_price_at: new Date().toISOString(),
          }).eq('id', editItem.id);
          fire(`✓ Price change submitted for Owner Approval (${fmt(newSellPrice)})`);
        }
      } else {
        // Owner update
        const updateEntry = {
          name: form.name,
          category: form.category || 'General',
          supplier: form.supplier || 'N/A',
          unit: form.unit || 'pcs',
          sell_price: parseFloat(form.sell_price),
          cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
          reorder_level: parseInt(form.reorder_level) || 0,
          expiry_date: form.expiry_date || null,
        };
        await supabase.from('inventory').update(updateEntry).eq('id', editItem.id);
        fire(`✓ ${form.name} updated`);
      }
    } else {
      // Add new product
      const entry = {
        user_id: storeId!,
        name: form.name,
        category: form.category || 'General',
        supplier: form.supplier || 'N/A',
        unit: form.unit || 'pcs',
        sell_price: parseFloat(form.sell_price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
        reorder_level: parseInt(form.reorder_level) || 0,
        expiry_date: form.expiry_date || null,
        branch_name: curBranch,
        stock: 0,
      };
      await supabase.from('inventory').insert([entry]);
      fire(`✓ ${form.name} added to catalogue`);
    }

    setShowAdd(false); setEditItem(null); setSaving(false);
    loadData();
  };

  const handleApprovePrice = async (p: Product) => {
    if (!p.pending_sell_price) return;
    setApprovingId(p.id);
    const supabase = createClient();
    await supabase.from('inventory').update({
      sell_price: p.pending_sell_price,
      pending_sell_price: null,
      pending_price_staff: null,
      pending_price_at: null,
    }).eq('id', p.id);

    fire(`✓ Approved new price for ${p.name}: ${fmt(p.pending_sell_price)}`);
    setApprovingId(null);
    loadData();
  };

  const handleRejectPrice = async (p: Product) => {
    setApprovingId(p.id);
    const supabase = createClient();
    await supabase.from('inventory').update({
      pending_sell_price: null,
      pending_price_staff: null,
      pending_price_at: null,
    }).eq('id', p.id);

    fire(`Price change rejected for ${p.name}`);
    setApprovingId(null);
    loadData();
  };

  const handleSyncCatalogue = async () => {
    if (syncSource === syncTarget || !storeId) {
      fire('Please choose different source and target branches.');
      return;
    }
    setSyncing(true);
    const supabase = createClient();

    try {
      // 1. Fetch source products
      const { data: srcProds } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', storeId)
        .eq('branch_name', syncSource);

      // 2. Fetch existing target products to avoid duplicates
      const { data: targetProds } = await supabase
        .from('inventory')
        .select('name')
        .eq('user_id', storeId)
        .eq('branch_name', syncTarget);

      const targetNames = new Set((targetProds || []).map((p: any) => p.name.toLowerCase().trim()));
      const toClone = (srcProds || []).filter((p: any) => !targetNames.has(p.name.toLowerCase().trim()));

      if (toClone.length === 0) {
        fire(`All products from ${syncSource} already exist in ${syncTarget}.`);
        setSyncing(false);
        setShowSyncModal(false);
        return;
      }

      const cloneEntries = toClone.map((p: any) => ({
        user_id: storeId,
        name: p.name,
        category: p.category || 'General',
        supplier: p.supplier || 'N/A',
        unit: p.unit || 'pcs',
        sell_price: p.sell_price,
        cost_price: p.cost_price,
        reorder_level: p.reorder_level,
        stock: 0,
        expiry_date: p.expiry_date || null,
        branch_name: syncTarget,
      }));

      const { error } = await supabase.from('inventory').insert(cloneEntries);
      if (error) {
        fire(`Sync failed: ${error.message}`);
      } else {
        fire(`✓ Successfully copied ${cloneEntries.length} products to ${syncTarget}!`);
        setShowSyncModal(false);
        loadData();
      }
    } catch {
      fire('Failed to sync catalogue');
    }
    setSyncing(false);
  };

  const del = async (p: Product) => {
    setDeleteModal({ open: true, product: p });
  };

  const confirmDelete = async () => {
    if (!deleteModal.product) return;
    const supabase = createClient();
    await supabase.from('inventory').delete().eq('id', deleteModal.product.id);
    fire(`${deleteModal.product.name} removed`);
    setDeleteModal({ open: false, product: null });
    loadData();
  };

  // ── Excel Import Helpers ────────────────────────────────────────────────

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'category', 'supplier', 'unit', 'sell_price', 'cost_price', 'reorder_level', 'stock', 'expiry_date'],
      ['Tusker Lager 500ml', 'Beer', 'EABL', 'btl', 150, 110, 24, 48, ''],
      ['Bread (White)', 'Bakery', 'Broadways', 'pcs', 60, 45, 10, 20, '2024-12-31'],
    ]);
    // Set column widths
    ws['!cols'] = [20,14,16,8,12,12,15,8,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
    XLSX.writeFile(wb, 'sfs_catalogue_template.xlsx');
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const rows: ImportRow[] = raw.map((r) => {
          const errors: string[] = [];
          const name = String(r['name'] || r['Name'] || r['PRODUCT'] || r['product'] || '').trim();
          const sell_price = parseFloat(String(r['sell_price'] || r['Sell Price'] || r['SELL_PRICE'] || r['price'] || 0));
          if (!name) errors.push('Name required');
          if (!sell_price || isNaN(sell_price)) errors.push('Sell price required');
          return {
            name,
            category: String(r['category'] || r['Category'] || 'General').trim(),
            supplier: String(r['supplier'] || r['Supplier'] || 'N/A').trim(),
            unit: String(r['unit'] || r['Unit'] || 'pcs').trim(),
            sell_price: isNaN(sell_price) ? 0 : sell_price,
            cost_price: parseFloat(String(r['cost_price'] || r['Cost Price'] || r['cost'] || 0)) || 0,
            reorder_level: parseInt(String(r['reorder_level'] || r['Reorder'] || 0)) || 0,
            stock: parseInt(String(r['stock'] || r['Stock'] || 0)) || 0,
            expiry_date: String(r['expiry_date'] || r['Expiry'] || '').trim(),
            _valid: errors.length === 0,
            _errors: errors,
          };
        });
        setImportRows(rows);
        setImportDone(null);
      } catch {
        fire('❌ Could not read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    const valid = importRows.filter(r => r._valid);
    if (!valid.length || !storeId) return;
    setImporting(true);
    const supabase = createClient();
    const entries = valid.map(r => ({
      user_id: storeId,
      name: r.name,
      category: r.category || 'General',
      supplier: r.supplier || 'N/A',
      unit: r.unit || 'pcs',
      sell_price: r.sell_price,
      cost_price: r.cost_price,
      reorder_level: r.reorder_level,
      stock: r.stock,
      expiry_date: r.expiry_date || null,
      branch_name: branchName || 'Main Branch',
    }));
    const { error } = await supabase.from('inventory').insert(entries);
    setImporting(false);
    if (error) {
      fire(`❌ Import failed: ${error.message}`);
    } else {
      const skipped = importRows.filter(r => !r._valid).length;
      setImportDone({ added: valid.length, skipped });
      loadData();
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setImportRows([]);
    setImportDone(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const marginColor = (m: number) => m >= 30 ? '#1A7A4A' : m >= 15 ? '#D97706' : '#C0392B';
  const marginBg = (m: number) => m >= 30 ? '#E8F5EE' : m >= 15 ? '#FFFBEB' : '#FDF0EE';

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Catalogue" sub="Manage your products, pricing, and stock" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      {/* ─── Pending Price Approvals Banner (Owner Only) ─── */}
      {role !== 'employee' && pendingApprovals.length > 0 && (
        <div className="mx-3 sm:mx-5 max-w-[1200px] mb-[-4px]">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-[20px]">🔔</span>
              <div>
                <div className="text-[13px] font-bold text-amber-900">
                  {pendingApprovals.length} Price Change {pendingApprovals.length === 1 ? 'Request' : 'Requests'} Pending Approval
                </div>
                <div className="text-[11px] text-amber-700">
                  Staff proposed new branch selling prices. Review and approve to apply them.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowApprovalsModal(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[12px] rounded-lg cursor-pointer shadow-sm transition-colors shrink-0"
            >
              Review Requests ({pendingApprovals.length})
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.product && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setDeleteModal({ open: false, product: null })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[380px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="text-[28px] mb-3 text-center">🗑️</div>
            <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] text-center mb-1">Remove Product?</h3>
            <p className="text-[13px] text-[var(--color-muted)] text-center mb-5 leading-relaxed">
              Remove <strong>&quot;{deleteModal.product.name}&quot;</strong> from the catalogue?<br />
              This will also remove its sales history references.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, product: null })} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)] cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-[var(--color-red)] text-white rounded-xl font-bold text-[14px] hover:opacity-90 cursor-pointer">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Price Approvals Modal (Owner Only) ─── */}
      {showApprovalsModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setShowApprovalsModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[620px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--color-line-lt)]">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">🔔 Staff Price Change Requests</h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Review selling prices submitted by your branch staff</p>
              </div>
              <button onClick={() => setShowApprovalsModal(false)} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-line-lt)] pr-1">
              {pendingApprovals.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--color-muted)]">No pending price change requests.</div>
              ) : (
                pendingApprovals.map(p => (
                  <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-[var(--color-ink)]">{p.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Branch: <strong className="text-[var(--color-teal)]">{p.branch_name || 'Main Branch'}</strong> · Proposed by: {p.pending_price_staff || 'Staff'}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[13px]">
                        <span className="text-[var(--color-muted)] line-through">Current: {fmt(p.sell_price)}</span>
                        <span className="text-[var(--color-teal)] font-bold text-[14px]">➔ Proposed: {fmt(p.pending_sell_price || 0)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRejectPrice(p)}
                        disabled={approvingId === p.id}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[12px] rounded-lg transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprovePrice(p)}
                        disabled={approvingId === p.id}
                        className="px-4 py-1.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[12px] rounded-lg transition-colors cursor-pointer"
                      >
                        {approvingId === p.id ? 'Saving…' : '✓ Approve'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--color-line-lt)] flex justify-end">
              <button onClick={() => setShowApprovalsModal(false)} className="px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sync Catalogue Modal (Owner Multi-Branch) ─── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setShowSyncModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--color-line-lt)]">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">🔗 Copy / Sync Branch Catalogue</h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Duplicate product catalogue to avoid manual double entry</p>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Source Branch (Copy From)</label>
                <select
                  value={syncSource}
                  onChange={e => setSyncSource(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]"
                >
                  {['Main Branch', 'Branch 2', 'Branch 3'].map(b => (
                    <option key={b} value={b}>{b} ({branchBizTypes[b] || 'retail'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Target Branch (Copy Into)</label>
                <select
                  value={syncTarget}
                  onChange={e => setSyncTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]"
                >
                  {['Main Branch', 'Branch 2', 'Branch 3'].filter(b => b !== syncSource).map(b => (
                    <option key={b} value={b}>{b} ({branchBizTypes[b] || 'retail'})</option>
                  ))}
                </select>
              </div>

              {/* Diversified vs Homogeneous Warning / Notice */}
              {branchBizTypes[syncSource] === branchBizTypes[syncTarget] ? (
                <div className="p-3 bg-[var(--color-teal-bg)] border border-[var(--color-teal)]/20 rounded-xl text-[12px] text-[var(--color-teal)] font-semibold">
                  ✓ Both branches share the same business type ({branchBizTypes[syncSource] || 'retail'}). Products, categories, and wholesale pricing will be copied without duplicates.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
                  ⚠️ <strong>Notice:</strong> {syncSource} is configured as <strong>{branchBizTypes[syncSource]}</strong> while {syncTarget} is configured as <strong>{branchBizTypes[syncTarget]}</strong>. It is generally recommended to keep catalogues separate for diversified store types (e.g. Chemist vs Pub).
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSyncModal(false)} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleSyncCatalogue}
                  disabled={syncing}
                  className="flex-1 py-2.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[13px] rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {syncing ? 'Copying…' : 'Confirm & Sync'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">
                {branchName ? `${branchName} Products` : 'All Products'}
              </span>
              <span className="text-[12px] bg-[var(--color-canvas)] text-[var(--color-slate)] font-bold px-2 py-0.5 rounded-full border border-[var(--color-line)]">
                {filtered.length} of {products.length}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="flex-1 sm:w-[170px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] bg-white"
                />
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  className="w-[110px] sm:w-[130px] px-2 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white font-medium text-[var(--color-ink)]"
                >
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              
              {/* Owner Actions: Sync + Import Excel */}
              {role !== 'employee' && (
                <div className="flex gap-2 w-full sm:w-auto">
                  {scale === 'multi' && (
                    <button
                      onClick={() => setShowSyncModal(true)}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[12px] rounded-lg hover:bg-gray-100 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      title="Sync or copy catalogue between branches"
                    >
                      🔗 Sync Catalogue
                    </button>
                  )}
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-[var(--color-gold)] text-white font-bold text-[12px] rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    📥 Import Excel
                  </button>
                </div>
              )}

              {/* Add Product — available to all roles */}
              <button
                onClick={openAdd}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                + Add Product
              </button>
            </div>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading products…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-[36px] mb-2">📦</div>
                <div className="text-[14px] font-semibold text-[var(--color-ink)] mb-1">No products found</div>
                <div className="text-[12px] text-[var(--color-muted)]">
                  {role === 'employee' ? 'No products in this branch yet. Tap "+ Add Product" to add one.' : 'Click "+ Add Product" or "Import Excel" to start.'}
                </div>
              </div>
            ) : filtered.map(p => {
              const m = margin(p);
              const isLow = p.stock < p.reorder_level;
              const hasPendingPrice = p.pending_sell_price !== null && p.pending_sell_price !== undefined;

              return (
                <div key={p.id} className="p-3.5 flex flex-col gap-2.5 bg-white hover:bg-[var(--color-canvas)] transition-colors">
                  {/* Top Row: Name & Category */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-[14px] text-[var(--color-ink)] leading-snug">{p.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Unit: {p.unit} · Supplier: {p.supplier || 'N/A'}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-0.5 rounded-full border border-[var(--color-line)] shrink-0">
                      {p.category || 'General'}
                    </span>
                  </div>

                  {/* Pending Price Flag */}
                  {hasPendingPrice && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800 font-medium">
                      ⏳ Pending Price: <strong>{fmt(p.pending_sell_price || 0)}</strong> (Current: {fmt(p.sell_price)})
                    </div>
                  )}

                  {/* Middle Row: Numbers Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-line-lt)] text-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Sell Price</div>
                      <div className="font-bold text-[13px] text-[var(--color-ink)] mt-0.5">{fmt(p.sell_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Stock</div>
                      <div className={`font-bold text-[13px] mt-0.5 ${isLow ? 'text-[var(--color-red)]' : 'text-[var(--color-ink)]'}`}>
                        {p.stock} {isLow && '⚠'}
                      </div>
                      <div className="text-[9px] text-[var(--color-muted)]">min {p.reorder_level}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Margin</div>
                      <div className="mt-0.5">
                        {m !== null ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: marginColor(m), background: marginBg(m) }}>{m}%</span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-muted)] italic">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="flex-1 py-1.5 bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold text-[12px] rounded-lg text-center hover:opacity-80 cursor-pointer"
                    >
                      {role === 'employee' ? '🏷️ Edit Selling Price' : '✏️ Edit'}
                    </button>
                    {role !== 'employee' && (
                      <button
                        onClick={() => del(p)}
                        className="flex-1 py-1.5 bg-[var(--color-red-bg)] text-[var(--color-red)] font-bold text-[12px] rounded-lg text-center hover:opacity-80 cursor-pointer"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── DESKTOP DATA TABLE (md+) ─── */}
          <div className="hidden md:block overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse" style={{ minWidth: 720 }}>
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]">
                  {['Product', 'Category', 'Supplier', 'Sell Price', 'Cost Price', 'Margin', 'Stock', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em] whitespace-nowrap ${i === 0 ? 'sticky left-0 z-20 bg-[var(--color-canvas)] shadow-[1px_0_0_var(--color-line-lt)]' : ''}`}>{h}</th>
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
                      <div className="text-[12px] text-[var(--color-muted)]">
                        {role === 'employee' ? 'No products in this branch yet. Click "+ Add Product" to add one.' : 'Click "+ Add Product" to start building your catalogue.'}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const m = margin(p);
                  const isLow = p.stock < p.reorder_level;
                  const hasPendingPrice = p.pending_sell_price !== null && p.pending_sell_price !== undefined;

                  return (
                    <tr key={p.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors group">
                      <td className="px-4 py-3 sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line-lt)] group-hover:bg-[#fafafa] transition-colors">
                        <div className="font-semibold text-[13px] text-[var(--color-ink)]">{p.name}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">{p.unit}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--color-muted)]">{p.supplier || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[13px] text-[var(--color-ink)]">{fmt(p.sell_price)}</div>
                        {hasPendingPrice && (
                          <div className="text-[10px] text-amber-600 font-semibold">⏳ Req: {fmt(p.pending_sell_price || 0)}</div>
                        )}
                      </td>
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
                          <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">
                            {role === 'employee' ? 'Edit Price' : 'Edit'}
                          </button>
                          {role !== 'employee' && (
                            <button onClick={() => del(p)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">Del</button>
                          )}
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
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-2">
              {editItem ? (role === 'employee' ? 'Update Branch Selling Price' : 'Edit Product') : 'Add New Product'}
            </h2>
            {role === 'employee' && editItem && (
              <p className="text-[12px] text-[var(--color-muted)] mb-4">
                Enter your branch selling price below.
              </p>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Product Name *</label>
                <ProperCaseInput
                  disabled={role === 'employee' && !!editItem}
                  value={form.name}
                  onChange={v => setForm((p: any) => ({...p, name: v}))}
                  className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Category, Supplier, Unit, Reorder — shown to owners always; shown to employees when adding new product */}
              {(role !== 'employee' || !editItem) && (
                <>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
                    <ProperCaseInput value={form.category} onChange={v => setForm((p: any) => ({...p, category: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Beer, Grocery…" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Supplier</label>
                    <ProperCaseInput value={form.supplier} list="sup-list" onChange={v => setForm((p: any) => ({...p, supplier: v}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Select supplier" />
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
                </>
              )}

              <div className={role === 'employee' && editItem ? 'col-span-2' : ''}>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Selling Price (KES) *</label>
                <input
                  type="number"
                  value={form.sell_price}
                  onChange={e => setForm((p: any) => ({...p, sell_price: e.target.value}))}
                  className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] font-bold text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
                />
              </div>

              {role !== 'employee' && (
                <>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Expiry Date (Optional)</label>
                    <input type="date" value={form.expiry_date} onChange={e => setForm((p: any) => ({...p, expiry_date: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                      Cost Price (KES) <span className="text-[var(--color-muted)] font-normal">— optional</span>
                    </label>
                    <input type="number" value={form.cost_price} onChange={e => setForm((p: any) => ({...p, cost_price: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Leave blank if unknown" />
                  </div>
                </>
              )}

              {form.sell_price && form.cost_price && role !== 'employee' && (
                <div className="col-span-2 bg-[var(--color-teal-bg)] rounded-xl px-3 py-2.5 text-[12px] text-[var(--color-teal)] font-semibold">
                  Margin: {fmt(parseFloat(form.sell_price) - parseFloat(form.cost_price))} per unit
                  ({parseFloat(form.sell_price) > 0 ? Math.round(((parseFloat(form.sell_price) - parseFloat(form.cost_price)) / parseFloat(form.sell_price)) * 100) : 0}%)
                </div>
              )}
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] cursor-pointer text-[var(--color-slate)]">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.sell_price} className="flex-1 py-2.5 bg-[var(--color-teal)] text-white rounded-xl font-bold text-[14px] cursor-pointer disabled:opacity-50">
                {saving ? 'Saving…' : editItem ? (role === 'employee' ? 'Submit Price Update' : 'Save Changes') : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Excel Import Modal ─────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[600] p-3" onClick={closeImport}>
          <div className="bg-white rounded-[20px] w-full max-w-[720px] shadow-[0_32px_80px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-line-lt)] shrink-0">
              <div>
                <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">📥 Import Products from Excel</h2>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Upload an .xlsx or .csv file to bulk-add products to your catalogue</p>
              </div>
              <button onClick={closeImport} className="w-8 h-8 rounded-full bg-[var(--color-canvas)] flex items-center justify-center text-[var(--color-slate)] hover:bg-[var(--color-line-lt)] text-[16px] font-bold cursor-pointer">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">

              {/* Step 1: Download Template */}
              <div className="flex items-start gap-3 bg-[var(--color-teal-bg)] rounded-xl p-4 border border-[var(--color-teal)]/20">
                <div className="text-[24px] shrink-0">1️⃣</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-[var(--color-ink)] mb-0.5">Download the template</div>
                  <div className="text-[12px] text-[var(--color-slate)] mb-2 leading-relaxed">Fill in your products using our pre-formatted Excel template. Required columns: <strong>name</strong>, <strong>sell_price</strong>. All others are optional.</div>
                  <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-lg hover:opacity-90 cursor-pointer">
                    ⬇ Download Template (.xlsx)
                  </button>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="flex items-start gap-3 bg-[var(--color-canvas)] rounded-xl p-4 border border-[var(--color-line-lt)]">
                <div className="text-[24px] shrink-0">2️⃣</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-[var(--color-ink)] mb-0.5">Upload your filled file</div>
                  <div className="text-[12px] text-[var(--color-slate)] mb-2">Supports .xlsx, .xls, and .csv files. First row must be column headers.</div>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--color-line)] rounded-xl p-5 cursor-pointer hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] transition-all">
                    <div className="text-[32px]">📂</div>
                    <div className="text-[13px] font-semibold text-[var(--color-slate)]">Click to browse or drag & drop</div>
                    <div className="text-[11px] text-[var(--color-muted)]">.xlsx · .xls · .csv</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
                    />
                  </label>
                </div>
              </div>

              {/* Step 3: Preview & Validate */}
              {importRows.length > 0 && !importDone && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-[13px] text-[var(--color-ink)]">
                      3️⃣ Preview — <span className="text-[var(--color-emerald)]">{importRows.filter(r => r._valid).length} valid</span>
                      {importRows.filter(r => !r._valid).length > 0 && (
                        <span className="text-[var(--color-red)] ml-2">{importRows.filter(r => !r._valid).length} will be skipped</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--color-muted)]">{importRows.length} rows detected</span>
                  </div>
                  <div className="overflow-auto max-h-[240px] border border-[var(--color-line-lt)] rounded-xl">
                    <table className="w-full border-collapse text-[12px]" style={{ minWidth: 560 }}>
                      <thead className="sticky top-0 z-10 bg-[var(--color-canvas)] shadow-[0_1px_0_var(--color-line-lt)]">
                        <tr>
                          {['', 'Name', 'Category', 'Unit', 'Sell Price', 'Cost Price', 'Stock', 'Issue'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} className={`border-b border-[var(--color-line-lt)] last:border-0 ${r._valid ? 'bg-white' : 'bg-[var(--color-red-bg)]'}`}>
                            <td className="px-3 py-2 text-center">{r._valid ? '✅' : '❌'}</td>
                            <td className="px-3 py-2 font-semibold text-[var(--color-ink)] max-w-[140px] truncate">{r.name || <span className="italic text-[var(--color-muted)]">empty</span>}</td>
                            <td className="px-3 py-2 text-[var(--color-slate)]">{r.category}</td>
                            <td className="px-3 py-2 text-[var(--color-slate)]">{r.unit}</td>
                            <td className="px-3 py-2 font-bold text-[var(--color-ink)]">{r.sell_price > 0 ? fmt(r.sell_price) : '—'}</td>
                            <td className="px-3 py-2 text-[var(--color-slate)]">{r.cost_price > 0 ? fmt(r.cost_price) : '—'}</td>
                            <td className="px-3 py-2 text-[var(--color-slate)]">{r.stock}</td>
                            <td className="px-3 py-2 text-[var(--color-red)] text-[11px]">{r._errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Done Banner */}
              {importDone && (
                <div className="bg-[var(--color-emerald-bg)] border border-[var(--color-emerald)]/30 rounded-xl p-4 text-center">
                  <div className="text-[28px] mb-1">🎉</div>
                  <div className="font-serif text-[16px] font-bold text-[var(--color-emerald)]">{importDone.added} products imported successfully!</div>
                  {importDone.skipped > 0 && (
                    <div className="text-[12px] text-[var(--color-muted)] mt-1">{importDone.skipped} rows were skipped due to missing required fields.</div>
                  )}
                  <button onClick={closeImport} className="mt-3 px-5 py-2 bg-[var(--color-emerald)] text-white font-bold text-[13px] rounded-xl hover:opacity-90 cursor-pointer">
                    Done ✓
                  </button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {importRows.length > 0 && !importDone && (
              <div className="flex gap-3 p-4 border-t border-[var(--color-line-lt)] shrink-0">
                <button onClick={closeImport} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)] cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || importRows.filter(r => r._valid).length === 0}
                  className="flex-1 py-2.5 bg-[var(--color-teal)] text-white rounded-xl font-bold text-[14px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? '⏳ Importing…' : `Import ${importRows.filter(r => r._valid).length} Products`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
