'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { Topbar } from '@/components/Topbar';
import ProperCaseInput from '@/components/ProperCaseInput';
import { BUSINESS_TYPES, getBusinessTypeLabel } from '@/utils/businessTypes';

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  branch_name: string;
  staff_role: string;
  is_active: boolean;
};

type BranchProfile = {
  branch_name: string;
  branch_display_name: string;
  branch_phone: string;
  branch_email: string;
  branch_address: string;
  business_type?: string;
};

type BranchConfig = {
  key: string;
  icon: string;
  maxSlots: number;
  requiresPlan: '999' | '1999' | '1499';
};

const BRANCH_CONFIGS: BranchConfig[] = [
  { key: 'Main Branch', icon: '🏪', maxSlots: 2, requiresPlan: '999' },
  { key: 'Branch 2',    icon: '🏬', maxSlots: 1, requiresPlan: '1999' },
  { key: 'Branch 3',    icon: '🏢', maxSlots: 1, requiresPlan: '1999' },
];

const STAFF_ROLES = [
  'Sales Staff',
  'Cashier',
  'Store Manager',
  'Inventory Clerk',
  'Supervisor',
  'Accountant',
  'Delivery Staff',
  'Security',
  'Other',
];

const BLANK_PROFILE: BranchProfile = {
  branch_name: '',
  branch_display_name: '',
  branch_phone: '',
  branch_email: '',
  branch_address: '',
  business_type: 'retail_store',
};

export default function StaffPage() {
  const { storeId, isTrial, subscriptionPlan, storeName, businessType, setStoreName, setBusinessType, refreshBranchProfiles, scale, branchLimit } = useStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branchProfiles, setBranchProfiles] = useState<Record<string, BranchProfile>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; branch: string }>({ open: false, branch: '' });
  const [editModal, setEditModal] = useState<{ open: boolean; staffId: string }>({ open: false, staffId: '' });
  const [branchModal, setBranchModal] = useState<{ open: boolean; branch: string }>({ open: false, branch: '' });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; staffId: string; branchLabel: string; name: string }>({ open: false, staffId: '', branchLabel: '', name: '' });
  const [form, setForm] = useState({ full_name: '', email: '', password: '', staff_role: 'Sales Staff' });
  const [branchForm, setBranchForm] = useState<BranchProfile>(BLANK_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const canAccess999 = isTrial || subscriptionPlan === '999' || subscriptionPlan === '1999' || subscriptionPlan === '1499' || subscriptionPlan === 'pro' || subscriptionPlan === 'growth' || subscriptionPlan?.includes('branch') || subscriptionPlan?.includes('store');
  const canAccess1999 = isTrial || subscriptionPlan === '1999' || subscriptionPlan === '1499' || subscriptionPlan === 'pro' || subscriptionPlan === 'growth' || subscriptionPlan?.includes('branch') || subscriptionPlan?.includes('store');
  const isMultiStorePlan = isTrial || subscriptionPlan === 'store' || subscriptionPlan === 'MULTI_STORE' || subscriptionPlan?.toLowerCase().includes('store');

  const effectiveBranchLimit = scale === 'multi' ? Math.max(2, branchLimit || 3) : 1;
  const ICONS = ['🏬', '🏢', '🛒', '🏭', '🏥', '🍻', '🛍️', '📦', '📍', '🏪'];

  const dynamicBranchConfigs: BranchConfig[] = Array.from({ length: effectiveBranchLimit }, (_, i) => {
    if (i === 0) return { key: 'Main Branch', icon: '🏪', maxSlots: 2, requiresPlan: '999' as const };
    return {
      key: `Branch ${i + 1}`,
      icon: ICONS[(i - 1) % ICONS.length],
      maxSlots: 2,
      requiresPlan: '1999' as const,
    };
  });

  const fetchStaff = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, staff_role, branch_name, is_active, created_at')
      .eq('owner_id', storeId)
      .order('created_at', { ascending: false });

    if (data) setStaff(data as unknown as StaffMember[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchStaff();
    const loadProfiles = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('branch_profiles')
        .select('*')
        .eq('owner_id', storeId);
      if (data) {
        const map: Record<string, BranchProfile> = {};
        (data as any[]).forEach((p: any) => { map[p.branch_name] = p; });
        setBranchProfiles(map);
      }
    };
    if (storeId) loadProfiles();
  }, [storeId, fetchStaff]);

  const openModal = (branch: string) => {
    setForm({ full_name: '', email: '', password: '', staff_role: 'Sales Staff' });
    setModal({ open: true, branch });
  };

  const openEditModal = (member: StaffMember) => {
    setForm({
      full_name: member.full_name,
      email: member.email,
      password: '',
      staff_role: member.staff_role || 'Sales Staff',
    });
    setEditModal({ open: true, staffId: member.id });
  };

  const openBranchModal = (branch: string) => {
    const existing = branchProfiles[branch];
    const defaultType = branch === 'Main Branch'
      ? (businessType || 'retail_store')
      : (isMultiStorePlan ? (existing?.business_type || 'retail_store') : (businessType || 'retail_store'));

    setBranchForm({
      branch_name: branch,
      branch_display_name: existing?.branch_display_name || (branch === 'Main Branch' ? (storeName || branch) : branch),
      branch_phone: existing?.branch_phone || '',
      branch_email: existing?.branch_email || '',
      branch_address: existing?.branch_address || '',
      business_type: defaultType,
    });
    setBranchModal({ open: true, branch });
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
        staff_role: form.staff_role,
      }),
    });

    const result = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(result.error || 'Failed to create staff account');
    } else {
      setSuccess(`✅ Account created for ${form.full_name}!`);
      fetchStaff();
      setTimeout(() => {
        setModal({ open: false, branch: '' });
        setSuccess('');
      }, 3000);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: editModal.staffId,
        owner_id: storeId,
        full_name: form.full_name,
        staff_role: form.staff_role,
        password: form.password || undefined,
      }),
    });

    const result = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(result.error || 'Failed to update staff account');
    } else {
      setSuccess(`✅ Account updated for ${form.full_name}!`);
      fetchStaff();
      setTimeout(() => {
        setEditModal({ open: false, staffId: '' });
        setSuccess('');
      }, 2000);
    }
  };

  const handleSaveBranchProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setSavingBranch(true);
    const supabase = createClient();

    const finalBizType = (!isMultiStorePlan && branchModal.branch !== 'Main Branch')
      ? (businessType || 'retail_store')
      : (branchForm.business_type || 'retail_store');

    const payload = {
      owner_id: storeId,
      branch_name: branchModal.branch,
      branch_display_name: branchForm.branch_display_name || branchModal.branch,
      branch_phone: branchForm.branch_phone,
      branch_email: branchForm.branch_email,
      branch_address: branchForm.branch_address,
      business_type: finalBizType,
    };

    // 1. Save to branch_profiles
    const { error } = await supabase
      .from('branch_profiles')
      .upsert(payload, { onConflict: 'owner_id,branch_name' });

    if (error) {
      fire(`Error: ${error.message}`);
      setSavingBranch(false);
      return;
    }

    // 2. If Main Branch, also synchronize users table
    if (branchModal.branch === 'Main Branch') {
      await supabase.from('users').update({
        store_name: payload.branch_display_name,
        store_phone: payload.branch_phone,
        store_email: payload.branch_email,
        business_type: payload.business_type,
      }).eq('id', storeId);
      setStoreName(payload.branch_display_name);
      setBusinessType(payload.business_type);
    }

    // Update local state
    setBranchProfiles(prev => ({ ...prev, [branchModal.branch]: { ...branchForm, branch_name: branchModal.branch, business_type: finalBizType } }));
    await refreshBranchProfiles();
    setSavingBranch(false);
    fire(`✅ ${branchModal.branch} profile saved and synchronized!`);
    setBranchModal({ open: false, branch: '' });
  };

  const openDeleteModal = (member: StaffMember) => {
    setDeleteModal({ open: true, staffId: member.id, branchLabel: member.branch_name, name: member.full_name });
  };

  const handleRemove = async () => {
    const { staffId } = deleteModal;
    setDeleteModal({ open: false, staffId: '', branchLabel: '', name: '' });

    const res = await fetch('/api/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, owner_id: storeId }),
    });

    if (res.ok) {
      setStaff(staff.filter(s => s.id !== staffId));
      fire('Staff member removed.');
    } else {
      fire('Failed to remove staff member.');
    }
  };

  const handleToggleActive = async (staff_id: string, current_active: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({ is_active: !current_active })
      .eq('id', staff_id);

    if (!error) {
      setStaff(staff.map(s => s.id === staff_id ? { ...s, is_active: !current_active } : s));
      fire(!current_active ? '✅ Staff member activated' : '⛔ Staff member deactivated');
    } else {
      fire('Failed to update status');
    }
  };

  if (loading) return <div className="text-[13px] text-[var(--color-muted)] p-5">Loading branches...</div>;

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Staff & Branch Manager" sub="Record all staff, their branches, profiles, and login details" />
      
      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setDeleteModal({ open: false, staffId: '', branchLabel: '', name: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[380px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="text-[28px] mb-3 text-center">🗑️</div>
            <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] text-center mb-1">Remove Staff Member?</h3>
            <p className="text-[13px] text-[var(--color-muted)] text-center mb-5 leading-relaxed">
              Permanently remove <strong>{deleteModal.name}</strong> from <strong>{deleteModal.branchLabel}</strong>?<br />
              Their login access will be revoked immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, staffId: '', branchLabel: '', name: '' })} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)] cursor-pointer">Cancel</button>
              <button onClick={handleRemove} className="flex-1 py-2.5 bg-[var(--color-red)] text-white rounded-xl font-bold text-[14px] hover:opacity-90 cursor-pointer">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dynamicBranchConfigs.filter(b => scale === 'multi' || b.key === 'Main Branch').map(branch => {
          const branchStaff = staff.filter(s => s.branch_name === branch.key);
          const hasAccess = scale === 'single' ? true : (branch.requiresPlan === '999' ? canAccess999 : canAccess1999);
          const profile = branchProfiles[branch.key];
          const displayName = profile?.branch_display_name || (branch.key === 'Main Branch' ? storeName : branch.key) || branch.key;
          const branchBizType = profile?.business_type || (branch.key === 'Main Branch' ? (businessType || 'retail_store') : 'retail_store');

          return (
            <div key={branch.key} className={`bg-white rounded-xl p-5 border ${hasAccess ? 'border-[var(--color-teal)]/30' : 'border-[var(--color-line-lt)] opacity-60'} flex flex-col relative`}>
              {!hasAccess && scale === 'multi' && (
                <div className="absolute top-3 right-3 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[10px] font-bold px-2 py-0.5 rounded-full text-[var(--color-muted)] uppercase tracking-wider">
                  Requires {branch.requiresPlan} Plan
                </div>
              )}

              {/* Branch Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-canvas)] flex items-center justify-center text-[20px] shadow-inner">
                    {branch.icon}
                  </div>
                  <div>
                    <h2 className="font-serif text-[15px] font-bold text-[var(--color-ink)]">{displayName}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {displayName !== branch.key && (
                        <span className="text-[10px] text-[var(--color-muted)] font-medium">{branch.key} ·</span>
                      )}
                      <span className="text-[10px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-1.5 py-0.2 rounded">
                        {getBusinessTypeLabel(branchBizType)}
                      </span>
                      {branch.key !== 'Main Branch' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${isMultiStorePlan ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {isMultiStorePlan ? '🏬 Store Venture' : '🏢 Chain Branch'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {hasAccess && (
                  <button
                    onClick={() => openBranchModal(branch.key)}
                    className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                    title="Edit branch profile"
                  >
                    ✏️ Profile
                  </button>
                )}
              </div>

              {/* Branch profile info preview */}
              {profile?.branch_phone && (
                <div className="text-[11px] text-[var(--color-muted)] mb-2 mt-0.5">📞 {profile.branch_phone}{profile.branch_address ? ` · 📍 ${profile.branch_address}` : ''}</div>
              )}

              <div className="text-[12px] text-[var(--color-muted)] font-semibold mb-3">
                {branchStaff.length} / {branch.maxSlots} Slots Used
              </div>

              {/* Slot indicators */}
              <div className="flex gap-2 mb-4">
                {Array.from({ length: branch.maxSlots }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < branchStaff.length ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-line-lt)]'}`} />
                ))}
              </div>

              {/* Staff List for this branch */}
              <div className="flex-1 space-y-2 mb-4">
                {branchStaff.length === 0 ? (
                  <div className="text-[12px] text-[var(--color-muted)] py-4 text-center bg-[var(--color-canvas)] rounded-lg border border-dashed border-[var(--color-line)]">
                    No staff assigned to this outlet
                  </div>
                ) : (
                  branchStaff.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line-lt)]">
                      <div className="min-w-0 pr-2">
                        <div className="text-[13px] font-bold text-[var(--color-ink)] truncate flex items-center gap-1.5">
                          {member.full_name}
                          {!member.is_active && (
                            <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">Suspended</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)] truncate">{member.email} · <span className="font-semibold text-[var(--color-slate)]">{member.staff_role || 'Sales Staff'}</span></div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-teal)] hover:bg-white rounded transition-colors"
                          title="Edit role or reset password"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => openDeleteModal(member)}
                          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-red)] hover:bg-white rounded transition-colors"
                          title="Remove Staff"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Staff Button for this branch */}
              {hasAccess ? (
                <button
                  disabled={branchStaff.length >= branch.maxSlots}
                  onClick={() => openModal(branch.key)}
                  className="w-full py-2.5 bg-white border border-[var(--color-teal)] text-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] font-bold text-[13px] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <span>+</span> Add {branch.key === 'Main Branch' ? 'Main' : ''} Staff
                </button>
              ) : (
                <Link
                  href="/portal/settings"
                  className="w-full py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[12px] rounded-xl text-center hover:bg-[var(--color-line-lt)] transition-colors block"
                >
                  Upgrade to Unlock
                </Link>
              )}
            </div>
          );
        })}

        {/* Dynamic "+ Add Another Outlet" expansion card */}
        {scale === 'multi' && effectiveBranchLimit < 10 && (
          <div className="bg-[var(--color-canvas)]/40 rounded-xl p-5 border-2 border-dashed border-[var(--color-line)] flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-canvas)] border border-[var(--color-line)] flex items-center justify-center text-[22px]">
              ➕
            </div>
            <div>
              <div className="font-serif text-[15px] font-bold text-[var(--color-ink)]">Add Another Outlet</div>
              <p className="text-[12px] text-[var(--color-muted)] max-w-[240px] mt-1">
                Expand your business with another synchronized branch or store
              </p>
            </div>
            <Link
              href="/portal/settings"
              className="px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              Add Outlet ({effectiveBranchLimit + 1} of 10)
            </Link>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setModal({ open: false, branch: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">Add Staff ({modal.branch})</h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Create a login for your employee</p>
              </div>
              <button onClick={() => setModal({ open: false, branch: '' })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-[12px] font-semibold">{error}</div>}
            {success && <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-[12px] font-semibold">{success}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Full Name</label>
                <ProperCaseInput value={form.full_name} onChange={v => setForm({...form, full_name: v})} required className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="staff@example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Temporary Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Staff Role</label>
                <select
                  value={form.staff_role}
                  onChange={e => setForm({...form, staff_role: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)] cursor-pointer font-medium text-[var(--color-ink)]"
                >
                  <option value="Sales Staff">Sales Staff (POS & Sales Entry)</option>
                  <option value="Manager">Manager (Reports, Inventory & Sales)</option>
                </select>
              </div>

              <button disabled={saving} type="submit" className="w-full py-3 mt-2 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl shadow-[0_4px_14px_rgba(20,83,88,0.25)] hover:bg-[#104347] disabled:opacity-50 transition-colors">
                {saving ? 'Creating Account...' : 'Add Staff Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Role Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setEditModal({ open: false, staffId: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">Edit Staff Member</h3>
              <button onClick={() => setEditModal({ open: false, staffId: '' })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            {error && <div className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-[12px] font-semibold">{error}</div>}
            {success && <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-[12px] font-semibold">{success}</div>}

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Full Name</label>
                <ProperCaseInput value={form.full_name} onChange={v => setForm({...form, full_name: v})} required className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Role Permission</label>
                <select
                  value={form.staff_role}
                  onChange={e => setForm({...form, staff_role: e.target.value})}
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium"
                >
                  <option value="Sales Staff">Sales Staff (POS & Sales Entry)</option>
                  <option value="Manager">Manager (Reports, Inventory & Sales)</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Reset Password <span className="text-[10px] text-[var(--color-muted)] font-normal">(optional)</span></label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} minLength={6} placeholder="Leave blank to keep current" className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[13px] outline-none" />
              </div>

              <button disabled={saving} type="submit" className="w-full py-3 mt-2 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl shadow-[0_4px_14px_rgba(20,83,88,0.25)] hover:bg-[#104347] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Branch Profile Modal */}
      {branchModal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setBranchModal({ open: false, branch: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                  {branchModal.branch === 'Main Branch'
                    ? 'Main Store Profile'
                    : isMultiStorePlan
                    ? `${branchModal.branch} (Store Venture)`
                    : `${branchModal.branch} (Chain Branch)`}
                </h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  {isMultiStorePlan
                    ? 'Configure independent store branding and category'
                    : 'Set contact info and location details'}
                </p>
              </div>
              <button onClick={() => setBranchModal({ open: false, branch: '' })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            <form onSubmit={handleSaveBranchProfile} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">
                  {branchModal.branch === 'Main Branch' 
                    ? 'Store Name' 
                    : isMultiStorePlan 
                    ? 'Venture Brand Name' 
                    : 'Branch Display Name'}
                </label>
                <ProperCaseInput
                  value={branchForm.branch_display_name}
                  onChange={v => setBranchForm({...branchForm, branch_display_name: v})}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]"
                  placeholder={branchModal.branch === 'Main Branch' 
                    ? (storeName || 'Main Branch') 
                    : isMultiStorePlan 
                    ? 'e.g. Club Mirage or MedPlus Chemist' 
                    : `${storeName || 'Main Store'} - ${branchModal.branch}`}
                />
                <p className="text-[11px] text-[var(--color-muted)] mt-1">
                  {branchModal.branch === 'Main Branch'
                    ? 'Defaults to your registered store name.'
                    : isMultiStorePlan
                    ? '🏬 Diversified store ventures can configure their own custom brand name.'
                    : `🏢 Chain branches operate under your parent brand name (${storeName || 'Main Store'}).`}
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">
                  {isMultiStorePlan ? 'Store Venture Business Type' : 'Branch Business Type'}
                </label>
                {!isMultiStorePlan && branchModal.branch !== 'Main Branch' ? (
                  <div className="p-3 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-[var(--color-ink)]">
                        {getBusinessTypeLabel(businessType || 'retail_store')}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                        🔒 Inherited (Chain Rule)
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                      All branches in a Multi-Branch chain share the same business type. Want to run different business types (e.g. Pub + Chemist)? Upgrade to{' '}
                      <Link href="/portal/settings" className="text-[var(--color-teal)] underline font-bold">
                        Multi-Store Ventures
                      </Link>.
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={branchForm.business_type || 'retail_store'}
                      onChange={e => setBranchForm({...branchForm, business_type: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)] cursor-pointer font-medium text-[var(--color-ink)]"
                    >
                      {BUSINESS_TYPES.map(b => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--color-muted)] mt-1">
                      {isMultiStorePlan
                        ? '🏬 Multi-Store Active: Each venture can select its own specialized category & catalogue.'
                        : 'Defines your primary business type.'}
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Branch Phone</label>
                <input type="tel" value={branchForm.branch_phone} onChange={e => setBranchForm({...branchForm, branch_phone: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="+254 700 000 000" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Branch Email</label>
                <input type="email" value={branchForm.branch_email} onChange={e => setBranchForm({...branchForm, branch_email: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="branch@example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Branch Address</label>
                <input value={branchForm.branch_address} onChange={e => setBranchForm({...branchForm, branch_address: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="e.g. Shop 5, Town Centre" />
              </div>

              <button disabled={savingBranch} type="submit" className="w-full py-3 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl shadow-[0_4px_14px_rgba(20,83,88,0.25)] hover:bg-[#104347] disabled:opacity-50 transition-colors">
                {savingBranch ? 'Saving...' : '💾 Save Branch Profile'}
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
