'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';

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

const CATS = ["General", "Beverages", "Produce", "Meat", "Dairy", "Alcohol", "Packaging"];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  
  const BLANK = { name: '', category: 'General', contact_person: '', phone: '', email: '', terms: '', rating: 5, products: '' };
  const [form, setForm] = useState<any>(BLANK);
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchSuppliers = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('name', { ascending: true });
    if (!error && data) {
      setSuppliers(data as Supplier[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const cats = ["All", ...Array.from(new Set(suppliers.map(s => s.category || 'General')))];
  
  const filtered = suppliers.filter(s => 
    (catF === 'All' || (s.category || 'General') === catF) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || (s.contact_person || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(BLANK); setEditItem(null); setShowAddForm(true); };
  const openEdit = (s: Supplier) => {
    setForm({ 
      name: s.name, category: s.category || 'General', contact_person: s.contact_person || '', 
      phone: s.phone || '', email: s.email || '', terms: s.terms || '', 
      rating: s.rating || 5, products: s.products || '' 
    });
    setEditItem(s); setShowAddForm(true);
  };

  const save = async () => {
    if (!form.name) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entry = {
      user_id: user.id,
      name: form.name,
      category: form.category,
      contact_person: form.contact_person,
      phone: form.phone,
      email: form.email,
      terms: form.terms,
      rating: parseInt(form.rating) || 5,
      products: form.products
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

    if (!error) {
      setShowAddForm(false);
      fetchSuppliers();
      if (selected && editItem) setSelected({ ...selected, ...entry });
    } else {
      console.error(error);
      fire('⚠ Please run schema_suppliers_update.sql to support all fields');
    }
  };

  const del = async (s: Supplier) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const supabase = createClient();
    await supabase.from('suppliers').delete().eq('id', s.id);
    fire(`${s.name} removed`);
    if (selected?.id === s.id) setSelected(null);
    fetchSuppliers();
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Suppliers" sub="Manage your vendors, terms, and LPOs" />
      
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-5 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-[var(--color-line-lt)] p-3 flex gap-2 flex-wrap items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
              className="flex-1 min-w-[130px] px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
            <select value={catF} onChange={e => setCatF(e.target.value)}
              className="px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={openAdd}
              className="px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90 whitespace-nowrap">
              + Add Supplier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-10 text-[var(--color-slate)] text-[14px]">Loading suppliers...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl p-8 text-center border border-[var(--color-line-lt)]">
                <div className="text-[40px] mb-3">🚚</div>
                <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-1">No suppliers found</h3>
              </div>
            ) : filtered.map(s => (
              <div key={s.id} onClick={() => setSelected(s)}
                className={`bg-white rounded-xl p-4 border transition-colors cursor-pointer ${selected?.id === s.id ? 'border-[var(--color-teal)] ring-1 ring-[var(--color-teal)]' : 'border-[var(--color-line-lt)] hover:border-[var(--color-teal)]'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-serif text-[15px] font-bold text-[var(--color-ink)] mb-1.5">{s.name}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-2 py-1 rounded-full">{s.category || 'General'}</span>
                  </div>
                  <div className="text-[var(--color-gold)] text-[12px]">
                    {'★'.repeat(s.rating || 5)}{'☆'.repeat(5 - (s.rating || 5))}
                  </div>
                </div>
                <div className="text-[12px] text-[var(--color-slate)] mb-1">👤 {s.contact_person || 'N/A'}</div>
                <div className="text-[12px] text-[var(--color-slate)] mb-1">📱 {s.phone ? '+' + s.phone.replace('+','') : 'N/A'}</div>
                <div className="text-[12px] text-[var(--color-slate)] mb-3">💳 {s.terms || 'N/A'}</div>
                
                <div className="flex gap-2">
                  <a href={s.phone ? `https://wa.me/${s.phone.replace(/\D/g,'')}` : '#'} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-[12px] text-center ${s.phone ? 'bg-[var(--color-teal-bg)] text-[var(--color-teal)]' : 'bg-[var(--color-canvas)] text-[var(--color-muted)] pointer-events-none'}`}>
                    💬 WhatsApp
                  </a>
                  <button onClick={e => { e.stopPropagation(); openEdit(s); }}
                    className="px-3 py-1.5 bg-[var(--color-gold-pale)] text-[var(--color-gold)] font-bold text-[12px] rounded-lg">
                    ✏ Edit
                  </button>
                  <button onClick={e => { e.stopPropagation(); del(s); }}
                    className="px-3 py-1.5 bg-[var(--color-red-bg)] text-[var(--color-red)] font-bold text-[12px] rounded-lg">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Details Panel */}
        {selected && (
          <div className="bg-white rounded-xl border-2 border-[var(--color-teal)] overflow-hidden sticky top-[80px]">
            <div className="bg-[var(--color-teal)] p-4 text-white">
              <button onClick={() => setSelected(null)} className="text-[12px] text-white/60 hover:text-white mb-2">← Close</button>
              <div className="font-serif text-[18px] font-bold mb-1">{selected.name}</div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded-full">{selected.category || 'General'}</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {[
                ['Contact', selected.contact_person],
                ['Email', selected.email],
                ['WhatsApp', selected.phone ? '+' + selected.phone.replace('+','') : ''],
                ['Payment', selected.terms]
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-center pb-2 border-b border-[var(--color-line-lt)]">
                  <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">{l}</span>
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">{v || '—'}</span>
                </div>
              ))}
              
              <div className="mt-1">
                <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Rating</div>
                <div className="text-[var(--color-gold)] text-[16px]">{'★'.repeat(selected.rating || 5)}{'☆'.repeat(5 - (selected.rating || 5))}</div>
              </div>
              
              <div className="mt-1">
                <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Products Supplied</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.products ? selected.products.split(',').map(p => (
                    <span key={p} className="text-[11px] font-semibold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2.5 py-1 rounded-full">{p.trim()}</span>
                  )) : <span className="text-[12px] text-[var(--color-muted)]">No products listed</span>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <a href={selected.phone ? `https://wa.me/${selected.phone.replace(/\D/g,'')}` : '#'} target="_blank" rel="noreferrer"
                  className={`flex-1 py-2.5 rounded-lg font-bold text-[13px] text-center transition-colors ${selected.phone ? 'bg-[var(--color-teal)] text-white hover:opacity-90' : 'bg-[var(--color-canvas)] text-[var(--color-muted)] pointer-events-none'}`}>
                  💬 WhatsApp
                </a>
                <button onClick={() => openEdit(selected)}
                  className="px-4 py-2.5 border-[1.5px] border-[var(--color-gold)]/20 text-[var(--color-gold)] bg-[var(--color-gold-pale)] font-bold text-[13px] rounded-lg">
                  ✏ Edit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[500px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-5">{editItem ? 'Edit Supplier' : 'Add New Supplier'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Supplier Name</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Contact Person</label>
                <input value={form.contact_person} onChange={e => setForm((p: any) => ({...p, contact_person: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm((p: any) => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">WhatsApp (e.g. 254...)</label>
                <input value={form.phone} onChange={e => setForm((p: any) => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" placeholder="Numbers only" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Payment Terms</label>
                <input value={form.terms} onChange={e => setForm((p: any) => ({...p, terms: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" placeholder="e.g. Cash, 30 Days" />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Products Supplied (comma-separated)</label>
                <input value={form.products} onChange={e => setForm((p: any) => ({...p, products: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none" placeholder="Beer, Soda, Water" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
                <select value={form.category} onChange={e => setForm((p: any) => ({...p, category: e.target.value}))} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Rating (1-5)</label>
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
