'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

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
};

const CATS = ['General', 'Beverages', 'Produce', 'Meat', 'Dairy', 'Alcohol', 'Packaging'];

export default function SuppliersPage() {
  const { storeId, branchName } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);

  const BLANK = { name: '', category: 'General', contact_person: '', phone: '', email: '', terms: '', rating: 5, products: '' };
  const [form, setForm] = useState<any>(BLANK);
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchSuppliers = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('suppliers').select('*').eq('user_id', storeId).eq('branch_name', branchName || 'Main Branch').order('name', { ascending: true });
    if (!error && data) setSuppliers(data as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [storeId, branchName]);

  const cats = ['All', ...Array.from(new Set(suppliers.map(s => s.category || 'General')))];
  const filtered = suppliers.filter(s =>
    (catF === 'All' || (s.category || 'General') === catF) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || (s.contact_person || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAddForm(true); };
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, category: s.category || 'General', contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', terms: s.terms || '', rating: s.rating || 5, products: s.products || '' });
    setEditItem(s); setShowAddForm(true);
  };

  const save = async () => {
    if (!form.name || !storeId) return;
    const supabase = createClient();
    const entry = { user_id: storeId, name: form.name, category: form.category, contact_person: form.contact_person, phone: form.phone, email: form.email, terms: form.terms, rating: parseInt(form.rating) || 5, products: form.products, branch_name: branchName || 'Main Branch' };
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

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Suppliers" sub="Manage your vendors, terms, and contact details" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">All Suppliers</span>
              <span className="text-[12px] bg-[var(--color-canvas)] text-[var(--color-slate)] font-bold px-2 py-0.5 rounded-full border border-[var(--color-line)]">
                {filtered.length} of {suppliers.length}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search suppliers…"
                  className="flex-1 sm:w-[170px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] bg-white"
                />
                <select
                  value={catF}
                  onChange={e => setCatF(e.target.value)}
                  className="w-[110px] sm:w-[130px] px-2 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white font-medium text-[var(--color-ink)]"
                >
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={openAdd}
                className="w-full sm:w-auto px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                + Add Supplier
              </button>
            </div>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading suppliers...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-[36px] mb-2">🚚</div>
                <div className="text-[14px] font-semibold text-[var(--color-ink)] mb-1">No suppliers found</div>
                <div className="text-[12px] text-[var(--color-muted)]">Click "+ Add Supplier" to register your first vendor.</div>
              </div>
            ) : filtered.map(s => (
              <div key={s.id} className="p-3.5 flex flex-col gap-2.5 bg-white hover:bg-[var(--color-canvas)] transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold text-[14px] text-[var(--color-ink)]">{s.name}</div>
                    {s.contact_person && <div className="text-[11px] text-[var(--color-slate)] mt-0.5">Contact: {s.contact_person}</div>}
                    {s.products && <div className="text-[11px] text-[var(--color-muted)]">Supplies: {s.products}</div>}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-2 py-0.5 rounded-full border border-[var(--color-teal)]/20 shrink-0">
                    {s.category || 'General'}
                  </span>
                </div>

                {/* Info Pills */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--color-slate)]">
                  {s.terms && (
                    <span className="bg-[var(--color-canvas)] px-2 py-0.5 rounded-md border border-[var(--color-line-lt)]">
                      💳 {s.terms}
                    </span>
                  )}
                  <span className="text-[var(--color-gold)] font-bold">{stars(s.rating || 5)}</span>
                </div>

                {/* Direct Actions: WhatsApp / Email */}
                <div className="flex gap-2">
                  {s.phone && (
                    <a
                      href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1.5 bg-[#E8F8EE] text-[#1E7E34] border border-[#25D366]/30 font-bold text-[11px] rounded-lg text-center flex items-center justify-center gap-1 hover:opacity-90"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="flex-1 py-1.5 bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold text-[11px] rounded-lg text-center flex items-center justify-center gap-1 hover:opacity-90"
                    >
                      ✉️ Email
                    </a>
                  )}
                </div>

                {/* Edit & Delete */}
                <div className="flex gap-2 pt-1 border-t border-[var(--color-line-lt)]">
                  <button
                    onClick={() => openEdit(s)}
                    className="flex-1 py-1.5 bg-[var(--color-canvas)] text-[var(--color-teal)] border border-[var(--color-line)] font-bold text-[11px] rounded-lg text-center hover:bg-[var(--color-teal-bg)] cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => del(s)}
                    className="flex-1 py-1.5 bg-[var(--color-red-bg)] text-[var(--color-red)] font-bold text-[11px] rounded-lg text-center hover:opacity-80 cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── DESKTOP DATA TABLE (md+) ─── */}
          <div className="hidden md:block overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse" style={{ minWidth: 700 }}>
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]">
                  {['Supplier', 'Category', 'Contact Person', 'WhatsApp', 'Email', 'Payment Terms', 'Rating', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em] whitespace-nowrap ${i === 0 ? 'sticky left-0 z-20 bg-[var(--color-canvas)] shadow-[1px_0_0_var(--color-line-lt)]' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading suppliers...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="text-[40px] mb-2">🚚</div>
                      <div className="text-[14px] font-semibold text-[var(--color-ink)] mb-1">No suppliers found</div>
                      <div className="text-[12px] text-[var(--color-muted)]">Click "+ Add Supplier" to register your first vendor.</div>
                    </td>
                  </tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors group">
                    <td className="px-4 py-3 sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line-lt)] group-hover:bg-[#fafafa] transition-colors">
                      <div className="font-semibold text-[13px] text-[var(--color-ink)]">{s.name}</div>
                      {s.products && <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate max-w-[140px]">{s.products}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-2 py-1 rounded-full">{s.category || 'General'}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">{s.contact_person || '—'}</td>
                    <td className="px-4 py-3">
                      {s.phone ? (
                        <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          className="text-[12px] font-semibold text-[#25D366] hover:underline">
                          +{s.phone.replace(/\D/g, '')}
                        </a>
                      ) : <span className="text-[12px] text-[var(--color-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="hover:underline text-[var(--color-teal)]">{s.email}</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--color-slate)]">{s.terms || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-gold)] text-[12px]">{stars(s.rating || 5)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(s)}
                          className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">Edit</button>
                        <button onClick={() => del(s)}
                          className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] border-none rounded px-3 py-1.5 cursor-pointer hover:opacity-80">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[500px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-5">{editItem ? 'Edit Supplier' : 'Add New Supplier'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Supplier Name *</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Contact Person</label>
                <input value={form.contact_person} onChange={e => setForm((p: any) => ({...p, contact_person: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm((p: any) => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">WhatsApp (e.g. 254…)</label>
                <input value={form.phone} onChange={e => setForm((p: any) => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Numbers only" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Payment Terms</label>
                <input value={form.terms} onChange={e => setForm((p: any) => ({...p, terms: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Cash, 30 Days" />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Products Supplied (comma-separated)</label>
                <input value={form.products} onChange={e => setForm((p: any) => ({...p, products: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)]" placeholder="Beer, Soda, Water" />
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
                {editItem ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
