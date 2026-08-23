'use client';

import { Topbar } from '@/components/Topbar';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

type InvItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder_level: number;
  supplier: string;
  expiry_date?: string | null;
  expiry_qty?: number;
};

type SupplierRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type LpoGroup = {
  supplier: string;
  phone: string;
  email: string;
  items: { name: string; stock: number; reorder_level: number; qty: number }[];
};

const fmt = (n: number) => n.toLocaleString();

function buildLpoText(group: LpoGroup, profile: any) {
  const date = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let text = `📄 LOCAL PURCHASE ORDER (LPO)\n`;
  text += `From: ${profile?.store_name || 'My Store'}\n`;
  if (profile?.store_phone) text += `Store Phone: ${profile.store_phone}\n`;
  if (profile?.store_email) text += `Store Email: ${profile.store_email}\n`;
  text += `To: ${group.supplier}\n`;
  text += `Date: ${date}\n\n`;
  text += `ITEMS REQUESTED:\n`;
  group.items.forEach((item, i) => {
    text += `${i + 1}. ${item.name} — Qty: ${item.qty} units (Current stock: ${item.stock})\n`;
  });
  text += `\nPlease confirm availability and delivery date.\nThank you.`;
  return text;
}

const generatePDF = (group: LpoGroup, storeProfile: any, fire: (msg: string) => void) => {
  import('jspdf').then(({ default: jsPDF }) => {
    import('jspdf-autotable').then(({ default: autoTable }) => {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.setTextColor(10, 92, 107);
      doc.text('LOCAL PURCHASE ORDER', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`From: ${storeProfile?.store_name || 'My Store'}`, 14, 32);
      if (storeProfile?.store_phone) doc.text(`Phone: ${storeProfile.store_phone}`, 14, 38);
      if (storeProfile?.store_email) doc.text(`Email: ${storeProfile.store_email}`, 14, 44);
      
      doc.text(`To: ${group.supplier}`, 120, 32);
      doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 120, 38);
      
      const tableData = group.items.map((item, i) => [
        i + 1,
        item.name,
        item.stock,
        item.qty
      ]);
      
      autoTable(doc, {
        startY: 55,
        head: [['#', 'Item Description', 'Current Stock', 'Order Qty']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [10, 92, 107] },
        styles: { fontSize: 10, cellPadding: 4 }
      });
      
      const filename = `LPO_${group.supplier.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Local Purchase Order',
          text: `Please find attached our Local Purchase Order from ${storeProfile?.store_name || 'our store'}.`,
        }).then(() => {
          fire(`✓ LPO Shared successfully!`);
        }).catch((err) => {
          console.error('Share failed:', err);
          doc.save(filename);
          fire(`✓ LPO PDF Downloaded`);
        });
      } else {
        doc.save(filename);
        fire(`✓ LPO PDF Downloaded for ${group.supplier}`);
      }
    });
  });
};

export default function SituationRoomPage() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'stock' | 'alerts' | 'expiry'>('overview');
  const [stockSearch, setStockSearch] = useState('');
  const [expirySearch, setExpirySearch] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [manualOrders, setManualOrders] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const { storeId, branchName } = useStore();

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!storeId) return;

      const curBranch = branchName || 'Main Branch';
      const [{ data: inv }, { data: sups }, { data: profile }] = await Promise.all([
        supabase.from('inventory').select('*').eq('user_id', storeId!).eq('branch_name', curBranch).order('name'),
        supabase.from('suppliers').select('id, name, phone, email').eq('user_id', storeId!).eq('branch_name', curBranch),
        supabase.from('users').select('store_name, store_phone, store_email').eq('id', storeId!).single(),
      ]);

      if (inv) {
        setItems(inv);
        const initQtys: Record<string, number> = {};
        inv.forEach(i => { initQtys[i.id] = Math.max(i.reorder_level || 10, 10); });
        setQtys(initQtys);
      }
      if (sups) setSuppliers(sups as SupplierRecord[]);
      if (profile) setStoreProfile(profile);
      setLoading(false);
    };
    fetchData();
  }, [storeId, branchName]);

  const [loggedItems, setLoggedItems] = useState<Record<string, number>>({});

  const updateStock = async (id: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    if (newStock === currentStock) return;
    const supabase = createClient();
    await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock: newStock } : i));
    setLoggedItems(prev => ({ ...prev, [id]: newStock }));
    fire(`✓ Stock updated to ${newStock}`);
  };

  const updateExpiry = async (id: string, field: 'expiry_date' | 'expiry_qty', val: any) => {
    const supabase = createClient();
    const cleanVal = val === '' ? null : val;
    await supabase.from('inventory').update({ [field]: cleanVal }).eq('id', id);
    setItems(items.map(i => i.id === id ? { ...i, [field]: cleanVal } : i));
    if (field === 'expiry_date') fire('Expiry date updated');
    if (field === 'expiry_qty') fire('Expiring quantity updated');
  };

  const addToOrder = (id: string) => {
    if (!manualOrders.includes(id)) {
      setManualOrders(prev => [...prev, id]);
    }
    setTab('alerts');
    fire('✓ Item added to order');
  };

  // Overview stats
  const totalProducts = items.length;
  const totalCategories = new Set(items.map(i => i.category || 'General')).size;
  const totalSuppliers = suppliers.length;

  // Alerts & Orders
  const alertItems = items.filter(i => i.stock < i.reorder_level || i.stock === 0 || manualOrders.includes(i.id));
  const outCount = alertItems.filter(i => i.stock === 0).length;
  const lowCount = alertItems.filter(i => i.stock > 0 && i.stock < i.reorder_level).length;

  // Group alerts by supplier
  const lpoGroups: LpoGroup[] = [];
  const supplierMap: Record<string, LpoGroup> = {};

  alertItems.forEach(item => {
    const supplierName = item.supplier || 'Unknown Supplier';
    const supplierRecord = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
    if (!supplierMap[supplierName]) {
      supplierMap[supplierName] = {
        supplier: supplierName,
        phone: supplierRecord?.phone || '',
        email: supplierRecord?.email || '',
        items: [],
      };
      lpoGroups.push(supplierMap[supplierName]);
    }
    supplierMap[supplierName].items.push({
      name: item.name,
      stock: item.stock,
      reorder_level: item.reorder_level,
      qty: qtys[item.id] || item.reorder_level || 10,
    });
  });

  // Stock filter
  const filteredStock = items.filter(p =>
    p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(stockSearch.toLowerCase())
  );

  // Expiry tracking
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  const expiringAlertItems = items.filter(i => {
    if (!i.expiry_date) return false;
    const expDate = new Date(i.expiry_date);
    return expDate <= thirtyDaysFromNow;
  });

  const expiryList = items.filter(p => 
    p.name.toLowerCase().includes(expirySearch.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(expirySearch.toLowerCase())
  ).sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
  });

  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'stock', label: 'Stock Manager', icon: '📦' },
    { id: 'alerts', label: 'Alerts & Orders', icon: '⚡', badge: alertItems.length },
    { id: 'expiry', label: 'Expiry Tracking', icon: '⏳', badge: expiringAlertItems.length },
  ] as const;

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Situation Room" sub="Inventory & Expiry Tracker" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1100px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* Tab Bar */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-[1.5px] font-semibold text-[13px] transition-all cursor-pointer ${tab === t.id ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white shadow-[0_4px_12px_rgba(10,92,107,0.2)]' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
              <span>{t.icon}</span>
              {t.label}
              {'badge' in t && t.badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/30 text-white' : 'bg-[var(--color-red)] text-white'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB: OVERVIEW ─── */}
        {tab === 'overview' && (
          <div className="flex flex-col gap-5">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Products', value: totalProducts, color: 'var(--color-teal)', bg: 'var(--color-teal-bg)', icon: '📦' },
                { label: 'Product Categories', value: totalCategories, color: 'var(--color-gold)', bg: 'var(--color-gold-pale)', icon: '🏷️' },
                { label: 'Registered Suppliers', value: totalSuppliers, color: 'var(--color-emerald)', bg: 'var(--color-emerald-bg)', icon: '🤝' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl p-5 border border-[var(--color-line-lt)] shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[22px]" style={{ background: card.bg }}>{card.icon}</div>
                  <div>
                    <div className="font-serif text-[32px] font-bold leading-none" style={{ color: card.color }}>{loading ? '—' : card.value}</div>
                    <div className="text-[12px] text-[var(--color-muted)] mt-1 font-medium">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Alert summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { label: 'Out of Stock', n: outCount, color: '#C0392B', bg: '#FDF0EE', note: 'Immediate reorder needed' },
                { label: 'Low Stock', n: lowCount, color: '#D97706', bg: '#FFFBEB', note: 'Below reorder threshold' },
                { label: 'In Stock', n: totalProducts - alertItems.length, color: '#1A7A4A', bg: '#E8F5EE', note: 'Healthy stock levels' },
              ].map(x => (
                <div key={x.label} className="rounded-2xl p-4 border" style={{ background: x.bg, borderColor: `${x.color}22` }}>
                  <div className="font-serif text-[28px] font-bold" style={{ color: x.color }}>{loading ? '—' : x.n}</div>
                  <div className="text-[13px] font-bold" style={{ color: x.color }}>{x.label}</div>
                  <div className="text-[11px] opacity-70 mt-0.5" style={{ color: x.color }}>{x.note}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] text-[13px] text-[var(--color-slate)]">
              💡 Use the <strong>Stock Manager</strong> tab to adjust stock levels, and <strong>Alerts & Orders</strong> to generate and send LPOs to suppliers.
            </div>
          </div>
        )}

        {/* ─── TAB: STOCK MANAGER ─── */}
        {tab === 'stock' && (
          <div className="flex flex-col gap-4">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total Products', val: items.length, color: 'var(--color-ink)' },
                { label: 'Total in Stock', val: items.reduce((a, p) => a + p.stock, 0).toLocaleString(), color: 'var(--color-teal)' },
                { label: 'Low Stock', val: items.filter(p => p.stock > 0 && p.stock <= p.reorder_level).length, color: 'var(--color-amber)' },
                { label: 'Out of Stock', val: items.filter(p => p.stock === 0).length, color: 'var(--color-red)' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 border border-[var(--color-line-lt)] shadow-sm">
                  <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">{k.label}</div>
                  <div className="font-serif text-[20px] font-bold" style={{ color: k.color }}>{loading ? '—' : k.val}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
              <div className="p-3 border-b border-[var(--color-line-lt)] flex gap-2 flex-wrap items-center">
                <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search products…"
                  className="flex-1 min-w-[130px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>

              {/* Responsive Table */}
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                  <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className=" bg-[var(--color-canvas)]">
                      {['Product', 'Category', 'Status', 'Stock Level', 'Quick Adjust'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading stock...</td></tr>
                    ) : filteredStock.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No products found. Add products in the Catalogue.</td></tr>
                    ) : filteredStock.map(p => {
                      const isOut = p.stock === 0;
                      const isLow = !isOut && p.stock <= p.reorder_level;
                      const isLogged = loggedItems[p.id] !== undefined;
                      return (
                        <tr key={p.id} className={`border-b border-[var(--color-line-lt)] last:border-0 transition-colors ${isLogged ? 'bg-[var(--color-teal-bg)]/40' : 'hover:bg-[#fafafa]'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-[13px] text-[var(--color-ink)]">{p.name}</div>
                              {isLogged && <span className="text-[9px] font-bold bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] px-1.5 py-0.5 rounded-full border border-[var(--color-emerald)]/20">✓ Logged</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{p.category || 'General'}</span>
                          </td>
                          <td className="px-4 py-3">
                            {isOut ? (
                              <span className="bg-[var(--color-red-bg)] text-[var(--color-red)] text-[10px] font-bold px-2 py-1 rounded-full">OUT</span>
                            ) : isLow ? (
                              <span className="bg-[var(--color-amber-bg)] text-[var(--color-amber)] text-[10px] font-bold px-2 py-1 rounded-full">LOW</span>
                            ) : (
                              <span className="bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] text-[10px] font-bold px-2 py-1 rounded-full">OK</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-serif text-[16px] font-bold text-[var(--color-ink)]">
                            {p.stock} <span className="font-sans text-[11px] text-[var(--color-muted)] font-normal">{p.unit}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateStock(p.id, p.stock, -1)} className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[13px] font-bold hover:bg-[var(--color-red-bg)] hover:text-[var(--color-red)] hover:border-[var(--color-red-bg)] flex items-center justify-center transition-colors">-1</button>
                              <button onClick={() => updateStock(p.id, p.stock, 1)} className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[13px] font-bold hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)] hover:border-[var(--color-teal-bg)] flex items-center justify-center transition-colors">+1</button>
                              <button onClick={() => updateStock(p.id, p.stock, 10)} className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[11px] font-bold hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)] hover:border-[var(--color-teal-bg)] flex items-center justify-center transition-colors">+10</button>
                              <button onClick={() => addToOrder(p.id)} className="h-8 px-3 ml-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] text-[11px] font-bold text-[var(--color-ink)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] flex items-center justify-center transition-colors whitespace-nowrap">🛒 Order</button>
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
        )}

        {/* ─── TAB: ALERTS & ORDERS ─── */}
        {tab === 'alerts' && (
          <div className="flex flex-col gap-5">
            {/* Summary chips */}
            <div className="flex gap-3 flex-wrap">
              <div className="bg-[#FDF0EE] border border-[#C0392B22] rounded-xl px-4 py-2.5 text-[#C0392B]">
                <span className="font-bold text-[18px]">{outCount}</span> <span className="text-[12px] font-semibold">Out of Stock</span>
              </div>
              <div className="bg-[#FFFBEB] border border-[#D9770622] rounded-xl px-4 py-2.5 text-[#D97706]">
                <span className="font-bold text-[18px]">{lowCount}</span> <span className="text-[12px] font-semibold">Low Stock</span>
              </div>
              {alertItems.length === 0 && (
                <div className="bg-[var(--color-emerald-bg)] border border-[var(--color-emerald)]/20 rounded-xl px-4 py-2.5 text-[var(--color-emerald)]">
                  <span className="font-bold">✅ All Clear!</span> <span className="text-[12px]">No alerts right now</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-10 text-[var(--color-slate)]">Loading alerts...</div>
            ) : alertItems.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[var(--color-line-lt)]">
                <div className="text-[40px] mb-3">✅</div>
                <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-1">All stock levels are healthy!</h3>
                <p className="text-[13px] text-[var(--color-muted)]">No items require reordering at this time.</p>
              </div>
            ) : lpoGroups.map(group => {
              const groupKey = group.supplier;
              const isSent = !!sent[groupKey];
              const lpoText = buildLpoText(group, storeProfile);
              const waUrl = group.phone
                ? `https://wa.me/${group.phone.replace(/\D/g, '')}?text=${encodeURIComponent(lpoText)}`
                : '';
              const mailUrl = group.email
                ? `mailto:${group.email}?subject=${encodeURIComponent(`LPO — ${new Date().toLocaleDateString('en-KE')}`)}&body=${encodeURIComponent(lpoText)}`
                : '';

              return (
                <div key={groupKey} className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
                  {/* Supplier header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                    <div>
                      <div className="font-serif text-[15px] font-bold text-[var(--color-ink)]">🤝 {group.supplier}</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        {group.items.length} item{group.items.length !== 1 ? 's' : ''} to reorder
                        {group.phone && <span className="ml-2">· 📱 +{group.phone.replace(/\D/g, '')}</span>}
                        {group.email && <span className="ml-2">· ✉️ {group.email}</span>}
                      </div>
                    </div>
                    {isSent && (
                      <span className="text-[12px] font-bold text-[var(--color-emerald)] bg-[var(--color-emerald-bg)] px-3 py-1.5 rounded-lg border border-[var(--color-emerald)]/20">✓ LPO Sent</span>
                    )}
                  </div>

                  {/* Responsive Table */}
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full border-collapse" style={{ minWidth: 400 }}>
                      <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="">
                          {['Product', 'Status', 'Current Stock', 'Reorder Level', 'Order Qty'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => (
                          <tr key={item.name} className="border-b border-[var(--color-line-lt)] last:border-0">
                            <td className="px-4 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]">{item.name}</td>
                            <td className="px-4 py-2.5">
                              {item.stock === 0
                                ? <span className="text-[10px] font-bold uppercase bg-[var(--color-red-bg)] text-[var(--color-red)] px-2 py-1 rounded-full">Out</span>
                                : <span className="text-[10px] font-bold uppercase bg-[var(--color-amber-bg)] text-[var(--color-amber)] px-2 py-1 rounded-full">Low</span>
                              }
                            </td>
                            <td className="px-4 py-2.5 text-[13px] font-bold text-[var(--color-ink)]">{item.stock}</td>
                            <td className="px-4 py-2.5 text-[13px] text-[var(--color-slate)]">{item.reorder_level}</td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number" min="1"
                                value={qtys[items.find(i => i.name === item.name)?.id || ''] || item.reorder_level}
                                onChange={e => {
                                  const inv = items.find(i => i.name === item.name);
                                  if (inv) setQtys(prev => ({ ...prev, [inv.id]: parseInt(e.target.value) || 0 }));
                                }}
                                className="w-[70px] px-2 py-1.5 border border-[var(--color-line)] rounded-lg text-[13px] outline-none text-center focus:border-[var(--color-teal)]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* LPO preview + actions */}
                  <div className="px-5 py-4 border-t border-[var(--color-line-lt)] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="text-[12px] text-[var(--color-muted)] bg-[var(--color-canvas)] rounded-lg p-3 flex-1 font-mono whitespace-pre-wrap max-h-[80px] overflow-y-auto">
                      {lpoText.split('\n').slice(0, 4).join('\n')}…
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => { setSent(prev => ({ ...prev, [groupKey]: true })); fire(`✓ LPO Successfully Sent to ${group.supplier} via WhatsApp`); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] text-white font-bold text-[13px] rounded-xl hover:opacity-90 transition-opacity"
                        >
                          💬 WhatsApp
                        </a>
                      ) : (
                        <span className="px-4 py-2 bg-[var(--color-canvas)] text-[var(--color-muted)] font-semibold text-[12px] rounded-xl border border-[var(--color-line)]">No phone</span>
                      )}
                      {mailUrl ? (
                        <a
                          href={mailUrl}
                          onClick={() => { setSent(prev => ({ ...prev, [groupKey]: true })); fire(`✓ LPO Successfully Sent to ${group.supplier} via Email`); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                          ✉️ Email
                        </a>
                      ) : (
                        <span className="px-4 py-2 bg-[var(--color-canvas)] text-[var(--color-muted)] font-semibold text-[12px] rounded-xl border border-[var(--color-line)] whitespace-nowrap">No email</span>
                      )}
                      <button
                        onClick={() => { generatePDF(group, storeProfile, fire); setSent(prev => ({ ...prev, [groupKey]: true })); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-[var(--color-teal)] text-[var(--color-teal)] font-bold text-[13px] rounded-xl hover:bg-[var(--color-teal-bg)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        📤 Share PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── TAB: EXPIRY TRACKING ─── */}
        {tab === 'expiry' && (
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Expiry Tracking</h2>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Record and monitor product expiration dates</p>
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={expirySearch}
                onChange={e => setExpirySearch(e.target.value)}
                className="px-3 py-2 border border-[var(--color-line)] rounded-xl text-[13px] outline-none focus:border-[var(--color-teal)] w-full sm:w-[250px]"
              />
            </div>
            {expiryList.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-[40px] mb-3">📭</div>
                <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">No products found</h3>
                <p className="text-[13px] text-[var(--color-muted)]">Check your search filter.</p>
              </div>
            ) : (
              <div>
                {/* Responsive View */}
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full min-w-[700px] text-left border-collapse">
                    <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]  text-[11px] uppercase tracking-wider text-[var(--color-muted)] font-bold">
                        <th className="p-3 pl-4">Product</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Current Stock</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Qty Expiring</th>
                        <th className="p-3 pr-4">Set Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-line-lt)]">
                      {expiryList.map(item => {
                        let statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200">Not Set</span>;
                        
                        if (item.expiry_date) {
                          const expDate = new Date(item.expiry_date);
                          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysLeft < 0) {
                            statusBadge = <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-[var(--color-red)] border border-red-100">Expired ({Math.abs(daysLeft)}d ago)</span>;
                          } else if (daysLeft <= 30) {
                            statusBadge = <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[var(--color-gold)] border border-orange-100">Expiring Soon ({daysLeft}d)</span>;
                          } else {
                            statusBadge = <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] border border-[var(--color-emerald)]/20">Fresh ({daysLeft}d)</span>;
                          }
                        }

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            <td className="p-3 pl-4">
                              <span className="font-bold text-[13px] text-[var(--color-ink)]">{item.name}</span>
                            </td>
                            <td className="p-3 text-[13px] text-[var(--color-slate)]">{item.category}</td>
                            <td className="p-3 text-[13px] font-semibold text-[var(--color-slate)]">{fmt(item.stock)}</td>
                            <td className="p-3">
                              {statusBadge}
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" min="0" placeholder="All"
                                value={item.expiry_qty || ''}
                                onChange={(e) => updateExpiry(item.id, 'expiry_qty', e.target.value)}
                                className="w-[80px] px-2 py-1.5 border border-[var(--color-line)] rounded-lg text-[13px] outline-none text-right focus:border-[var(--color-teal)]"
                              />
                            </td>
                            <td className="p-3 pr-4">
                              <input 
                                type="date"
                                value={item.expiry_date || ''}
                                onChange={(e) => updateExpiry(item.id, 'expiry_date', e.target.value)}
                                className="px-2 py-1.5 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
