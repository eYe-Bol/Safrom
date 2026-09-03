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
  const [updatingScale, setUpdatingScale] = useState(false);
  
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
      const payload = {
        owner_id: user.id,
        branch_name: activeBranchKey,
        branch_display_name: storeName,
        business_type: businessType,
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

  const [modalTier, setModalTier] = useState<PlanCategory>('single');
  const [branchOutlets, setBranchOutlets] = useState<number>(2);
  const [storeOutlets, setStoreOutlets] = useState<number>(2);

  const openUpgradeModal = (targetCategory?: PlanCategory) => {
    setModalTier(targetCategory || (scale === 'multi' ? 'branch' : 'single'));
    setShowUpgrade(true);
  };

  const handleUpdateScale = async (newScale: 'single' | 'multi') => {
    if (!user) return;

    // If user has paid for a single store plan and tries to switch to multi-branch, require Growth Plan upgrade
    if (newScale === 'multi' && isStarterPaid) {
      fire('Multi-Outlet features require a Multi-Branch or Multi-Store Plan. Please upgrade to unlock.');
      openUpgradeModal('branch');
      return;
    }

    setUpdatingScale(true);
    const supabase = createClient();
    const { error } = await supabase.from('users').update({ scale: newScale }).eq('id', user.id);
    if (error) {
      fire(`Error: ${error.message}`);
    } else {
      setUserData(prev => prev ? { ...prev, scale: newScale } : prev);
      setScale(newScale);
      fire(newScale === 'multi' ? '🚀 Upgraded to Multi-Outlet Mode!' : '✅ Switched to Single Store Mode');
    }
    setUpdatingScale(false);
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
      const data = await res.json() as { url?: string; error?: string; details?: unknown };
      if (data.url) {
        window.location.href = data.url;
      } else {
        const errorMessage = data.details ? JSON.stringify(data.details) : data.error;
        fire('Checkout error: ' + errorMessage);
        setCheckingOutPlan(null);
      }
    } catch {
      fire('Failed to start checkout');
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
                <select
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none bg-white font-medium text-[var(--color-ink)] cursor-pointer"
                >
                  {BUSINESS_TYPES.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
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

        {/* Business Scale Toggle (Owner only) */}
        {role !== 'employee' && (
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] flex flex-col justify-between">
            <div>
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-2">Business Scale</h2>
              <p className="text-[13px] text-[var(--color-slate)] mb-4 leading-relaxed">
                Tailor the portal to your business size. Single store mode focuses on 1 branch. Multi-branch allows 3 branches with independent staff.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => handleUpdateScale('single')}
                disabled={updatingScale}
                className={`flex-1 py-3 px-2 border-2 rounded-[12px] text-center transition-all disabled:opacity-50 ${scale === 'single' ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold' : 'border-[var(--color-line-lt)] text-[var(--color-slate)] font-semibold hover:border-[var(--color-line)] cursor-pointer'}`}
              >
                <div className="text-[20px] mb-1">🏪</div>
                <div className="text-[13px]">Single Store</div>
              </button>
              <button 
                onClick={() => handleUpdateScale('multi')}
                disabled={updatingScale}
                className={`flex-1 py-3 px-2 border-2 rounded-[12px] text-center transition-all disabled:opacity-50 relative ${scale === 'multi' ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold' : 'border-[var(--color-line-lt)] text-[var(--color-slate)] font-semibold hover:border-[var(--color-line)] cursor-pointer'}`}
              >
                {isStarterPaid && (
                  <span className="absolute -top-2.5 -right-1 bg-[var(--color-gold)] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    🔒 Upgrade
                  </span>
                )}
                <div className="text-[20px] mb-1">🏬</div>
                <div className="text-[13px]">Multi Branch</div>
              </button>
            </div>
          </div>
        )}

        {/* Active Branch Selector (Only available if multi-branch) */}
        {role !== 'employee' && scale === 'multi' && (
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
            <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">Active Branch</h2>
            <p className="text-[13px] text-[var(--color-slate)] mb-4 leading-relaxed">
              Select which branch's data you want to view across the dashboard, sales, and reports.
            </p>
            <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Current Workspace</label>
            <select
              value={branchName || 'Main Branch'}
              onChange={e => setBranchName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold cursor-pointer"
            >
              <option value="Main Branch">{branchProfiles?.['Main Branch'] || 'Main Branch'}</option>
              <option value="Branch 2">{branchProfiles?.['Branch 2'] || 'Branch 2'}</option>
              <option value="Branch 3">{branchProfiles?.['Branch 3'] || 'Branch 3'}</option>
            </select>
          </div>
        )}

        {/* All Branch Profiles & Categories Card (Multi-Branch only) */}
        {role !== 'employee' && scale === 'multi' && (
          <div className="md:col-span-2 bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">🏬 Branch Profiles & Dedicated Categories</h2>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  These names and categories match what appears at the top of your portal and across branch reports.
                </p>
              </div>
              <Link
                href="/portal/staff"
                className="text-[12px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] border border-[var(--color-teal)]/20 px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              >
                ✏️ Customize in Staff & Branches ➔
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Main Branch', 'Branch 2', 'Branch 3'].map(bKey => {
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
                    <div className="mt-3 pt-2 border-t border-[var(--color-line-lt)] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--color-slate)]">
                        {getBusinessTypeLabel(bType)}
                      </span>
                    </div>
                  </div>
                );
              })}
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

      {/* ─── UPGRADE / PAYMENT MODAL (DYNAMIC MULTI-BRANCH & MULTI-STORE) ─── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-[24px] p-6 w-full max-w-[540px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-[34px] mb-1">
                {modalTier === 'single' ? '🏪' : modalTier === 'branch' ? '🏢' : '🏬'}
              </div>
              <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">
                {modalTier === 'single' ? 'Single Store Starter Plan' : modalTier === 'branch' ? 'Multi-Branch Chain Plan' : 'Multi-Store Diversified Plan'}
              </h2>
              <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                {modalTier === 'single' 
                  ? 'Complete business operations tailored for 1 single shop'
                  : modalTier === 'branch'
                  ? 'Chain outlets with identical business type & synchronized catalogue'
                  : 'Different business types (e.g. Pub + Chemist) with independent catalogues'}
              </p>
            </div>

            {/* ─── PLAN SELECTION TABS ─── */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line)] mb-4">
              <button
                type="button"
                onClick={() => setModalTier('single')}
                className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${modalTier === 'single' ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              >
                🏪 Single Store
              </button>
              <button
                type="button"
                onClick={() => setModalTier('branch')}
                className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${modalTier === 'branch' ? 'bg-white text-[var(--color-teal)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              >
                🏢 Multi-Branch
              </button>
              <button
                type="button"
                onClick={() => setModalTier('store')}
                className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${modalTier === 'store' ? 'bg-white text-[var(--color-gold)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              >
                🏬 Multi-Store
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-4">
              {/* ─── SINGLE STORE: 1 OUTLET ─── */}
              {modalTier === 'single' && (
                <div className="border-2 border-[var(--color-teal)] rounded-2xl p-4 bg-[var(--color-teal-bg)]/20 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal)] text-white px-2 py-0.5 rounded-full">1 Outlet</span>
                      <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mt-1">Starter License</h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[20px] font-bold text-[var(--color-teal)]">KES {calculateAnnualPrice('single', 1).toLocaleString()}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">KES 999 / mo (billed annually)</div>
                    </div>
                  </div>
                  <ul className="text-[12px] text-[var(--color-slate)] space-y-1.5 mb-4">
                    <li className="flex items-center gap-2">✅ <strong>1 Store location</strong> (Main Branch)</li>
                    <li className="flex items-center gap-2">✅ <strong>1 Staff account</strong> included</li>
                    <li className="flex items-center gap-2">✅ <strong>Sales Tracker & POS checkout</strong></li>
                    <li className="flex items-center gap-2">✅ <strong>Product Catalogue with Excel import</strong></li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('single', 1)}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-2.5 bg-[var(--color-teal)] rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {checkingOutPlan === 'single' ? 'Processing...' : `Proceed to Pay KES ${calculateAnnualPrice('single', 1).toLocaleString()}`}
                  </button>
                </div>
              )}

              {/* ─── MULTI-BRANCH: UP TO 10 BRANCHES ─── */}
              {modalTier === 'branch' && (
                <div className="border-2 border-[var(--color-teal)] rounded-2xl p-4 bg-teal-50/40 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal)] text-white px-2 py-0.5 rounded-full">Chain Outlets (Max 10)</span>
                      <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mt-1">Same Business Type</h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[20px] font-bold text-[var(--color-teal)]">
                        KES {calculateAnnualPrice('branch', branchOutlets).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        KES {getMonthlyEquivalent(calculateAnnualPrice('branch', branchOutlets)).toLocaleString()} / mo (annual)
                      </div>
                    </div>
                  </div>

                  {/* Outlet Stepper */}
                  <div className="bg-white p-3 rounded-xl border border-teal-200 flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] font-bold text-[var(--color-slate)] uppercase">Number of Branches</div>
                      <div className="text-[11px] text-[var(--color-muted)]">+KES 6,000/yr per extra branch</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBranchOutlets(prev => Math.max(2, prev - 1))}
                        disabled={branchOutlets <= 2}
                        className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-bold text-[15px] text-[var(--color-ink)]">
                        {branchOutlets}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBranchOutlets(prev => Math.min(10, prev + 1))}
                        disabled={branchOutlets >= 10}
                        className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <ul className="text-[12px] text-[var(--color-slate)] space-y-1.5 mb-4">
                    <li className="flex items-center gap-2">✅ <strong>{branchOutlets} Branches</strong> included (Main Branch + {branchOutlets - 1} branches)</li>
                    <li className="flex items-center gap-2">✅ <strong>Up to {branchOutlets * 2} Staff accounts</strong> (assignable per branch)</li>
                    <li className="flex items-center gap-2">✅ <strong>1-Click Catalogue Sync</strong> between branches</li>
                    <li className="flex items-center gap-2">✅ <strong>Centralized inventory & cross-branch reports</strong></li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('branch', branchOutlets)}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-2.5 bg-[var(--color-teal)] rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {checkingOutPlan === 'branch' ? 'Processing...' : `Proceed to Pay KES ${calculateAnnualPrice('branch', branchOutlets).toLocaleString()}`}
                  </button>
                </div>
              )}

              {/* ─── MULTI-STORE: UP TO 4 DIVERSIFIED STORES ─── */}
              {modalTier === 'store' && (
                <div className="border-2 border-[var(--color-gold)] rounded-2xl p-4 bg-amber-50/40 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-gold)] text-white px-2 py-0.5 rounded-full">Diversified Ventures (Max 4)</span>
                      <h3 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mt-1">Different Business Types</h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[20px] font-bold text-[var(--color-gold)]">
                        KES {calculateAnnualPrice('store', storeOutlets).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        KES {getMonthlyEquivalent(calculateAnnualPrice('store', storeOutlets)).toLocaleString()} / mo (annual)
                      </div>
                    </div>
                  </div>

                  {/* Store Stepper */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] font-bold text-[var(--color-slate)] uppercase">Number of Stores</div>
                      <div className="text-[11px] text-amber-700 font-medium">Discounted: +KES 8,988/yr per store (KES 749/mo)</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStoreOutlets(prev => Math.max(2, prev - 1))}
                        disabled={storeOutlets <= 2}
                        className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-bold text-[15px] text-[var(--color-ink)]">
                        {storeOutlets}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStoreOutlets(prev => Math.min(4, prev + 1))}
                        disabled={storeOutlets >= 4}
                        className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <ul className="text-[12px] text-[var(--color-slate)] space-y-1.5 mb-4">
                    <li className="flex items-center gap-2">✅ <strong>{storeOutlets} Different Business Types</strong> (e.g. Chemist + Pub + Grocery)</li>
                    <li className="flex items-center gap-2">✅ <strong>Completely isolated product catalogues</strong> & pricing rules</li>
                    <li className="flex items-center gap-2">✅ <strong>Independent supplier databases</strong> & expense tracking</li>
                    <li className="flex items-center gap-2">✅ <strong>Up to {storeOutlets * 2} Staff accounts</strong> across stores</li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('store', storeOutlets)}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-2.5 bg-[var(--color-gold)] rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {checkingOutPlan === 'store' ? 'Processing...' : `Proceed to Pay KES ${calculateAnnualPrice('store', storeOutlets).toLocaleString()}`}
                  </button>
                </div>
              )}
            </div>

            {/* Co-Terming & Synchronization Terms */}
            <div className="bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)] leading-relaxed mb-4">
              <strong className="text-[var(--color-slate)]">📋 Subscription & Synchronization Policy:</strong><br />
              All additional outlet licenses are billed annually and synchronize with your primary account&apos;s anniversary cycle
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
          </div>
        </div>
      )}
    </div>
  );
}
