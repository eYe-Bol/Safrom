'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { fmt, downloadCSV } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Rent', 'Wages', 'Utilities', 'Transport', 'Supplies', 'Marketing', 'Other'];

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
};

type ExpenseForm = {
  date: string;
  category: string;
  amount: string;
  description: string;
};

type DeleteModal = { open: boolean; expenseId: string; label: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { storeId, branchName } = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpenseForm>({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: '',
  });
  const [catF, setCatF] = useState('All');
  const [toast, setToast] = useState('');
  const [deleteModal, setDeleteModal] = useState<DeleteModal>({ open: false, expenseId: '', label: '' });

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchExpenses = async () => {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', storeId)
      .eq('branch_name', branchName || 'Main Branch')
      .order('date', { ascending: false });
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [storeId, branchName]);

  const cats = ['All', ...CATEGORIES];
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const filtered = expenses.filter(e => catF === 'All' || e.category === catF);

  const catColor: Record<string, { text: string; bg: string }> = {
    Rent:      { text: 'var(--color-teal)',    bg: 'var(--color-teal-bg)' },
    Wages:     { text: 'var(--color-purple)',  bg: 'var(--color-purple-bg)' },
    Utilities: { text: 'var(--color-amber)',   bg: 'var(--color-amber-bg)' },
    Transport: { text: 'var(--color-emerald)', bg: 'var(--color-emerald-bg)' },
    Supplies:  { text: 'var(--color-slate)',   bg: 'var(--color-canvas)' },
    Marketing: { text: 'var(--color-gold)',    bg: 'var(--color-gold-pale)' },
    Other:     { text: 'var(--color-muted)',   bg: 'var(--color-canvas)' },
  };

  const handleAdd = async () => {
    if (!form.category || !form.amount || !storeId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('expenses').insert({
      user_id: storeId,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      branch_name: branchName || 'Main Branch',
    });
    if (!error) {
      fire(`✓ ${form.category} · ${fmt(parseFloat(form.amount))} logged`);
      setForm({ date: new Date().toISOString().split('T')[0], category: '', amount: '', description: '' });
      fetchExpenses();
    } else {
      fire(`⚠ Error: ${error.message}`);
    }
    setSaving(false);
  };

  const confirmDelete = (expense: Expense) => {
    setDeleteModal({
      open: true,
      expenseId: expense.id,
      label: `${expense.category} — ${fmt(Number(expense.amount))} on ${expense.date}`,
    });
  };

  const handleDelete = async () => {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', deleteModal.expenseId);
    fire('Expense deleted');
    setDeleteModal({ open: false, expenseId: '', label: '' });
    fetchExpenses();
  };

  const handleExportCSV = () => {
    const rows = filtered.map(e => ({
      Date: e.date,
      Category: e.category,
      Amount: e.amount,
      Notes: e.description,
    }));
    downloadCSV(rows, `expenses_${branchName || 'main'}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Expenses" sub="Track every business cost for accurate profit reporting" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setDeleteModal({ open: false, expenseId: '', label: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[380px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="text-[28px] mb-3 text-center">🗑️</div>
            <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] text-center mb-1">Delete Expense?</h3>
            <p className="text-[13px] text-[var(--color-muted)] text-center mb-5 leading-relaxed">{deleteModal.label}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, expenseId: '', label: '' })} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)] cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-[var(--color-red)] text-white rounded-xl font-bold text-[14px] hover:opacity-90 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-6 items-start">

        {/* Left Column: Expenses Table */}
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-[var(--color-line-lt)] flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)]">All Expenses</span>
              <span className="text-[13px] text-[var(--color-muted)]">
                Total: <strong className="text-[var(--color-red)]">{fmt(total)}</strong>
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <select value={catF} onChange={e => setCatF(e.target.value)}
                className="w-[130px] px-3 py-1.5 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white">
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
              <button
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 border-[1.5px] border-[var(--color-line)] rounded-lg bg-[var(--color-canvas)] text-[var(--color-slate)] font-semibold text-[13px] cursor-pointer hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬇ CSV
              </button>
            </div>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading expenses…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[var(--color-muted)]">No expenses recorded.</div>
            ) : filtered.map(r => {
              const color = catColor[r.category] || catColor['Other'];
              return (
                <div key={r.id} className="p-3 flex justify-between items-center bg-white hover:bg-[var(--color-canvas)] transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: color.text, backgroundColor: color.bg }}>
                        {r.category}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)]">{r.date}</span>
                    </div>
                    <div className="font-serif text-[15px] font-bold text-[var(--color-ink)]">{fmt(Number(r.amount))}</div>
                    {r.description && <div className="text-[12px] text-[var(--color-slate)]">{r.description}</div>}
                  </div>
                  <button
                    onClick={() => confirmDelete(r)}
                    className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] px-2.5 py-1.5 rounded-[6px] hover:opacity-80 cursor-pointer shrink-0"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>

          {/* ─── DESKTOP DATA TABLE (md+) ─── */}
          <div className="hidden md:block overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse" style={{ minWidth: 400 }}>
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]">
                  {['Date', 'Category', 'Amount', 'Notes', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading expenses…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">No expenses recorded.</td></tr>
                ) : filtered.map(r => {
                  const color = catColor[r.category] || catColor['Other'];
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-muted)]">{r.date}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ color: color.text, backgroundColor: color.bg }}>
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-serif text-[14px] font-bold text-[var(--color-ink)]">{fmt(Number(r.amount))}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-muted)]">{r.description}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => confirmDelete(r)}
                          className="text-[11px] font-bold text-[var(--color-red)] bg-[var(--color-red-bg)] px-2.5 py-1.5 rounded-[6px] hover:opacity-80 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Add Expense Form */}
        <div className="bg-white rounded-xl border border-[var(--color-line-lt)] p-5 shadow-sm sticky top-[80px]">
          <div className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">
            Log New Expense
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Date</label>
              <input
                type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none bg-white text-[var(--color-ink)] focus:border-[var(--color-teal)]">
                <option value="" disabled>Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Amount (KES)</label>
              <input
                type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0"
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Notes</label>
              <input
                type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes..."
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-lg text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!form.category || !form.amount || saving}
              className={`mt-2 py-3 rounded-xl border-none font-bold text-[14px] transition-all cursor-pointer ${form.category && form.amount && !saving ? 'bg-[var(--color-teal)] text-white shadow-[0_4px_14px_rgba(10,92,107,0.25)] hover:opacity-90' : 'bg-[var(--color-line-lt)] text-[var(--color-muted)] cursor-not-allowed'}`}
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
