'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  branch_name: string;
};

type BranchConfig = {
  name: string;
  icon: string;
  maxSlots: number;
  requiresPlan: '999' | '1499';
};

const BRANCHES: BranchConfig[] = [
  { name: 'Main Branch', icon: '🏪', maxSlots: 2, requiresPlan: '999' },
  { name: 'Branch 2',    icon: '🏬', maxSlots: 1, requiresPlan: '1499' },
  { name: 'Branch 3',    icon: '🏢', maxSlots: 1, requiresPlan: '1499' },
];

export default function StaffPage() {
  const { storeId, role, isTrial, subscriptionPlan } = useStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; branch: string }>({ open: false, branch: '' });
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canAccess999 = isTrial || subscriptionPlan === '999' || subscriptionPlan === '1499';
  const canAccess1499 = isTrial || subscriptionPlan === '1499';

  // Redirect staff away from this page
  useEffect(() => {
    if (role === 'staff') {
      window.location.href = '/portal/dashboard';
    }
  }, [role]);

  const fetchStaff = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, branch_name')
      .eq('owner_id', storeId);
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (storeId) fetchStaff();
  }, [storeId]);

  const openModal = (branch: string) => {
    setForm({ full_name: '', email: '', password: '' });
    setError('');
    setSuccess('');
    setModal({ open: true, branch });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: storeId,
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        branch_name: modal.branch,
      }),
    });

    const result = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(result.error || 'Failed to create staff account');
    } else {
      setSuccess(`✅ Account created for ${form.full_name}! They can now log in with: ${form.email}`);
      fetchStaff();
      setTimeout(() => {
        setModal({ open: false, branch: '' });
        setSuccess('');
      }, 3000);
    }
  };

  const handleRemove = async (staffId: string, name: string) => {
    if (!confirm(`Remove ${name}? They will lose all portal access.`)) return;

    const res = await fetch('/api/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, owner_id: storeId }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert(result.error || 'Failed to remove staff');
    } else {
      fetchStaff();
    }
  };

  if (role === 'staff') return null;

  if (!canAccess999) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center border border-[var(--color-line)]">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-serif text-xl font-bold text-[var(--color-ink)] mb-2">Subscription Required</h2>
          <p className="text-[var(--color-muted)] text-sm leading-relaxed mb-6">
            Your free trial has ended. Subscribe to a plan to manage staff and branches.
          </p>
          <div className="flex flex-col gap-3">
            <a href="/portal/billing" className="w-full py-3 bg-[var(--color-teal)] text-white rounded-xl font-bold text-[14px] hover:opacity-90 transition-opacity">
              View Plans →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-[22px] font-bold text-[var(--color-ink)]">Staff & Branches</h1>
        <p className="text-[13px] text-[var(--color-muted)] mt-1">
          Create and manage staff login credentials for each branch.
        </p>
        {/* Plan badge */}
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--color-teal-bg)] text-[var(--color-teal)] border border-[var(--color-teal)]/20">
          {isTrial && !subscriptionPlan ? '🕐 Trial Active — Full Access' :
           subscriptionPlan === '1499' ? '⭐ Pro Plan (KES 1,499) — All Branches Unlocked' :
           subscriptionPlan === '999'  ? '✅ Standard Plan (KES 999) — Main Branch Only' :
           'Trial Active'}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--color-muted)]">Loading…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {BRANCHES.map((branch) => {
            const branchStaff = staff.filter(s => s.branch_name === branch.name);
            const isLocked = branch.requiresPlan === '1499' && !canAccess1499;
            const isFull = branchStaff.length >= branch.maxSlots;
            const canAdd = !isLocked && !isFull;

            // Slot indicator dots
            const slots = Array.from({ length: branch.maxSlots });

            return (
              <div
                key={branch.name}
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                  isLocked ? 'border-dashed border-[var(--color-line)] opacity-70' : 'border-[var(--color-line)]'
                }`}
              >
                {/* Branch Header */}
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-teal-bg)] flex items-center justify-center text-xl">
                      {branch.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-ink)] text-[15px]">{branch.name}</h3>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        {branchStaff.length}/{branch.maxSlots} staff slot{branch.maxSlots > 1 ? 's' : ''} used
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Slot dots */}
                    {slots.map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full border-2 ${
                          i < branchStaff.length
                            ? 'bg-[var(--color-teal)] border-[var(--color-teal)]'
                            : 'bg-transparent border-[var(--color-line)]'
                        }`}
                      />
                    ))}
                    {isLocked ? (
                      <span className="ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                        🔒 Pro Plan Required
                      </span>
                    ) : canAdd ? (
                      <button
                        onClick={() => openModal(branch.name)}
                        className="ml-2 px-3 py-1.5 rounded-lg bg-[var(--color-teal)] text-white text-[11px] font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                      >
                        + Add Staff
                      </button>
                    ) : (
                      <span className="ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">
                        ✅ Full
                      </span>
                    )}
                  </div>
                </div>

                {/* Staff List */}
                {branchStaff.length === 0 ? (
                  <div className={`rounded-xl py-5 px-4 text-center text-[12px] text-[var(--color-muted)] ${
                    isLocked ? 'bg-[var(--color-canvas)]' : 'bg-[var(--color-teal-bg)]/30 border border-dashed border-[var(--color-teal)]/30'
                  }`}>
                    {isLocked
                      ? 'Upgrade to Pro Plan (KES 1,499) to unlock this branch'
                      : 'No staff added yet — click "+ Add Staff" to create credentials'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {branchStaff.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 bg-[var(--color-canvas)] rounded-xl px-4 py-3 border border-[var(--color-line)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-teal)] text-white font-bold text-[13px] flex items-center justify-center shrink-0">
                            {member.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[13px] text-[var(--color-ink)] truncate">{member.full_name}</p>
                            <p className="text-[11px] text-[var(--color-muted)] truncate">{member.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(member.id, member.full_name)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-red-bg)] text-[var(--color-red)] text-[11px] font-bold hover:bg-[var(--color-red)] hover:text-white transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Summary */}
      <div className="mt-6 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line)] p-4">
        <h4 className="font-bold text-[13px] text-[var(--color-ink)] mb-3">Plan Comparison</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
          <div className="bg-white rounded-lg p-3 border border-[var(--color-line)]">
            <p className="font-bold text-[var(--color-muted)] mb-1">Trial (7 days)</p>
            <p className="text-[var(--color-ink)]">✅ All 3 branches<br/>✅ Up to 4 staff<br/>✅ Full features</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[var(--color-teal)]/30">
            <p className="font-bold text-[var(--color-teal)] mb-1">Standard — KES 999/mo</p>
            <p className="text-[var(--color-ink)]">✅ Main Branch only<br/>✅ 1 Manager + 1 Employee<br/>⛔ No extra branches</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-200 bg-amber-50/40">
            <p className="font-bold text-amber-700 mb-1">Pro — KES 1,499/mo</p>
            <p className="text-[var(--color-ink)]">✅ All 3 branches<br/>✅ Up to 4 staff<br/>✅ Priority support</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif font-bold text-[var(--color-ink)] text-[17px]">
                  Add Staff — {modal.branch}
                </h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  A login account will be created for this staff member.
                </p>
              </div>
              <button onClick={() => setModal({ open: false, branch: '' })} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-xl">✕</button>
            </div>

            {success ? (
              <div className="py-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-[13px] text-[var(--color-ink)] font-semibold leading-relaxed">{success}</p>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-slate)] block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    required
                    className="w-full py-[9px] px-3 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] transition-colors"
                    placeholder="e.g. Jane Doe"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-slate)] block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full py-[9px] px-3 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] transition-colors"
                    placeholder="staff@example.com"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-slate)] block mb-1">Temporary Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full py-[9px] px-3 border border-[var(--color-line)] rounded-lg text-[13px] outline-none focus:border-[var(--color-teal)] transition-colors"
                    placeholder="Min 8 characters"
                  />
                  <p className="text-[10px] text-[var(--color-muted)] mt-1">Share this with the staff member. They can update it after logging in.</p>
                </div>

                {error && (
                  <div className="py-2 px-3 bg-[var(--color-red-bg)] text-[var(--color-red)] text-[12px] rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setModal({ open: false, branch: '' })}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[13px] hover:bg-[var(--color-canvas)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--color-teal)] text-white font-bold text-[13px] hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {saving ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
