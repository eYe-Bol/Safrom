'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Modal } from '@/components/Modal';

const CATEGORIES = ['Wages', 'Rent', 'Utilities', 'Transport', 'Stock Purchase', 'Maintenance', 'Marketing', 'Other'];

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'Wages', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (data) setExpenses(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const totalThisMonth = expenses
    .filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Expense logged!' });
      setShowAdd(false);
      setForm({ category: 'Wages', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  const catColor: Record<string, string> = {
    Wages: 'text-[var(--color-teal)] bg-[var(--color-teal-bg)]',
    Rent: 'text-[var(--color-amber)] bg-[var(--color-amber-bg)]',
    Utilities: 'text-[var(--color-slate)] bg-[var(--color-canvas)]',
    Transport: 'text-[var(--color-purple)] bg-[var(--color-purple-bg)]',
    'Stock Purchase': 'text-[var(--color-emerald)] bg-[var(--color-emerald-bg)]',
    Maintenance: 'text-[var(--color-gold)] bg-[var(--color-gold-pale)]',
    Marketing: 'text-[var(--color-teal)] bg-[var(--color-teal-bg)]',
    Other: 'text-[var(--color-muted)] bg-[var(--color-canvas)]',
  };

  return (
    <div>
      <Topbar title="Expenses" sub="Track your operational costs" />
      <div className="p-4 max-w-[900px] mx-auto">
        {/* Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-[14px] p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">This Month</div>
            <div className="font-serif text-[22px] font-bold text-[var(--color-red)]">KES {totalThisMonth.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-[14px] p-4 border border-[var(--color-line-lt)] shadow-sm">
            <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-widest mb-1">Total Entries</div>
            <div className="font-serif text-[22px] font-bold text-[var(--color-ink)]">{expenses.length}</div>
          </div>
          <div className="col-span-2 md:col-span-1 flex items-center justify-end md:justify-center">
            <button onClick={() => setShowAdd(true)} className="px-5 py-3 bg-[var(--color-teal)] text-white rounded-[10px] font-bold text-[13px] hover:opacity-90 w-full md:w-auto">
              + Log Expense
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 text-[13px] font-semibold py-[8px] px-[12px] rounded-[8px] ${message.type === 'error' ? 'bg-[var(--color-red-bg)] text-[var(--color-red)]' : 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                  {['Date', 'Category', 'Description', 'Amount', ''].map(h => (
                    <th key={h} className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No expenses logged yet.</td></tr>
                ) : expenses.map(exp => (
                  <tr key={exp.id} className="border-b border-[var(--color-line-lt)] hover:bg-[var(--color-canvas)] transition-colors">
                    <td className="p-3 text-[12px] text-[var(--color-slate)]">{exp.date}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${catColor[exp.category] || catColor['Other']}`}>{exp.category}</span>
                    </td>
                    <td className="p-3 text-[13px] text-[var(--color-ink)]">{exp.description}</td>
                    <td className="p-3 text-[13px] font-bold text-[var(--color-red)]">KES {Number(exp.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <button onClick={() => handleDelete(exp.id)} className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] px-2 py-1 rounded hover:opacity-80">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-4">Log Expense</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] bg-white outline-none">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Casual labour wages" className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Amount (KES)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-[9px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setShowAdd(false)} className="flex-1 py-[11px] bg-[var(--color-canvas)] text-[var(--color-slate)] border-[1.5px] border-[var(--color-line)] rounded-[10px] font-bold text-[14px]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-[11px] bg-[var(--color-teal)] text-white border-none rounded-[10px] font-bold text-[14px] disabled:opacity-70">{saving ? 'Saving…' : 'Log Expense'}</button>
        </div>
      </Modal>
    </div>
  );
}
