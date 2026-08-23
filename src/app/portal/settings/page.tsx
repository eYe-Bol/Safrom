'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/context/StoreContext';

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
  subscription_plan: string | null;
  subscription_status: string | null;
  trial_end: string | null;
  is_active: boolean | null;
  scale: string | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [storeName, setStoreNameLocal] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [paymentCycle, setPaymentCycle] = useState<6 | 12>(6);
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const [updatingScale, setUpdatingScale] = useState(false);
  
  const { role, branchName, setBranchName, branchProfiles, setStoreName: setContextStoreName, scale, setScale } = useStore();

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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
          setUserData(typed);
          setStoreNameLocal(typed.store_name || '');
          setStorePhone(typed.store_phone || '');
          setStoreEmail(typed.store_email || '');
        }
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const updates = {
      store_name: storeName,
      store_phone: storePhone,
      store_email: storeEmail,
    };
    const { error } = await supabase.from('users').update(updates).eq('id', user.id);
    if (error) {
      fire(`Error: ${error.message}`);
    } else {
      // Update local state
      setUserData(prev => prev ? { ...prev, ...updates } : prev);
      // Update global context — no page reload needed
      setContextStoreName(storeName);
      fire('✓ Business profile updated!');
      setEditMode(false);
    }
    setSaving(false);
  };

  const isStarterPaid = userData?.subscription_plan === '999' || userData?.subscription_plan === 'basic' || userData?.subscription_plan === 'starter';
  const isGrowthPaid = userData?.subscription_plan === '1499' || userData?.subscription_plan === 'pro' || userData?.subscription_plan === 'growth';

  const [modalScale, setModalScale] = useState<'single' | 'multi'>('single');

  const openUpgradeModal = (targetScale?: 'single' | 'multi') => {
    setModalScale(targetScale || (scale === 'multi' ? 'multi' : 'single'));
    setShowUpgrade(true);
  };

  const handleUpdateScale = async (newScale: 'single' | 'multi') => {
    if (!user) return;

    // If user has paid for a single store plan and tries to switch to multi-branch, require Growth Plan upgrade
    if (newScale === 'multi' && isStarterPaid) {
      fire('Multi-Branch features require the Growth Plan. Please upgrade to unlock.');
      openUpgradeModal('multi');
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
      fire(newScale === 'multi' ? '🚀 Upgraded to Multi-Branch Mode!' : '✅ Switched to Single Store Mode');
    }
    setUpdatingScale(false);
  };

  const handleCheckout = async (plan: 'BASIC' | 'PRO') => {
    const storeId = userData?.id;
    if (!storeId || !user?.email) {
      fire('User email or store ID missing');
      return;
    }
    setCheckingOutPlan(plan);
    try {
      const amount = plan === 'BASIC' ? 999 * paymentCycle : 1499 * paymentCycle;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          plan,
          months: paymentCycle,
          amount,
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

  const trialDaysLeft = userData?.trial_end
    ? Math.max(0, Math.ceil((new Date(userData.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

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
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Business / Store Name</label>
                <input value={storeName} onChange={e => setStoreNameLocal(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store WhatsApp Number</label>
                <input value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="e.g. +254700000000" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store Email</label>
                <input value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="store@example.com" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditMode(false)} className="flex-1 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg font-semibold text-[13px] text-[var(--color-slate)] cursor-pointer">Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-2 bg-[var(--color-teal)] text-white rounded-lg font-bold text-[13px] disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <>
              {[
                ['Business Name', userData?.store_name || 'Not set'],
                ['Store WhatsApp', userData?.store_phone || 'Not set'],
                ['Store Email', userData?.store_email || 'Not set'],
                ['Login Email', user?.email || '—'],
                ['Role', userData?.role || '—'],
                ['Status', userData?.subscription_status || 'trial'],
                ...(trialDaysLeft !== null ? [['Trial Days Left', `${trialDaysLeft} days`]] : []),
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2.5 border-b border-[var(--color-line-lt)]">
                  <span className="text-[13px] text-[var(--color-muted)]">{l}</span>
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">{v}</span>
                </div>
              ))}
              <button onClick={() => setEditMode(true)} className="mt-4 px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90 cursor-pointer">
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

        {/* Plan & Upgrades Card */}
        <div className="md:col-span-2 bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                Subscription Plan ({scale === 'multi' ? 'Multi-Branch' : 'Single Store'})
              </h2>
              <p className="text-[13px] text-[var(--color-slate)] mt-0.5">
                {userData?.subscription_plan ? (
                  <>Active plan: <strong className="text-[var(--color-teal)]">{userData.subscription_plan === 'pro' || userData.subscription_plan === '1499' ? 'Growth Plan (Multi-Branch)' : 'Starter Plan (Single Store)'}</strong></>
                ) : (
                  <>Current status: <strong className="text-[var(--color-gold)]">7-Day Free Trial</strong></>
                )}
              </p>
            </div>
            <button
              onClick={() => openUpgradeModal(scale === 'multi' ? 'multi' : 'single')}
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

      {/* ─── UPGRADE / PAYMENT MODAL (TAILORED TO CHOSEN PLAN) ─── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[480px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-[36px] mb-2">{modalScale === 'single' ? '🏪' : '🏬'}</div>
              <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">
                {modalScale === 'single' ? 'Single Store Starter Plan' : 'Multi-Branch Growth Plan'}
              </h2>
              <p className="text-[13px] text-[var(--color-muted)] mt-1">
                {modalScale === 'single' 
                  ? 'Complete business operations tailored for 1 single shop'
                  : 'Advanced multi-location management for up to 3 branches'}
              </p>
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <div className="flex flex-col">
                <label className="text-[12px] font-bold text-[var(--color-slate)] mb-1">Select Payment Cycle</label>
                <select
                  value={paymentCycle}
                  onChange={e => setPaymentCycle(parseInt(e.target.value) as 6 | 12)}
                  className="w-full px-3 py-2.5 border border-[var(--color-teal)] rounded-xl text-[14px] outline-none bg-white font-semibold text-[var(--color-ink)] cursor-pointer"
                >
                  <option value={6}>6 Months (Save time with semi-annual billing)</option>
                  <option value={12}>12 Months (Full annual coverage)</option>
                </select>
              </div>

              {/* ─── SINGLE STORE: STARTER PLAN CARD ONLY ─── */}
              {modalScale === 'single' && (
                <div className="border-2 border-[var(--color-teal)] rounded-2xl p-5 bg-[var(--color-teal-bg)]/20 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-teal)] text-white px-2 py-0.5 rounded-full">Single Store</span>
                      <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mt-1">Starter Plan</h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[20px] font-bold text-[var(--color-teal)]">KES {(999 * paymentCycle).toLocaleString()}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">KES 999 / month</div>
                    </div>
                  </div>
                  <ul className="text-[13px] text-[var(--color-slate)] space-y-2 mb-4">
                    <li className="flex items-center gap-2">✅ <strong>1 Branch</strong> (Main Branch)</li>
                    <li className="flex items-center gap-2">✅ <strong>1 Staff account</strong> included</li>
                    <li className="flex items-center gap-2">✅ <strong>Full dashboard & reporting</strong></li>
                    <li className="flex items-center gap-2">✅ <strong>Sales Tracker & POS checkout</strong></li>
                    <li className="flex items-center gap-2">✅ <strong>Product Catalogue with Excel import</strong></li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('BASIC')}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-3 bg-[var(--color-teal)] rounded-xl font-bold text-[14px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {checkingOutPlan === 'BASIC' ? 'Processing Checkout...' : `Proceed to Pay KES ${(999 * paymentCycle).toLocaleString()}`}
                  </button>

                  <div className="text-center mt-3">
                    <button
                      type="button"
                      onClick={() => setModalScale('multi')}
                      className="text-[12px] text-[var(--color-teal)] font-semibold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Need multiple branches instead? Switch to Growth Plan →
                    </button>
                  </div>
                </div>
              )}

              {/* ─── MULTI BRANCH: GROWTH PLAN CARD ONLY ─── */}
              {modalScale === 'multi' && (
                <div className="border-2 border-[var(--color-gold)] rounded-2xl p-5 bg-[var(--color-gold-pale)]/30 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-gold)] text-white px-2 py-0.5 rounded-full">Multi Branch</span>
                      <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mt-1">Growth Plan</h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[20px] font-bold text-[var(--color-gold)]">KES {(1499 * paymentCycle).toLocaleString()}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">KES 1,499 / month</div>
                    </div>
                  </div>
                  <ul className="text-[13px] text-[var(--color-slate)] space-y-2 mb-4">
                    <li className="flex items-center gap-2">✅ <strong>3 Branches</strong> (Main Branch + Branch 2 + Branch 3)</li>
                    <li className="flex items-center gap-2">✅ <strong>Up to 4 Staff accounts</strong> with branch assignment</li>
                    <li className="flex items-center gap-2">✅ <strong>Multi-branch analytics & comparative reports</strong></li>
                    <li className="flex items-center gap-2">✅ <strong>Independent branch inventories & POS</strong></li>
                    <li className="flex items-center gap-2">✅ <strong>Priority support & PDF export</strong></li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('PRO')}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-3 bg-[var(--color-gold)] rounded-xl font-bold text-[14px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {checkingOutPlan === 'PRO' ? 'Processing Checkout...' : `Proceed to Pay KES ${(1499 * paymentCycle).toLocaleString()}`}
                  </button>

                  <div className="text-center mt-3">
                    <button
                      type="button"
                      onClick={() => setModalScale('single')}
                      className="text-[12px] text-[var(--color-slate)] font-semibold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Need a single shop plan instead? Switch to Starter Plan →
                    </button>
                  </div>
                </div>
              )}
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
