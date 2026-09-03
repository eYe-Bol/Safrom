'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';
import { calculateAnnualPrice, getMonthlyEquivalent, PlanCategory } from '@/utils/pricing';

type UserData = {
  id: string;
  store_name: string | null;
  created_at: string;
  subscription_plan: string | null;
  subscription_end_date: string | null;
  scale: string | null;
};

export default function BillingPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<PlanCategory>('single');
  const [branchCount, setBranchCount] = useState<number>(2);
  const [storeCount, setStoreCount] = useState<number>(2);
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          setUserData(data as UserData);
          if (data.scale === 'multi') {
            setSelectedTier('branch');
          }
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const currentOutlets = selectedTier === 'single' ? 1 : (selectedTier === 'branch' ? branchCount : storeCount);
  const totalAmount = calculateAnnualPrice(selectedTier, currentOutlets);
  const monthlyEquivalent = getMonthlyEquivalent(totalAmount);

  const trialEnd = userData
    ? new Date(new Date(userData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const daysSinceExpiry = trialEnd
    ? Math.max(0, Math.floor((Date.now() - trialEnd.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleCheckout = async () => {
    if (!userData?.id || !userEmail) {
      fire('Unable to start checkout — missing account info.');
      return;
    }
    setCheckingOut(true);
    try {
      const planCode = selectedTier === 'single' ? 'BASIC' : (selectedTier === 'branch' ? 'MULTI_BRANCH' : 'MULTI_STORE');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: userData.id,
          plan: planCode,
          months: 12,
          amount: totalAmount,
          outlets: currentOutlets,
          isAddon: false,
          email: userEmail,
          name: userData.store_name || 'SFS User',
        }),
      });
      const data = await res.json() as { url?: string; error?: string; details?: unknown };
      if (data.url) {
        window.location.href = data.url;
      } else {
        fire('Checkout error: ' + (data.details ? JSON.stringify(data.details) : data.error));
        setCheckingOut(false);
      }
    } catch {
      fire('Failed to start checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-canvas)] flex items-center justify-center">
        <div className="text-[14px] text-[var(--color-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)] flex flex-col items-center justify-center p-4 py-10">

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-lg border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="flex flex-col items-center mb-6 gap-2">
        <SFSLogo size={52} href="/portal/billing" />
        <div className="text-center">
          <div className="text-[11px] font-bold text-[var(--color-red)] uppercase tracking-wider mb-1">
            {daysSinceExpiry > 0
              ? `Trial expired ${daysSinceExpiry} day${daysSinceExpiry !== 1 ? 's' : ''} ago`
              : 'Trial period ended'}
          </div>
          <h1 className="font-serif text-[22px] font-bold text-[var(--color-ink)]">Activate Your Subscription</h1>
          <p className="text-[13px] text-[var(--color-muted)] mt-1">Subscribe to continue using Sales From Scratch</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-md w-full max-w-[480px] overflow-hidden">

        {/* ─── TIER SELECTION TABS ─── */}
        <div className="p-4 bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-white rounded-xl border border-[var(--color-line)]">
            <button
              type="button"
              onClick={() => setSelectedTier('single')}
              className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${selectedTier === 'single' ? 'bg-[var(--color-teal)] text-white shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              🏪 Single Store
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('branch')}
              className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${selectedTier === 'branch' ? 'bg-[var(--color-teal)] text-white shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              🏢 Multi-Branch
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('store')}
              className={`py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${selectedTier === 'store' ? 'bg-[var(--color-gold)] text-white shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              🏬 Multi-Store
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Header Description */}
          <div className="text-center">
            <h2 className="font-serif text-[19px] font-bold text-[var(--color-ink)]">
              {selectedTier === 'single' ? 'Single Store Starter Plan' : selectedTier === 'branch' ? 'Multi-Branch Chain Plan' : 'Multi-Store Diversified Plan'}
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
              {selectedTier === 'single'
                ? 'Tailored for 1 standalone business shop'
                : selectedTier === 'branch'
                ? 'Chain outlets with identical business type (Max 10 branches)'
                : 'Diverse business types e.g. Pub + Chemist (Max 4 stores)'}
            </p>
          </div>

          {/* Stepper for Multi-Branch / Multi-Store */}
          {selectedTier === 'branch' && (
            <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-[var(--color-slate)] uppercase">Total Branches</div>
                <div className="text-[11px] text-[var(--color-muted)]">+KES 6,000/yr per extra branch</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBranchCount(prev => Math.max(2, prev - 1))}
                  disabled={branchCount <= 2}
                  className="w-8 h-8 rounded-lg bg-white border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-[15px] text-[var(--color-ink)]">
                  {branchCount}
                </span>
                <button
                  type="button"
                  onClick={() => setBranchCount(prev => Math.min(10, prev + 1))}
                  disabled={branchCount >= 10}
                  className="w-8 h-8 rounded-lg bg-white border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {selectedTier === 'store' && (
            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-[var(--color-slate)] uppercase">Total Diverse Stores</div>
                <div className="text-[11px] text-amber-700 font-medium">Discounted: +KES 8,988/yr per store</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStoreCount(prev => Math.max(2, prev - 1))}
                  disabled={storeCount <= 2}
                  className="w-8 h-8 rounded-lg bg-white border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-[15px] text-[var(--color-ink)]">
                  {storeCount}
                </span>
                <button
                  type="button"
                  onClick={() => setStoreCount(prev => Math.min(4, prev + 1))}
                  disabled={storeCount >= 4}
                  className="w-8 h-8 rounded-lg bg-white border border-[var(--color-line)] font-bold text-[16px] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Pricing Summary Box */}
          <div className="border-2 border-[var(--color-teal)] rounded-xl p-4 flex flex-col gap-3 bg-[var(--color-teal-bg)]/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold bg-[var(--color-teal)] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {currentOutlets} {currentOutlets === 1 ? 'Location' : 'Locations'}
              </span>
              <div className="text-right">
                <div className="font-serif text-[22px] font-bold text-[var(--color-teal)]">
                  KES {totalAmount.toLocaleString()}
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  KES {monthlyEquivalent.toLocaleString()} / month (12 months)
                </div>
              </div>
            </div>

            <ul className="flex flex-col gap-1.5 text-[12px] text-[var(--color-slate)]">
              {selectedTier === 'single' ? (
                <>
                  <li className="flex items-center gap-2">✅ <strong>1 Store location</strong> (Main Branch)</li>
                  <li className="flex items-center gap-2">✅ <strong>1 Staff account</strong> included</li>
                  <li className="flex items-center gap-2">✅ <strong>Sales Tracker & POS checkout</strong></li>
                  <li className="flex items-center gap-2">✅ <strong>Product Catalogue with Excel import</strong></li>
                </>
              ) : selectedTier === 'branch' ? (
                <>
                  <li className="flex items-center gap-2">✅ <strong>{branchCount} Branches</strong> (Same business type)</li>
                  <li className="flex items-center gap-2">✅ <strong>Up to {branchCount * 2} Staff accounts</strong></li>
                  <li className="flex items-center gap-2">✅ <strong>1-Click Catalogue Sync</strong> between branches</li>
                  <li className="flex items-center gap-2">✅ <strong>Cross-branch comparative analytics</strong></li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2">✅ <strong>{storeCount} Diverse Store Types</strong> (e.g. Pub + Chemist)</li>
                  <li className="flex items-center gap-2">✅ <strong>Isolated catalogues</strong> & independent pricing</li>
                  <li className="flex items-center gap-2">✅ <strong>Up to {storeCount * 2} Staff accounts</strong></li>
                  <li className="flex items-center gap-2">✅ <strong>Centralized dashboard for all ventures</strong></li>
                </>
              )}
            </ul>

            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full mt-2 py-3 bg-[var(--color-teal)] text-white font-bold text-[15px] rounded-xl border-none cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm"
            >
              {checkingOut ? 'Redirecting to payment...' : `Proceed to Pay KES ${totalAmount.toLocaleString()}`}
            </button>
          </div>

          <div className="bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)] leading-relaxed">
            <strong className="text-[var(--color-slate)]">📋 Annual Subscription Terms:</strong><br />
            Subscribed outlets synchronize under one master account anniversary date. All active locations renew together annually.
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[13px] rounded-xl cursor-pointer hover:bg-[var(--color-line-lt)] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
