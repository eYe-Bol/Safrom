'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_person: '', phone: '', email: '', notes: '' });

  const fetchSuppliers = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error && data) {
      setSuppliers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('suppliers').insert([{
      user_id: user.id,
      ...formData
    }]);

    if (!error) {
      setShowAddForm(false);
      setFormData({ name: '', contact_person: '', phone: '', email: '', notes: '' });
      fetchSuppliers();
    } else {
      console.error(error);
      alert('Error adding supplier. Please make sure the Suppliers table is created in your database.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    const supabase = createClient();
    await supabase.from('suppliers').delete().eq('id', id);
    fetchSuppliers();
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Suppliers" sub="Manage your vendors and distributors" />
      
      <div className="p-5 max-w-[1200px] mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-[24px] font-bold text-[var(--color-ink)]">Your Suppliers</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[var(--color-teal)] text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:opacity-90 transition-opacity"
          >
            + Add Supplier
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line)] shadow-sm mb-6">
            <h3 className="font-bold text-[16px] mb-4">Add New Supplier</h3>
            <form onSubmit={handleAddSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Company Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[14px]" placeholder="e.g. Coca Cola Dist." />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Contact Person</label>
                <input type="text" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[14px]" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Phone / WhatsApp</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[14px]" placeholder="e.g. +254 700 000000" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[14px]" placeholder="supplier@example.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Notes (Terms, Delivery days, etc.)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-line)] rounded-lg text-[14px] min-h-[80px]" placeholder="Delivers on Tuesdays..." />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-[13px] font-bold text-[var(--color-slate)] hover:bg-[var(--color-canvas)] rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-ink)] text-white text-[13px] font-bold rounded-lg hover:opacity-90">Save Supplier</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-[var(--color-slate)] text-[14px]">Loading suppliers...</div>
        ) : suppliers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[40px] mb-3">🚚</div>
            <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-2">No suppliers added yet</h3>
            <p className="text-[14px] text-[var(--color-slate)] max-w-[300px] mx-auto">
              Keep track of your distributors, their contact info, and terms all in one place.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(sup => (
              <div key={sup.id} className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] shadow-sm relative group">
                <button onClick={() => handleDelete(sup.id)} className="absolute top-4 right-4 text-[var(--color-red)] opacity-0 group-hover:opacity-100 transition-opacity text-[12px] font-bold bg-[var(--color-red-bg)] px-2 py-1 rounded">
                  Delete
                </button>
                <h3 className="font-bold text-[16px] text-[var(--color-ink)] pr-12">{sup.name}</h3>
                {sup.contact_person && <div className="text-[13px] text-[var(--color-slate)] mt-1">👤 {sup.contact_person}</div>}
                <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[var(--color-line-lt)]">
                  {sup.phone && (
                    <a href={`tel:${sup.phone}`} className="text-[13px] text-[var(--color-teal)] font-medium flex items-center gap-2 hover:underline">
                      <span>📞</span> {sup.phone}
                    </a>
                  )}
                  {sup.email && (
                    <a href={`mailto:${sup.email}`} className="text-[13px] text-[var(--color-teal)] font-medium flex items-center gap-2 hover:underline truncate">
                      <span>✉️</span> {sup.email}
                    </a>
                  )}
                </div>
                {sup.notes && (
                  <div className="mt-3 text-[12px] text-[var(--color-slate)] bg-[var(--color-canvas)] p-2 rounded">
                    {sup.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
