'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';
import ProperCaseInput from '@/components/ProperCaseInput';
import { BUSINESS_TYPES, getBusinessTypeLabel } from '@/utils/businessTypes';
import { calculateAnnualPrice, getMonthlyEquivalent, PRICING, PlanCategory } from '@/utils/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthUser = {
  id: string;
  email: string | undefined;
};

type UserData = {
  id: string;
  role: string | null;
  store_name: string | null;
  store_phone: string | null;
  store_email: string | null;
  business_type: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  trial_end: string | null;
  is_active: boolean | null;
  scale: string | null;
  created_at: string;
  owner_id?: string | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [storeName, setStoreNameLocal] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [businessType, setBusinessType] = useState('retail_store');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [paymentCycle] = useState<12>(12);
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  
  const { role, branchName, setBranchName, branchProfiles, branchBusinessTypes, setStoreName: setContextStoreName, setBusinessType: setContextBusinessType, refreshBranchProfiles, scale, setScale } = useStore();

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const activeBranchKey = branchName || 'Main Branch';
  const activeBranchDisplayName = scale === 'single'
    ? (userData?.store_name || 'My Store')
    : (branchProfiles?.[activeBranchKey] || (activeBranchKey === 'Main Branch' ? (userData?.store_name || 'Main Branch') : activeBranchKey) || 'Main Branch');

  const activeBranchType = scale === 'single'
    ? (userData?.business_type || 'retail_store')
    : (branchBusinessTypes?.[activeBranchKey] || userData?.business_type || 'retail_store');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('payment=success')) {
      fire('🎉 Payment successful! Your subscription is being updated.');
      window.history.replaceState({}, '', '/portal/settings');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email });
        const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (data) {
          const typed = data as UserData;
          
          // If staff account, fetch owner subscription info
          if (typed.role === 'employee' && typed.owner_id) {
            const { data: ownerData } = await supabase
              .from('users')
              .select('subscription_plan, subscription_status, subscription_end_date, created_at, scale, store_name, business_type')
              .eq('id', typed.owner_id)
              .single();

            if (ownerData) {
              typed.subscription_plan = ownerData.subscription_plan;
              typed.subscription_status = ownerData.subscription_status;
              typed.subscription_end_date = ownerData.subscription_end_date;
              typed.created_at = ownerData.created_at;
              typed.scale = ownerData.scale;
              typed.store_name = ownerData.store_name || typed.store_name;
              typed.business_type = ownerData.business_type || typed.business_type;
            }
          }

          setUserData(typed);
          setStoreNameLocal(typed.store_name || '');
          setStorePhone(typed.store_phone || '');
          setStoreEmail(typed.store_email || '');
          setBusinessType(typed.business_type || 'retail_store');
        }
      }
    };
    load();
  }, []);

  const openEditMode = () => {
    if (scale === 'multi') {
      setStoreNameLocal(activeBranchDisplayName);
      setBusinessType(activeBranchType);
    } else {
      setStoreNameLocal(storeName || userData?.store_name || '');
      setBusinessType(businessType || userData?.business_type || 'retail_store');
    }
    setEditMode(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    
    if (scale === 'single' || activeBranchKey === 'Main Branch') {
      const updates = {
        store_name: storeName,
        store_phone: storePhone,
        store_email: storeEmail,
        business_type: businessType,
      };
      
      // 1. Update users table
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      
      // 2. Also keep branch_profiles for Main Branch in sync
      await supabase.from('branch_profiles').upsert({
        owner_id: user.id,
        branch_name: 'Main Branch',
        branch_display_name: storeName,
        branch_phone: storePhone,
        branch_email: storeEmail,
        business_type: businessType,
      }, { onConflict: 'owner_id,branch_name' });

      if (error) {
        fire(`Error: ${error.message}`);
      } else {
        setUserData(prev => prev ? { ...prev, ...updates } : prev);
        setContextStoreName(storeName);
        setContextBusinessType(businessType);
        await refreshBranchProfiles();
        fire('✓ Business profile updated and synchronized!');
        setEditMode(false);
      }
    } else {
      // Multi-branch: update specific active branch profile (e.g. Branch 2, Branch 3)
      const isMultiStorePlan = userData?.subscription_plan === 'store' || userData?.subscription_plan === 'MULTI_STORE' || userData?.subscription_plan?.toLowerCase().includes('store');
      const finalBizType = (!isMultiStorePlan && activeBranchKey !== 'Main Branch')
        ? (userData?.business_type || 'retail_store')
        : businessType;

      const payload = {
        owner_id: user.id,
        branch_name: activeBranchKey,
        branch_display_name: storeName,
        business_type: finalBizType,
        branch_phone: storePhone,
        branch_email: storeEmail,
      };

      const { error } = await supabase
        .from('branch_profiles')
        .upsert(payload, { onConflict: 'owner_id,branch_name' });

      if (error) {
        fire(`Error: ${error.message}`);
      } else {
        await refreshBranchProfiles();
        fire(`✓ ${activeBranchKey} (${storeName}) profile updated!`);
        setEditMode(false);
      }
    }
    setSaving(false);
  };

  const isStarterPaid = userData?.subscription_plan === '999' || userData?.subscription_plan === 'basic' || userData?.subscription_plan === 'starter';
  const isGrowthPaid = userData?.subscription_plan === '1999' || userData?.subscription_plan === '1499' || userData?.subscription_plan === 'pro' || userData?.subscription_plan === 'growth' || userData?.subscription_plan?.includes('branch') || userData?.subscription_plan?.includes('store');
  const isMultiStorePlan = userData?.subscription_plan === 'store' || userData?.subscription_plan === 'MULTI_STORE' || userData?.subscription_plan?.toLowerCase().includes('store');

  // ── Smart outlet detection ────────────────────────────────────────────────────
  type BranchProfileRow = { branch_name: string; business_type: string | null; branch_display_name: string | null };
  const [detectedOutlets, setDetectedOutlets] = useState<BranchProfileRow[]>([]);
  const [detectedTier, setDetectedTier] = useState<PlanCategory>('single');
  const [detectedCount, setDetectedCount] = useState<number>(1);
  const [targetOutlets, setTargetOutlets] = useState<number>(1);
  const [dropMode, setDropMode] = useState(false);
  const [outletLoadingModal, setOutletLoadingModal] = useState(false);
  const [dropConfirm, setDropConfirm] = useState<string | null>(null); // branch_name to drop
  const [droppingOutlet, setDroppingOutlet] = useState(false);

  const openUpgradeModal = async (_targetCategory?: PlanCategory) => {
    setOutletLoadingModal(true);
    setDropMode(false);
    setDropConfirm(null);
    setShowUpgrade(true);

    // Auto-detect registered outlets
    const supabase = createClient();
    const ownerId = userData?.id || user?.id;
    if (!ownerId) { setOutletLoadingModal(false); return; }

    const { data: profiles } = await supabase
      .from('branch_profiles')
      .select('branch_name, business_type, branch_display_name')
      .eq('owner_id', ownerId);

    const rows = (profiles as BranchProfileRow[] | null) || [];
    // Always ensure Main Branch is counted even if not in branch_profiles
    const hasMB = rows.some(r => r.branch_name === 'Main Branch');
    const allBranches: BranchProfileRow[] = hasMB
      ? rows
      : [{ branch_name: 'Main Branch', business_type: userData?.business_type || null, branch_display_name: userData?.store_name || 'Main Branch' }, ...rows];

    setDetectedOutlets(allBranches);

    const count = allBranches.length;
    const uniqueTypes = new Set(allBranches.map(b => b.business_type || 'retail_store'));
    const isMultiStore = uniqueTypes.size > 1;

    // Determine detected plan category
    let category: PlanCategory = 'single';
    if (count >= 2) {
      category = isMultiStore ? 'store' : 'branch';
    }

    setDetectedTier(category);
    setDetectedCount(count);
    setTargetOutlets(count); // Default: stay at current count (renew)
    setOutletLoadingModal(false);
  };

  const handleExecuteDropOutlet = async (branchNameToDrop: string) => {
    if (!branchNameToDrop || branchNameToDrop === 'Main Branch') return;
    const ownerId = userData?.id || user?.id;
    if (!ownerId) return;

    setDroppingOutlet(true);
    const supabase = createClient();

    // 1. Delete from branch_profiles
    const { error: delError } = await supabase
      .from('branch_profiles')
      .delete()
      .eq('owner_id', ownerId)
      .eq('branch_name', branchNameToDrop);

    if (delError) {
      fire(`Failed to remove outlet: ${delError.message}`);
      setDroppingOutlet(false);
      return;
    }

    // 2. Decrement branch_limit in users
    const newCount = Math.max(1, (detectedCount || 2) - 1);
    const updates: { branch_limit: number; scale?: 'single' | 'multi' } = { branch_limit: newCount };
    if (newCount <= 1) {
      updates.scale = 'single';
      setScale('single');
    }
    await supabase.from('users').update(updates).eq('id', ownerId);

    // 3. Reset active workspace if dropped
    if (branchName === branchNameToDrop) {
      setBranchName('Main Branch');
    }

    // 4. Synchronize context & state
    await refreshBranchProfiles();
    setUserData(prev => prev ? { ...prev, branch_limit: newCount, scale: updates.scale || prev.scale } : prev);
    fire(`Outlet "${branchNameToDrop}" removed successfully.`);

    // 5. Re-run detection to update UI
    setDropConfirm(null);
    setDropMode(false);
    await openUpgradeModal();
    setDroppingOutlet(false);
  };

  const handleCheckout = async (planCategory: PlanCategory, outletsCount: number = 1) => {
    const storeId = userData?.id;
    if (!storeId || !user?.email) {
      fire('User email or store ID missing');
      return;
    }
    setCheckingOutPlan(planCategory);
    try {
      const amount = calculateAnnualPrice(planCategory, outletsCount);
      const isAddon = isGrowthPaid || isStarterPaid;
      const planCode = planCategory === 'single' ? 'BASIC' : (planCategory === 'branch' ? 'MULTI_BRANCH' : 'MULTI_STORE');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          plan: planCode,
          months: 12,
          amount,
          outlets: outletsCount,
          isAddon,
          email: user.email,
          name: userData?.store_name,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        fire(data.error ? `Checkout error: ${data.error}` : 'Unable to proceed to payment. Please try again.');
        setCheckingOutPlan(null);
      }
    } catch {
      fire('Failed to start checkout. Please try again.');
      setCheckingOutPlan(null);
    }
  };

  const subInfo = useMemo(() => {
    if (!userData) {
      return {
        status: 'loading',
        statusBadge: 'Loading…',
        badgeColor: 'bg-gray-100 text-gray-700',
        plan: '—',
        daysRemaining: '—',
        endDate: '—',
      };
    }

    const isExempt = 
      userData.role === 'admin' ||
      userData.subscription_plan === 'exempt' ||
      userData.subscription_plan === 'lifetime' ||
      userData.subscription_plan === 'admin' ||
      userData.subscription_status === 'exempt';

    if (isExempt) {
      return {
        status: 'exempt',
        statusBadge: 'Exempt / VIP',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
        plan: userData.role === 'admin' ? 'Super Admin (Unrestricted)' : 'Lifetime VIP (Complimentary)',
        daysRemaining: 'Permanent Access',
        endDate: 'Lifetime Access (No Expiry)',
      };
    }

    const now = new Date();

    // 1. Paid Subscription
    if (userData.subscription_end_date) {
      const end = new Date(userData.subscription_end_date);
      const diff = end.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const formattedDate = end.toLocaleDateString('en-KE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const isStarter = userData.subscription_plan === 'starter' || userData.subscription_plan === '999' || userData.subscription_plan === 'basic';
      const planName = isStarter ? 'Starter Plan (Single Store)' : 'Growth Plan (Multi Branch)';

      if (days > 0) {
        return {
          status: 'active',
          statusBadge: 'Active (Paid)',
          badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
          plan: planName,
          daysRemaining: `${days} day${days !== 1 ? 's' : ''} remaining`,
          endDate: formattedDate,
        };
      } else {
        return {
          status: 'expired',
          statusBadge: 'Expired',
          badgeColor: 'bg-red-100 text-red-800 border border-red-200',
          plan: planName,
          daysRemaining: '0 days (Expired)',
          endDate: `Expired on ${formattedDate}`,
        };
      }
    }

    // 2. 7-Day Free Trial
    let trialEndDate = userData.created_at ? new Date(userData.created_at) : (userData.trial_end ? new Date(userData.trial_end) : new Date());
    if (userData.created_at) {
      trialEndDate = new Date(new Date(userData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const trialDiff = trialEndDate.getTime() - now.getTime();
    const trialDays = Math.ceil(trialDiff / (1000 * 60 * 60 * 24));
    const formattedTrialDate = trialEndDate.toLocaleDateString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (trialDays > 0) {
      return {
        status: 'trial',
        statusBadge: 'Trial Active',
        badgeColor: 'bg-blue-100 text-blue-800 border border-blue-200',
        plan: '7-Day Free Trial',
        daysRemaining: `${trialDays} day${trialDays !== 1 ? 's' : ''} remaining`,
        endDate: formattedTrialDate,
      };
    }

    return {
      status: 'expired',
      statusBadge: 'Trial Expired',
      badgeColor: 'bg-red-100 text-red-800 border border-red-200',
      plan: '7-Day Free Trial',
      daysRemaining: '0 days (Trial Ended)',
      endDate: `Ended on ${formattedTrialDate}`,
    };
  }, [userData]);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Settings" sub="Business profile and account management" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-5 max-w-[900px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Business Profile */}
        <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
          <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">Business Profile</h2>
          {editMode ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  {scale === 'multi' ? `Branch Name (${activeBranchKey})` : 'Business / Store Name'}
                </label>
                <ProperCaseInput value={storeName} onChange={setStoreNameLocal} className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">
                  {scale === 'multi' ? `Branch Category (${activeBranchKey})` : 'Business Type / Category'}
                </label>
                {scale === 'multi' && activeBranchKey !== 'Main Branch' && !isMultiStorePlan ? (
                  <div className="p-3 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-[var(--color-ink)]">
                        {getBusinessTypeLabel(userData?.business_type || 'retail_store')}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                        🔒 Inherited (Chain Rule)
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                      All branches in a Multi-Branch chain share the same business type as your main store. To run diversified ventures (e.g. Chemist + Pub),{' '}
                      <button
                        type="button"
                        onClick={() => openUpgradeModal('store')}
                        className="text-[var(--color-teal)] underline font-bold cursor-pointer inline"
                      >
                        upgrade to Multi-Store Ventures
                      </button>.
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={businessType}
                      onChange={e => setBusinessType(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none bg-white font-medium text-[var(--color-ink)] cursor-pointer"
                    >
                      {BUSINESS_TYPES.map(b => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                    {scale === 'multi' && isMultiStorePlan && activeBranchKey !== 'Main Branch' && (
                      <p className="text-[11px] text-[var(--color-teal)] font-medium mt-1">
                        🏬 Multi-Store Active: You can set an independent category for this store.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store WhatsApp Number</label>
                <input value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="e.g. +254700000000" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store Email</label>
                <input type="email" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="store@example.com" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditMode(false)} className="flex-1 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer">Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-2 bg-[var(--color-teal)] text-white rounded-lg font-bold text-[13px] disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <>
              {[
                ...(scale === 'multi' ? [
                  ['Active Store Name', (
                    <span className="font-bold text-[var(--color-ink)]">
                      {activeBranchDisplayName}
                    </span>
                  )],
                  ['Active Branch Workspace', (
                    <span className="font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2.5 py-0.5 rounded-md border border-[var(--color-teal)]/20">
                      📍 {activeBranchKey}
                    </span>
                  )],
                  ['Active Branch Category', (
                    <span className="font-semibold text-[var(--color-teal)]">
                      {getBusinessTypeLabel(activeBranchType)}
                    </span>
                  )],
                  ['Main Registered Business', userData?.store_name || storeName || 'Not set'],
                ] : [
                  ['Business Name', storeName || userData?.store_name || 'Not set'],
                  ['Business Type', (
                    <span className="font-semibold text-[var(--color-teal)]">
                      {getBusinessTypeLabel(businessType || userData?.business_type || 'retail_store')}
                    </span>
                  )],
                ]),
                ['Store WhatsApp', userData?.store_phone || 'Not set'],
                ['Store Email', userData?.store_email || 'Not set'],
                ['Login Email', user?.email || '—'],
                ['Role', userData?.role ? (userData.role === 'admin' ? '👑 Super Admin' : userData.role === 'employee' ? 'Staff Account' : 'Store Owner') : '—'],
                ['Current Plan', subInfo.plan],
                ['Status', (
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${subInfo.badgeColor}`}>
                    {subInfo.statusBadge}
                  </span>
                )],
                ['Days Remaining', (
                  <span className={`font-semibold ${subInfo.status === 'expired' ? 'text-red-600 font-bold' : subInfo.status === 'exempt' ? 'text-amber-700 font-bold' : 'text-[var(--color-ink)]'}`}>
                    {subInfo.daysRemaining}
                  </span>
                )],
                ['End Date', (
                  <span className="font-semibold text-[var(--color-ink)]">
                    {subInfo.endDate}
                  </span>
                )],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between items-center py-2.5 border-b border-[var(--color-line-lt)]">
                  <span className="text-[13px] text-[var(--color-muted)]">{l as string}</span>
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">{v as React.ReactNode}</span>
                </div>
              ))}
              <button onClick={openEditMode} className="mt-4 px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90 cursor-pointer">
                Edit Profile
              </button>
            </>
          )}
        </div>

        {/* Active Outlet Switcher (Owner only, multi-scale) */}
        {role !== 'employee' && scale === 'multi' && (
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
            <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">Active Workspace</h2>
            <p className="text-[13px] text-[var(--color-slate)] mb-4 leading-relaxed">
              Select which branch or store you want to operate in across the dashboard, sales, and reports.
            </p>
            <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Current Workspace</label>
            <select
              value={branchName || 'Main Branch'}
              onChange={e => setBranchName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold cursor-pointer"
            >
              {Object.keys(branchProfiles || {}).length > 0
                ? Object.keys(branchProfiles).map(bk => (
                    <option key={bk} value={bk}>{branchProfiles[bk] || bk}</option>
                  ))
                : <option value="Main Branch">{userData?.store_name || 'Main Branch'}</option>
              }
            </select>
          </div>
        )}

        {/* All Branch Profiles & Categories Card (Multi-Branch only) */}
        {role !== 'employee' && scale === 'multi' && (
          <div className="md:col-span-2 bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">🏬 Registered Outlets</h2>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  All branches and stores linked to your account. Customize names and categories from the Staff page.
                </p>
              </div>
              <Link
                href="/portal/staff"
                className="text-[12px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border border-[var(--color-teal)]/20 px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              >
                ✏️ Manage in Staff & Branches ➔
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.keys(branchProfiles || { 'Main Branch': userData?.store_name || 'Main Branch' }).map(bKey => {
                const bName = branchProfiles?.[bKey] || (bKey === 'Main Branch' ? (userData?.store_name || 'Main Branch') : bKey);
                const bType = branchBusinessTypes?.[bKey] || (bKey === 'Main Branch' ? (userData?.business_type || 'retail_store') : 'retail_store');
                const isActiveBranch = (branchName || 'Main Branch') === bKey;

                return (
                  <div key={bKey} className={`p-3.5 rounded-xl border ${isActiveBranch ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]/20 shadow-sm' : 'border-[var(--color-line-lt)] bg-[var(--color-canvas)]'} flex flex-col justify-between`}>
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">{bKey}</span>
                        {isActiveBranch && (
                          <span className="text-[9px] font-bold text-white bg-[var(--color-teal)] px-1.5 py-0.2 rounded-full">ACTIVE</span>
                        )}
                      </div>
                      <div className="font-serif text-[14px] font-bold text-[var(--color-ink)] truncate">
                        {bName}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[var(--color-line-lt)] flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[11px] font-bold text-[var(--color-slate)]">
                        {getBusinessTypeLabel(bType)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${bKey === 'Main Branch' ? 'bg-teal-50 text-teal-700' : isMultiStorePlan ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {bKey === 'Main Branch' ? 'Primary' : isMultiStorePlan ? '🏬 Venture' : '🏢 Branch'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-[var(--color-canvas)] p-3.5 rounded-xl border border-[var(--color-line-lt)] text-[12px] text-[var(--color-muted)] leading-relaxed mt-3 flex flex-col gap-1.5">
              <strong className="text-[var(--color-slate)]">⚖️ Multi-Branch vs Multi-Store Policy:</strong>
              <div>
                • <strong className="text-[var(--color-ink)]">Multi-Branch Chains (KES 6,000/yr per extra branch):</strong> All outlets share identical business types (e.g. all Chemist or all Retail), operate under your primary parent brand, and synchronize product catalogues.
              </div>
              <div>
                • <strong className="text-[var(--color-ink)]">Multi-Store Ventures (KES 8,988/yr per extra store):</strong> Outlets can operate different business types (e.g. Chemist + Pub), feature independent brand names on receipts, and maintain isolated product catalogues.
              </div>
            </div>
          </div>
        )}


        {/* Plan & Upgrades Card */}
        <div className="md:col-span-2 bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                Subscription Plan ({scale === 'multi' ? 'Multi-Branch' : 'Single Store'})
              </h2>
              <p className="text-[13px] text-[var(--color-slate)] mt-0.5">
                {userData?.subscription_plan ? (
                  <>Active plan: <strong className="text-[var(--color-teal)]">{userData.subscription_plan === 'pro' || userData.subscription_plan === '1999' || userData.subscription_plan === '1499' || userData.subscription_plan === 'growth' ? 'Growth Plan (Multi-Branch)' : 'Starter Plan (Single Store)'}</strong></>
                ) : (
                  <>Current status: <strong className="text-[var(--color-gold)]">7-Day Free Trial</strong></>
                )}
              </p>
            </div>
            <button
              onClick={() => openUpgradeModal(scale === 'multi' ? 'branch' : 'single')}
              className="px-4 py-2 bg-[var(--color-gold)] text-white rounded-lg text-[13px] font-bold hover:opacity-90 cursor-pointer shadow-sm"
            >
              {userData?.subscription_plan ? 'Upgrade / Renew 🚀' : 'Choose Subscription Plan 🚀'}
            </button>
          </div>
        </div>

        {/* Access Levels note */}
        <div className="md:col-span-2 bg-[var(--color-teal-bg)] rounded-xl p-4 border border-[var(--color-teal)]/20 text-[13px] text-[var(--color-teal)] leading-[1.7]">
          <strong>Access levels: </strong><strong>Owner</strong> — full access.{' '}
          <strong>Manager</strong> — all operations, no settings.{' '}
          <strong>Employee</strong> — inventory, expenses, and Situation Room only.
        </div>
      </div>

      {/* ─── SMART GUIDED SUBSCRIPTION MODAL ─── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => { if (!checkingOutPlan) setShowUpgrade(false); }}>
          <div className="bg-white rounded-[24px] p-6 w-full max-w-[520px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Loading skeleton */}
            {outletLoadingModal ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-[var(--color-teal)] border-t-transparent animate-spin" />
                <p className="text-[13px] text-[var(--color-muted)]">Checking your registered outlets…</p>
              </div>
            ) : (
              <>
                {/* ─── Header ─── */}
                <div className="text-center mb-5">
                  <div className="text-[34px] mb-1">
                    {detectedTier === 'single' ? '🏪' : detectedTier === 'branch' ? '🏢' : '🏬'}
                  </div>
                  <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">
                    {detectedTier === 'single' ? 'Single Store Plan' : detectedTier === 'branch' ? 'Multi-Branch Chain Plan' : 'Multi-Store Diversified Plan'}
                  </h2>
                  <p className="text-[12px] text-[var(--color-muted)] mt-1">
                    {detectedCount === 1
                      ? 'You have 1 registered outlet. Your plan is based on what you\'ve set up.'
                      : `You have ${detectedCount} registered outlets — your plan is automatically matched below.`}
                  </p>
                </div>

                {/* ─── Detected Outlets List ─── */}
                <div className="bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)] divide-y divide-[var(--color-line-lt)] mb-4 overflow-hidden">
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider">Your Registered Outlets ({detectedCount})</span>
                    {!dropMode && detectedCount < (detectedTier === 'store' ? 4 : 10) && (
                      <button
                        type="button"
                        onClick={() => setTargetOutlets(detectedCount + 1)}
                        className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2.5 py-1 rounded-lg hover:opacity-80 cursor-pointer"
                      >
                        + Add Outlet
                      </button>
                    )}
                    {!dropMode && detectedCount > 1 && (
                      <button
                        type="button"
                        onClick={() => { setDropMode(true); setTargetOutlets(detectedCount); }}
                        className="ml-2 text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg hover:opacity-80 cursor-pointer"
                      >
                        − Drop Outlet
                      </button>
                    )}
                    {dropMode && (
                      <button type="button" onClick={() => { setDropMode(false); setDropConfirm(null); setTargetOutlets(detectedCount); }} className="text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer">
                        Cancel
                      </button>
                    )}
                  </div>

                  {detectedOutlets.map((outlet, idx) => {
                    const displayName = outlet.branch_display_name || (outlet.branch_name === 'Main Branch' ? (userData?.store_name || 'Main Store') : outlet.branch_name);
                    const isMain = outlet.branch_name === 'Main Branch';
                    const isMarkedDrop = dropConfirm === outlet.branch_name;

                    return (
                      <div key={outlet.branch_name} className={`px-4 py-3 flex items-center justify-between ${isMarkedDrop ? 'bg-red-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[16px] ${isMain ? 'bg-[var(--color-teal-bg)]' : 'bg-[var(--color-canvas)] border border-[var(--color-line-lt)]'}`}>
                            {isMain ? '🏪' : idx % 2 === 0 ? '🏢' : '🏬'}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[var(--color-ink)]">{displayName}</div>
                            <div className="text-[11px] text-[var(--color-muted)]">
                              {outlet.branch_name}
                              {isMain && <span className="ml-1.5 text-[9px] font-bold bg-[var(--color-teal)] text-white px-1.5 py-0.2 rounded-full">PRIMARY</span>}
                            </div>
                          </div>
                        </div>
                        {dropMode && !isMain && (
                          <button
                            type="button"
                            onClick={() => setDropConfirm(isMarkedDrop ? null : outlet.branch_name)}
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${isMarkedDrop ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                          >
                            {isMarkedDrop ? '✓ Selected' : 'Select to Drop'}
                          </button>
                        )}
                        {dropMode && isMain && (
                          <span className="text-[10px] text-[var(--color-muted)] italic">Cannot drop primary</span>
                        )}
                      </div>
                    );
                  })}

                  {/* Adding a new outlet row */}
                  {targetOutlets > detectedCount && (
                    <div className="px-4 py-3 flex items-center gap-3 bg-[var(--color-teal-bg)]/30 border-t-2 border-dashed border-[var(--color-teal)]">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] border-2 border-dashed border-[var(--color-teal)] flex items-center justify-center text-[var(--color-teal)] font-bold text-[16px]">+</div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--color-teal)]">New Outlet (to be added)</div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          {detectedTier === 'branch' ? '+KES 6,000/yr — same business type branch' : '+KES 8,988/yr — new diversified store type'}
                        </div>
                      </div>
                      <button type="button" onClick={() => setTargetOutlets(detectedCount)} className="ml-auto text-[18px] text-[var(--color-muted)] hover:text-red-400 cursor-pointer">×</button>
                    </div>
                  )}
                </div>

                {/* ─── Drop Confirmation Warning ─── */}
                {dropMode && dropConfirm && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4 text-[12px] text-red-700 leading-relaxed">
                    <div className="font-bold text-[13px] mb-1">⚠️ Remove &quot;{dropConfirm}&quot; from your account?</div>
                    <p className="mb-3 text-[11px] text-red-600">
                      Dropping this outlet will delete its branch profile immediately and downscale your account to {detectedCount - 1} outlet{detectedCount - 1 !== 1 ? 's' : ''}.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleExecuteDropOutlet(dropConfirm)}
                        disabled={droppingOutlet}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {droppingOutlet ? 'Removing...' : `🗑️ Confirm Drop "${dropConfirm}" Now`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDropConfirm(null)}
                        disabled={droppingOutlet}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg font-semibold text-[11px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Pricing Summary ─── */}
                {(() => {
                  const effectiveTier = detectedTier;
                  const effectiveCount = dropMode && dropConfirm ? detectedCount - 1 : targetOutlets;
                  const finalCategory: PlanCategory = effectiveCount === 1 ? 'single' : effectiveTier;
                  const totalAmt = calculateAnnualPrice(finalCategory, effectiveCount);
                  const monthlyAmt = getMonthlyEquivalent(totalAmt);
                  const isExpanding = targetOutlets > detectedCount;
                  const isDroppingPlan = dropMode && dropConfirm && effectiveCount < detectedCount;

                  return (
                    <div className={`border-2 ${isDroppingPlan ? 'border-red-300 bg-red-50/30' : 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]/20'} rounded-2xl p-4 mb-4`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white ${isDroppingPlan ? 'bg-red-400' : 'bg-[var(--color-teal)]'}`}>
                            {effectiveCount} {effectiveCount === 1 ? 'Location' : 'Locations'}
                            {isExpanding && ' (after adding)'}
                            {isDroppingPlan && ' (after dropping)'}
                          </span>
                          <div className="font-serif text-[22px] font-bold text-[var(--color-ink)] mt-1">KES {totalAmt.toLocaleString()}</div>
                          <div className="text-[11px] text-[var(--color-muted)]">KES {monthlyAmt.toLocaleString()} / mo (12 months)</div>
                        </div>
                        <div className="text-right text-[12px] text-[var(--color-slate)]">
                          {finalCategory === 'single' && <div>🏪 Single Store Starter</div>}
                          {finalCategory === 'branch' && <div>🏢 Multi-Branch Chain</div>}
                          {finalCategory === 'store' && <div>🏬 Multi-Store Ventures</div>}
                        </div>
                      </div>
                      <ul className="text-[12px] text-[var(--color-slate)] space-y-1 mb-4">
                        <li className="flex items-center gap-2">✅ <strong>{effectiveCount} {effectiveCount === 1 ? 'Store location' : 'Active locations'}</strong></li>
                        <li className="flex items-center gap-2">✅ <strong>Up to {Math.max(1, effectiveCount) * 2} Staff accounts</strong> assignable across outlets</li>
                        {finalCategory !== 'single' && <li className="flex items-center gap-2">✅ <strong>Centralized dashboard</strong> with per-outlet analytics</li>}
                        {finalCategory === 'branch' && <li className="flex items-center gap-2">✅ <strong>1-Click Catalogue Sync</strong> between branches</li>}
                        {finalCategory === 'store' && <li className="flex items-center gap-2">✅ <strong>Independent catalogues</strong> &amp; isolated pricing per store</li>}
                      </ul>
                      <button
                        onClick={() => handleCheckout(finalCategory, effectiveCount)}
                        disabled={checkingOutPlan !== null}
                        className={`block w-full py-2.5 rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md ${isDroppingPlan ? 'bg-red-500' : 'bg-[var(--color-teal)]'}`}
                      >
                        {checkingOutPlan !== null
                          ? 'Processing…'
                          : isDroppingPlan
                          ? `Renew with ${effectiveCount} outlet${effectiveCount !== 1 ? 's' : ''} — KES ${totalAmt.toLocaleString()}`
                          : isExpanding
                          ? `Add Outlet & Pay KES ${totalAmt.toLocaleString()}`
                          : `Renew Subscription — KES ${totalAmt.toLocaleString()}`}
                      </button>
                    </div>
                  );
                })()}

                {/* Co-Terming Note */}
                <div className="bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)] leading-relaxed mb-4">
                  <strong className="text-[var(--color-slate)]">📋 Subscription &amp; Synchronization Policy:</strong><br />
                  All outlet licenses are billed annually and synchronize with your primary account&apos;s anniversary cycle
                  {userData?.subscription_end_date ? ` (expires ${new Date(userData.subscription_end_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}.
                  All active outlets renew together under one unified annual invoice.
                </div>

                <button
                  onClick={() => setShowUpgrade(false)}
                  disabled={checkingOutPlan !== null}
                  className="w-full py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[13px] text-[var(--color-slate)] hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Maybe Later
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
