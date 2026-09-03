'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';
import { calculateAnnualPrice, getMonthlyEquivalent, PlanCategory } from '@/utils/pricing';

type UserData = {
  id: string;
  store_name: string | null;
  business_type: string | null;
  created_at: string;
  subscription_plan: string | null;
  subscription_end_date: string | null;
  scale: string | null;
};

type BranchProfileRow = {
  branch_name: string;
  business_type: string | null;
  branch_display_name: string | null;
};

export default function BillingPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  // Auto-detected outlet state
  const [detectedOutlets, setDetectedOutlets] = useState<BranchProfileRow[]>([]);
  const [detectedTier, setDetectedTier] = useState<PlanCategory>('single');
  const [detectedCount, setDetectedCount] = useState<number>(1);
  const [targetOutlets, setTargetOutlets] = useState<number>(1);
  const [dropMode, setDropMode] = useState(false);
  const [dropConfirm, setDropConfirm] = useState<string | null>(null);
  const [droppingOutlet, setDroppingOutlet] = useState(false);

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const handleExecuteDropOutlet = async (branchNameToDrop: string) => {
    if (!branchNameToDrop || branchNameToDrop === 'Main Branch') return;
    if (!userData?.id) return;

    setDroppingOutlet(true);
    const supabase = createClient();

    // 1. Delete from branch_profiles
    const { error: delError } = await supabase
      .from('branch_profiles')
      .delete()
      .eq('owner_id', userData.id)
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
    }
    await supabase.from('users').update(updates).eq('id', userData.id);

    // 3. Update local state
    const remainingOutlets = detectedOutlets.filter(o => o.branch_name !== branchNameToDrop);
    const uniqueTypes = new Set(remainingOutlets.map(b => b.business_type || 'retail_store'));
    const isMultiStore = uniqueTypes.size > 1;
    const newCat: PlanCategory = remainingOutlets.length <= 1 ? 'single' : (isMultiStore ? 'store' : 'branch');

    setDetectedOutlets(remainingOutlets);
    setDetectedCount(remainingOutlets.length);
    setTargetOutlets(remainingOutlets.length);
    setDetectedTier(newCat);
    setDropConfirm(null);
    setDropMode(false);
    setDroppingOutlet(false);
    fire(`Outlet "${branchNameToDrop}" removed. Plan updated!`);
  };

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          const typed = data as UserData;
          setUserData(typed);

          // Auto-detect branch_profiles
          const { data: profiles } = await supabase
            .from('branch_profiles')
            .select('branch_name, business_type, branch_display_name')
            .eq('owner_id', user.id);

          const rows = (profiles as BranchProfileRow[] | null) || [];
          const hasMB = rows.some(r => r.branch_name === 'Main Branch');
          const allBranches: BranchProfileRow[] = hasMB
            ? rows
            : [{ branch_name: 'Main Branch', business_type: typed.business_type || null, branch_display_name: typed.store_name || 'Main Branch' }, ...rows];

          const count = allBranches.length;
          const uniqueTypes = new Set(allBranches.map(b => b.business_type || 'retail_store'));
          const isMultiStore = uniqueTypes.size > 1;

          let category: PlanCategory = 'single';
          if (count >= 2) {
            category = isMultiStore ? 'store' : 'branch';
          }

          setDetectedOutlets(allBranches);
          setDetectedTier(category);
          setDetectedCount(count);
          setTargetOutlets(count);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const trialEnd = userData
    ? new Date(new Date(userData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const daysSinceExpiry = trialEnd
    ? Math.max(0, Math.floor((Date.now() - trialEnd.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const effectiveCount = dropMode && dropConfirm ? detectedCount - 1 : targetOutlets;
  const finalCategory: PlanCategory = effectiveCount === 1 ? 'single' : detectedTier;
  const totalAmount = calculateAnnualPrice(finalCategory, effectiveCount);
  const monthlyEquivalent = getMonthlyEquivalent(totalAmount);
  const isExpanding = targetOutlets > detectedCount;
  const isDroppingPlan = dropMode && !!dropConfirm && effectiveCount < detectedCount;

  const handleCheckout = async () => {
    if (!userData?.id || !userEmail) {
      fire('Unable to start checkout â€” missing account info.');
      return;
    }
    setCheckingOut(true);
    try {
      const planCode = finalCategory === 'single' ? 'BASIC' : (finalCategory === 'branch' ? 'MULTI_BRANCH' : 'MULTI_STORE');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: userData.id,
          plan: planCode,
          months: 12,
          amount: totalAmount,
          outlets: effectiveCount,
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[var(--color-teal)] border-t-transparent animate-spin" />
          <p className="text-[13px] text-[var(--color-muted)]">Loading your accountâ€¦</p>
        </div>
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
          <p className="text-[13px] text-[var(--color-muted)] mt-1">
            {detectedCount > 1
              ? `We found ${detectedCount} registered outlets on your account`
              : 'Subscribe to continue using Sales From Scratch'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-md w-full max-w-[480px] overflow-hidden">

        {/* â”€â”€â”€ Auto-detected Plan Header â”€â”€â”€ */}
        <div className="p-4 bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)] flex items-center gap-3">
          <div className="text-[28px]">
            {detectedTier === 'single' ? 'ðŸª' : detectedTier === 'branch' ? 'ðŸ¢' : 'ðŸ¬'}
          </div>
          <div>
            <div className="font-serif text-[15px] font-bold text-[var(--color-ink)]">
              {detectedTier === 'single' ? 'Single Store Plan' : detectedTier === 'branch' ? 'Multi-Branch Chain Plan' : 'Multi-Store Diversified Plan'}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              {detectedCount === 1 ? 'Auto-detected: 1 outlet registered' : `Auto-detected: ${detectedCount} outlets registered`}
              {' Â· '}
              <span className="font-bold text-[var(--color-teal)]">Plan matched automatically</span>
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* â”€â”€â”€ Detected Outlets List â”€â”€â”€ */}
          <div className="bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)] divide-y divide-[var(--color-line-lt)] overflow-hidden">
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                Your Registered Outlets ({detectedCount})
              </span>
              <div className="flex items-center gap-1.5">
                {!dropMode && detectedCount < (detectedTier === 'store' ? 4 : 10) && (
                  <button type="button" onClick={() => setTargetOutlets(detectedCount + 1)}
                    className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2 py-1 rounded-lg hover:opacity-80 cursor-pointer">
                    + Add
                  </button>
                )}
                {!dropMode && detectedCount > 1 && (
                  <button type="button" onClick={() => { setDropMode(true); setTargetOutlets(detectedCount); }}
                    className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg hover:opacity-80 cursor-pointer">
                    − Drop
                  </button>
                )}
                {dropMode && (
                  <button type="button" onClick={() => { setDropMode(false); setDropConfirm(null); setTargetOutlets(detectedCount); }}
                    className="text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {detectedOutlets.map((outlet, idx) => {
              const displayName = outlet.branch_display_name || (outlet.branch_name === 'Main Branch' ? (userData?.store_name || 'Main Store') : outlet.branch_name);
              const isMain = outlet.branch_name === 'Main Branch';
              const isMarkedDrop = dropConfirm === outlet.branch_name;

              return (
                <div key={outlet.branch_name} className={`px-4 py-3 flex items-center justify-between ${isMarkedDrop ? 'bg-red-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[16px] ${isMain ? 'bg-[var(--color-teal-bg)]' : 'bg-white border border-[var(--color-line-lt)]'}`}>
                      {isMain ? '🏪' : idx % 2 === 0 ? '🏢' : '🏬'}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[var(--color-ink)]">{displayName}</div>
                      <div className="text-[11px] text-[var(--color-muted)] flex items-center gap-1">
                        {outlet.branch_name}
                        {isMain && <span className="text-[9px] font-bold bg-[var(--color-teal)] text-white px-1.5 py-0.2 rounded-full">PRIMARY</span>}
                      </div>
                    </div>
                  </div>
                  {dropMode && !isMain && (
                    <button type="button" onClick={() => setDropConfirm(isMarkedDrop ? null : outlet.branch_name)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${isMarkedDrop ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                      {isMarkedDrop ? '✓ Selected' : 'Select to Drop'}
                    </button>
                  )}
                  {dropMode && isMain && <span className="text-[10px] text-[var(--color-muted)] italic">Cannot drop</span>}
                </div>
              );
            })}

            {/* Adding outlet preview row */}
            {targetOutlets > detectedCount && (
              <div className="px-4 py-3 flex items-center gap-3 bg-[var(--color-teal-bg)]/30 border-t-2 border-dashed border-[var(--color-teal)]">
                <div className="w-8 h-8 rounded-full bg-[var(--color-teal-bg)] border-2 border-dashed border-[var(--color-teal)] flex items-center justify-center text-[var(--color-teal)] font-bold">+</div>
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-teal)]">New Outlet (to be added)</div>
                  <div className="text-[11px] text-[var(--color-muted)]">
                    {detectedTier === 'branch' ? '+KES 6,000/yr (same business type)' : '+KES 8,988/yr (diversified store type)'}
                  </div>
                </div>
                <button type="button" onClick={() => setTargetOutlets(detectedCount)} className="ml-auto text-[18px] text-[var(--color-muted)] hover:text-red-400 cursor-pointer">×</button>
              </div>
            )}
          </div>

          {/* Drop warning */}
          {dropMode && dropConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-[12px] text-red-700 leading-relaxed">
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

          {/* ─── Pricing Summary Box ─── */}
          <div className={`border-2 ${isDroppingPlan ? 'border-red-300 bg-red-50/20' : 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]/20'} rounded-xl p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-white ${isDroppingPlan ? 'bg-red-400' : 'bg-[var(--color-teal)]'}`}>
                {effectiveCount} {effectiveCount === 1 ? 'Location' : 'Locations'}
                {isExpanding && ' (after adding)'}
                {isDroppingPlan && ' (after dropping)'}
              </span>
              <div className="text-right">
                <div className="font-serif text-[22px] font-bold text-[var(--color-teal)]">KES {totalAmount.toLocaleString()}</div>
                <div className="text-[11px] text-[var(--color-muted)]">KES {monthlyEquivalent.toLocaleString()} / month (12 months)</div>
              </div>
            </div>

            <ul className="flex flex-col gap-1.5 text-[12px] text-[var(--color-slate)]">
              <li className="flex items-center gap-2">✅ <strong>{effectiveCount} {effectiveCount === 1 ? 'Store location' : 'Active outlets'}</strong> included</li>
              <li className="flex items-center gap-2">✅ <strong>Up to {Math.max(1, effectiveCount) * 2} Staff accounts</strong> assignable</li>
              {finalCategory !== 'single' && <li className="flex items-center gap-2">✅ <strong>Centralized dashboard</strong> with per-outlet analytics</li>}
              {finalCategory === 'branch' && <li className="flex items-center gap-2">✅ <strong>1-Click Catalogue Sync</strong> between branches</li>}
              {finalCategory === 'store' && <li className="flex items-center gap-2">✅ <strong>Isolated catalogues</strong> &amp; independent pricing per store</li>}
            </ul>

            <button onClick={handleCheckout} disabled={checkingOut}
              className={`w-full mt-1 py-3 text-white font-bold text-[15px] rounded-xl border-none cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm ${isDroppingPlan ? 'bg-red-500' : 'bg-[var(--color-teal)]'}`}>
              {checkingOut
                ? 'Redirecting to payment…'
                : isDroppingPlan
                ? `Subscribe with ${effectiveCount} outlet${effectiveCount !== 1 ? 's' : ''} — KES ${totalAmount.toLocaleString()}`
                : isExpanding
                ? `Add Outlet & Subscribe — KES ${totalAmount.toLocaleString()}`
                : `Subscribe Now — KES ${totalAmount.toLocaleString()}`}
            </button>
          </div>

          <div className="bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-line-lt)] text-[11px] text-[var(--color-muted)] leading-relaxed">
            <strong className="text-[var(--color-slate)]">📋 Annual Subscription Terms:</strong><br />
            Subscribed outlets synchronize under one master account anniversary date. All active locations renew together annually.
          </div>

          <button onClick={handleSignOut}
            className="w-full py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[13px] rounded-xl cursor-pointer hover:bg-[var(--color-line-lt)] transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}


