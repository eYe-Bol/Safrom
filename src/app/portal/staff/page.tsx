'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import { Topbar } from '@/components/Topbar';

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
};

type BranchConfig = {
  key: string;
  icon: string;
  maxSlots: number;
  requiresPlan: '999' | '1499';
};

const BRANCH_CONFIGS: BranchConfig[] = [
  { key: 'Main Branch', icon: '🏪', maxSlots: 2, requiresPlan: '999' },
  { key: 'Branch 2',    icon: '🏬', maxSlots: 1, requiresPlan: '1499' },
  { key: 'Branch 3',    icon: '🏢', maxSlots: 1, requiresPlan: '1499' },
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
};

export default function StaffPage() {
  const { storeId, isTrial, subscriptionPlan, storeName } = useStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branchProfiles, setBranchProfiles] = useState<Record<string, BranchProfile>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; branch: string }>({ open: false, branch: '' });
  const [editModal, setEditModal] = useState<{ open: boolean; staffId: string }>({ open: false, staffId: '' });
  const [branchModal, setBranchModal] = useState<{ open: boolean; branch: string }>({ open: false, branch: '' });
  const [form, setForm] = useState({ full_name: '', email: '', password: '', staff_role: 'Sales Staff' });
  const [branchForm, setBranchForm] = useState<BranchProfile>(BLANK_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const canAccess999 = isTrial || subscriptionPlan === '999' || subscriptionPlan === '1499';
  const canAccess1499 = isTrial || subscriptionPlan === '1499';

  const fetchStaff = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, branch_name, staff_role, is_active')
      .eq('owner_id', storeId)
      .eq('role', 'employee');
    setStaff(data || []);
    setLoading(false);
  };

  const fetchBranchProfiles = async () => {
    if (!storeId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('branch_profiles')
      .select('*')
      .eq('owner_id', storeId);

    const map: Record<string, BranchProfile> = {};
    (data || []).forEach((bp: any) => {
      map[bp.branch_name] = bp;
    });
    setBranchProfiles(map);
  };

  useEffect(() => {
    if (storeId) {
      fetchStaff();
      fetchBranchProfiles();
    }
  }, [storeId]);

  const openModal = (branch: string) => {
    setForm({ full_name: '', email: '', password: '', staff_role: 'Sales Staff' });
    setError('');
    setSuccess('');
    setModal({ open: true, branch });
  };

  const openEditModal = (member: StaffMember) => {
    setForm({ full_name: member.full_name, email: member.email, password: '', staff_role: member.staff_role });
    setError('');
    setSuccess('');
    setEditModal({ open: true, staffId: member.id });
  };

  const openBranchModal = (branch: string) => {
    const existing = branchProfiles[branch];
    setBranchForm(existing || {
      ...BLANK_PROFILE,
      branch_name: branch,
      branch_display_name: branch === 'Main Branch' ? (storeName || branch) : branch,
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

    const payload = {
      owner_id: storeId,
      branch_name: branchModal.branch,
      branch_display_name: branchForm.branch_display_name || branchModal.branch,
      branch_phone: branchForm.branch_phone,
      branch_email: branchForm.branch_email,
      branch_address: branchForm.branch_address,
    };

    const { error } = await supabase
      .from('branch_profiles')
      .upsert(payload, { onConflict: 'owner_id,branch_name' });

    setSavingBranch(false);

    if (error) {
      fire(`Error: ${error.message}`);
    } else {
      setBranchProfiles(prev => ({ ...prev, [branchModal.branch]: { ...branchForm, branch_name: branchModal.branch } }));
      fire(`✅ ${branchModal.branch} profile saved!`);
      setBranchModal({ open: false, branch: '' });
    }
  };

  const handleRemove = async (staff_id: string, branch_name: string) => {
    if (!confirm(`Are you sure you want to permanently delete this staff member from ${branch_name}?`)) return;

    const res = await fetch('/api/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id, owner_id: storeId }),
    });

    if (res.ok) {
      setStaff(staff.filter(s => s.id !== staff_id));
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
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Staff & Branch Manager" sub="Record all staff, their branches, profiles, and login details" />
      
      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BRANCH_CONFIGS.map(branch => {
          const branchStaff = staff.filter(s => s.branch_name === branch.key);
          const hasAccess = branch.requiresPlan === '999' ? canAccess999 : canAccess1499;
          const profile = branchProfiles[branch.key];
          const displayName = profile?.branch_display_name || (branch.key === 'Main Branch' ? storeName : branch.key) || branch.key;

          return (
            <div key={branch.key} className={`bg-white rounded-xl p-5 border ${hasAccess ? 'border-[var(--color-teal)]/30' : 'border-[var(--color-line-lt)] opacity-60'} flex flex-col relative`}>
              {!hasAccess && (
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
                    {displayName !== branch.key && (
                      <div className="text-[10px] text-[var(--color-muted)] font-medium">{branch.key}</div>
                    )}
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

              {/* Staff List */}
              <div className="flex-1 space-y-2 mb-4">
                {branchStaff.map(member => (
                  <div key={member.id} className={`p-2.5 rounded-lg border ${member.is_active ? 'bg-[var(--color-canvas)] border-[var(--color-line-lt)]' : 'bg-red-50 border-red-100 opacity-70'} flex flex-col`}>
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="text-[13px] font-bold text-[var(--color-ink)] truncate">{member.full_name}</div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${member.is_active ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : 'bg-red-100 text-red-500'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] truncate">{member.email}</div>
                    {member.staff_role && (
                      <div className="text-[10px] font-semibold text-[var(--color-teal)] mt-0.5">👤 {member.staff_role}</div>
                    )}
                    <div className="flex items-center gap-1 mt-2 border-t border-[var(--color-line-lt)] pt-2">
                      <button onClick={() => openEditModal(member)} className="flex-1 py-1 rounded-md text-[11px] font-bold text-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] transition-colors">✏️ Edit</button>
                      <button onClick={() => handleToggleActive(member.id, member.is_active)} className="flex-1 py-1 rounded-md text-[11px] font-bold text-[var(--color-slate)] hover:bg-gray-200 transition-colors">{member.is_active ? '⏸ Pause' : '▶️ Resume'}</button>
                      <button onClick={() => handleRemove(member.id, branch.key)} className="flex-1 py-1 rounded-md text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors">🗑 Delete</button>
                    </div>
                  </div>
                ))}
                {branchStaff.length === 0 && (
                  <div className="text-[12px] text-[var(--color-muted)] text-center py-4 border border-dashed border-[var(--color-line)] rounded-lg">
                    No staff assigned
                  </div>
                )}
              </div>

              {/* Add Button */}
              <button
                disabled={!hasAccess || branchStaff.length >= branch.maxSlots}
                onClick={() => openModal(branch.key)}
                className="mt-auto w-full py-2.5 rounded-lg border-2 border-dashed border-[var(--color-teal)] text-[var(--color-teal)] font-bold text-[13px] hover:bg-[var(--color-teal-bg)] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                + Add Staff
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Staff Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[var(--color-ink)]/40 backdrop-blur-sm" onClick={() => setModal({ open: false, branch: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">Add Staff Member</h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Assigning to: <strong>{modal.branch}</strong></p>
              </div>
              <button onClick={() => setModal({ open: false, branch: '' })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[13px] font-semibold">{error}</div>}
            {success && <div className="mb-4 p-3 bg-[var(--color-teal-bg)] text-[var(--color-teal)] border border-[var(--color-teal)]/20 rounded-xl text-[13px] font-semibold">{success}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Full Name</label>
                <input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Job Role / Position</label>
                <select value={form.staff_role} onChange={e => setForm({...form, staff_role: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)] cursor-pointer">
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Email (For Login)</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Password</label>
                <input required type="password" minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder="Min 6 characters" />
              </div>

              <button disabled={saving} type="submit" className="w-full py-3 mt-2 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl shadow-[0_4px_14px_rgba(20,83,88,0.25)] hover:bg-[#104347] disabled:opacity-50 transition-colors">
                {saving ? 'Creating Account...' : 'Create Account'}
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
                <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)]">{branchModal.branch} Profile</h3>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">Set contact info for this branch</p>
              </div>
              <button onClick={() => setBranchModal({ open: false, branch: '' })} className="text-[20px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">&times;</button>
            </div>

            <form onSubmit={handleSaveBranchProfile} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1.5">Display Name</label>
                <input value={branchForm.branch_display_name} onChange={e => setBranchForm({...branchForm, branch_display_name: e.target.value})} className="w-full px-3.5 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[14px] outline-none focus:border-[var(--color-teal)]" placeholder={branchModal.branch === 'Main Branch' ? storeName || 'Main Branch' : branchModal.branch} />
                {branchModal.branch === 'Main Branch' && (
                  <p className="text-[11px] text-[var(--color-muted)] mt-1">Defaults to your store name. Change here to show a custom label.</p>
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
