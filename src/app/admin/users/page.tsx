'use client';

import { useState, useEffect, useMemo } from 'react';
import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';

type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  store_name: string | null;
  store_phone: string | null;
  role: string | null;
  scale: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  is_active: boolean | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'exempt' | 'multi'>('all');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState('');
  const [customDate, setCustomDate] = useState('');

  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      } else if (data.error) {
        fire(`Error: ${data.error}`);
      }
    } catch (err: any) {
      fire('Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getUserStatus = (u: ManagedUser): { status: 'active' | 'trial' | 'expired' | 'exempt' | 'suspended'; label: string; daysLeft?: number } => {
    if (u.is_active === false) return { status: 'suspended', label: 'Suspended' };
    
    if (
      u.role === 'admin' ||
      u.subscription_plan === 'exempt' ||
      u.subscription_plan === 'lifetime' ||
      u.subscription_plan === 'admin' ||
      u.subscription_status === 'exempt'
    ) {
      return { status: 'exempt', label: 'Exempt / VIP' };
    }

    const now = new Date();
    
    // Check paid subscription first
    if (u.subscription_end_date) {
      const end = new Date(u.subscription_end_date);
      if (end >= now) {
        const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { status: 'active', label: `Active (${days}d left)`, daysLeft: days };
      }
    }

    // Check 7-day trial
    const trialEnd = new Date(u.created_at);
    trialEnd.setDate(trialEnd.getDate() + 7);
    if (trialEnd >= now) {
      const days = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'trial', label: `Trial (${days}d left)`, daysLeft: days };
    }

    return { status: 'expired', label: 'Expired' };
  };

  const stats = useMemo(() => {
    const total = users.length;
    let active = 0;
    let trial = 0;
    let expired = 0;
    let exempt = 0;

    users.forEach(u => {
      const st = getUserStatus(u);
      if (st.status === 'active') active++;
      else if (st.status === 'trial') trial++;
      else if (st.status === 'expired') expired++;
      else if (st.status === 'exempt') exempt++;
    });

    return { total, active, trial, expired, exempt };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch =
        (u.store_name && u.store_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.store_phone && u.store_phone.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const st = getUserStatus(u);
      if (statusFilter === 'active') return st.status === 'active';
      if (statusFilter === 'trial') return st.status === 'trial';
      if (statusFilter === 'expired') return st.status === 'expired';
      if (statusFilter === 'exempt') return st.status === 'exempt';
      if (statusFilter === 'multi') return u.scale === 'multi';

      return true;
    });
  }, [users, search, statusFilter]);

  const handleAction = async (payload: { action: string; days?: number; plan?: string; scale?: string; customEndDate?: string; isActive?: boolean }) => {
    if (!selectedUser) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          ...payload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        fire('✓ Account updated successfully!');
        await fetchUsers();
        // Update selected user modal view
        setSelectedUser(prev => prev ? { ...prev, ...data.updates } : prev);
      } else {
        fire(`Error: ${data.error || 'Failed to update user'}`);
      }
    } catch (err: any) {
      fire('Request failed');
    }
    setProcessing(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-12 w-full">
      <Topbar title="Super Admin" sub="Platform User & Subscription Management" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full flex flex-col gap-6">

        {/* ─── METRICS CARDS ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <StatCard label="Total Stores" value={stats.total.toString()} sub="Registered accounts" accent="var(--color-teal)" />
          <StatCard label="Active Subscriptions" value={stats.active.toString()} sub="Paid & running" accent="var(--color-emerald)" />
          <StatCard label="In Free Trial" value={stats.trial.toString()} sub="7-day trial users" accent="var(--color-amber)" />
          <StatCard label="Expired Accounts" value={stats.expired.toString()} sub="Need renewal" accent="var(--color-red)" />
          <StatCard label="Exempt / VIP" value={stats.exempt.toString()} sub="Permanent immunity" accent="var(--color-gold)" />
        </div>

        {/* ─── FILTERS & SEARCH BAR ─── */}
        <div className="bg-white rounded-2xl p-4 border border-[var(--color-line-lt)] shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-80">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search store, owner, email, phone..."
              className="w-full px-3.5 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none focus:border-[var(--color-teal)] font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            {[
              { id: 'all', label: 'All Accounts' },
              { id: 'active', label: 'Active' },
              { id: 'trial', label: 'Trial' },
              { id: 'expired', label: 'Expired' },
              { id: 'exempt', label: 'Exempt / VIP' },
              { id: 'multi', label: 'Multi Branch' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-all ${
                  statusFilter === f.id
                    ? 'bg-[var(--color-teal)] text-white shadow-sm'
                    : 'bg-[var(--color-canvas)] text-[var(--color-slate)] hover:bg-[var(--color-line-lt)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── USERS TABLE ─── */}
        <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)] text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-[0.05em]">
                  <th className="p-3.5">Store & Owner</th>
                  <th className="p-3.5">Role / Scale</th>
                  <th className="p-3.5">Subscription Status</th>
                  <th className="p-3.5">Expiry / End Date</th>
                  <th className="p-3.5">Registered</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-lt)]">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[var(--color-muted)]">Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[var(--color-muted)]">No users found matching your search.</td></tr>
                ) : (
                  filteredUsers.map(u => {
                    const st = getUserStatus(u);
                    return (
                      <tr key={u.id} className="hover:bg-[var(--color-canvas)] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-[var(--color-ink)]">{u.store_name || 'Unnamed Store'}</div>
                          <div className="text-[11px] text-[var(--color-muted)]">{u.email}</div>
                          {u.store_phone && <div className="text-[10px] text-[var(--color-slate)]">📞 {u.store_phone}</div>}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-semibold text-[12px] text-[var(--color-ink)] capitalize">
                              {u.role || 'Owner'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.scale === 'multi'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {u.scale === 'multi' ? '🏢 Multi Branch' : '🏪 Single Store'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            st.status === 'exempt' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            st.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            st.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                            st.status === 'suspended' ? 'bg-gray-100 text-gray-700' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-[12px] text-[var(--color-slate)] font-mono">
                          {st.status === 'exempt' ? (
                            <span className="text-amber-700 font-bold">Lifetime Access</span>
                          ) : u.subscription_end_date ? (
                            new Date(u.subscription_end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3.5 text-[12px] text-[var(--color-muted)]">
                          {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setCustomDate(u.subscription_end_date ? u.subscription_end_date.split('T')[0] : '');
                            }}
                            className="px-3 py-1.5 bg-[var(--color-teal)] text-white text-[12px] font-bold rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                          >
                            Manage ⚙️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ─── MANAGE USER MODAL ─── */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--color-line)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[var(--color-line-lt)] pb-3">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                  Manage: {selectedUser.store_name || selectedUser.email}
                </h3>
                <p className="text-[12px] text-[var(--color-muted)]">{selectedUser.email} · ID: {selectedUser.id}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-[18px] text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Exemption & Extension Buttons */}
            <div className="flex flex-col gap-3">
              <label className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                1. Grant Access / Extend Time
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  disabled={processing}
                  onClick={() => handleAction({ action: 'extend', days: 30 })}
                  className="p-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] rounded-xl font-bold text-[12px] text-[var(--color-ink)] transition-colors cursor-pointer"
                >
                  +30 Days
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction({ action: 'extend', days: 90 })}
                  className="p-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] rounded-xl font-bold text-[12px] text-[var(--color-ink)] transition-colors cursor-pointer"
                >
                  +90 Days
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction({ action: 'extend', days: 365 })}
                  className="p-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] rounded-xl font-bold text-[12px] text-[var(--color-ink)] transition-colors cursor-pointer"
                >
                  +1 Year
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction({ action: 'exempt' })}
                  className="p-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl font-bold text-[12px] text-amber-900 transition-colors cursor-pointer"
                >
                  👑 Lifetime VIP
                </button>
              </div>

              {/* Custom Date Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="flex-1 px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium"
                />
                <button
                  disabled={processing || !customDate}
                  onClick={() => handleAction({ action: 'set_custom_date', customEndDate: customDate })}
                  className="px-4 py-2 bg-[var(--color-teal)] text-white text-[12px] font-bold rounded-xl cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  Set Date
                </button>
              </div>
            </div>

            {/* Scale Management */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-line-lt)]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                2. Branch Scale
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={processing || selectedUser.scale === 'single'}
                  onClick={() => handleAction({ action: 'set_scale', scale: 'single' })}
                  className={`p-2.5 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                    selectedUser.scale === 'single'
                      ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]'
                      : 'bg-white text-[var(--color-slate)] border-[var(--color-line)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  🏪 Single Store
                </button>
                <button
                  disabled={processing || selectedUser.scale === 'multi'}
                  onClick={() => handleAction({ action: 'set_scale', scale: 'multi' })}
                  className={`p-2.5 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                    selectedUser.scale === 'multi'
                      ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]'
                      : 'bg-white text-[var(--color-slate)] border-[var(--color-line)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  🏢 Multi Branch
                </button>
              </div>
            </div>

            {/* Plan Tier */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-line-lt)]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                3. Plan Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['starter', 'growth', 'exempt'].map(p => (
                  <button
                    key={p}
                    disabled={processing}
                    onClick={() => handleAction({ action: 'set_plan', plan: p })}
                    className={`p-2 rounded-xl text-[12px] font-bold border capitalize transition-all cursor-pointer ${
                      selectedUser.subscription_plan === p
                        ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                        : 'bg-white text-[var(--color-slate)] border-[var(--color-line)] hover:bg-[var(--color-canvas)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Suspend / Close Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-line-lt)] mt-1">
              <button
                disabled={processing}
                onClick={() => handleAction({ action: 'toggle_active', isActive: !selectedUser.is_active })}
                className={`px-4 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-colors ${
                  selectedUser.is_active === false
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                }`}
              >
                {selectedUser.is_active === false ? '✅ Reactivate Account' : '⛔ Suspend Account'}
              </button>

              <button
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] font-semibold text-[var(--color-slate)] cursor-pointer hover:bg-[var(--color-line-lt)]"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
