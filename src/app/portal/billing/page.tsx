'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';

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
  const [paymentCycle, setPaymentCycle] = useState<6 | 12>(12);
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
        if (data) setUserData(data as UserData);
      }
      setLoading(false);
    };
    load();
  }, []);

  const userScale = userData?.scale || 'single';
  const isMulti = userScale === 'multi';
  const plan = isMulti ? 'PRO' : 'BASIC';
  const monthlyRate = isMulti ? 1499 : 999;
  const planLabel = isMulti ? 'Growth Plan' : 'Starter Plan';
  const planScale = isMulti ? 'Multi Branch' : 'Single Store';
  const planEmoji = isMulti ? '🏢' : '🏪';
  const planDesc = isMulti
    ? 'Manage multiple branches with one account'
    : 'Complete business operations tailored for 1 single shop';
  const planFeatures = isMulti
    ? ['Unlimited branches', 'Staff per branch', 'Full dashboard & reporting', 'Sales Tracker & POS checkout', 'Product Catalogue with Excel import', 'Multi-branch analytics']
    : ['1 Branch (Main Branch)', '1 Staff account included', 'Full dashboard & reporting', 'Sales Tracker & POS checkout', 'Product Catalogue with Excel import'];

  const totalAmount = monthlyRate * paymentCycle;

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
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: userData.id,
          plan,
          months: paymentCycle,
          amount: totalAmount,
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

  const switchScale = async (to: 'single' | 'multi') => {
    if (!userData?.id) return;
    const supabase = createClient();
    await supabase.from('users').update({ scale: to }).eq('id', userData.id);
    setUserData(prev => prev ? { ...prev, scale: to } : prev);
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

      <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-md w-full max-w-[420px] overflow-hidden">

        <div className="p-6 border-b border-[var(--color-line-lt)] text-center">
          <div className="text-[40px] mb-2">{planEmoji}</div>
          <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">{planScale} {planLabel}</h2>
          <p className="text-[13px] text-[var(--color-muted)] mt-1">{planDesc}</p>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-2">
              Select Payment Cycle
            </label>
            <select
              value={paymentCycle}
              onChange={e => setPaymentCycle(Number(e.target.value) as 6 | 12)}
              className="w-full px-4 py-2.5 border-[1.5px] border-[var(--color-line)] rounded-xl text-[14px] font-medium text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] bg-white cursor-pointer"
            >
              <option value={6}>6 Months</option>
              <option value={12}>12 Months (Full annual coverage)</option>
            </select>
          </div>

          <div className="border-[2px] border-[var(--color-teal)] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold bg-[var(--color-teal)] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {planScale}
              </span>
              <div className="text-right">
                <div className="font-serif text-[22px] font-bold text-[var(--color-teal)]">
                  KES {totalAmount.toLocaleString()}
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  KES {monthlyRate.toLocaleString()} / month
                </div>
              </div>
            </div>
            <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">{planLabel}</div>
            <ul className="flex flex-col gap-1.5">
              {planFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--color-slate)]">
                  <span className="text-[var(--color-teal)] mt-0.5 shrink-0">✅</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full mt-2 py-3 bg-[var(--color-teal)] text-white font-bold text-[15px] rounded-xl border-none cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm"
            >
              {checkingOut ? 'Redirecting to payment...' : `Proceed to Pay KES ${totalAmount.toLocaleString()}`}
            </button>

            {!isMulti ? (
              <p className="text-center text-[12px] text-[var(--color-teal)] font-semibold">
                Need multiple branches instead?{' '}
                <button onClick={() => switchScale('multi')} className="underline cursor-pointer bg-transparent border-none text-[var(--color-teal)] font-semibold">
                  Switch to Growth Plan &rarr;
                </button>
              </p>
            ) : (
              <p className="text-center text-[12px] text-[var(--color-teal)] font-semibold">
                Only need one store?{' '}
                <button onClick={() => switchScale('single')} className="underline cursor-pointer bg-transparent border-none text-[var(--color-teal)] font-semibold">
                  Switch to Starter Plan &rarr;
                </button>
              </p>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-[var(--color-canvas)] border border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[14px] rounded-xl cursor-pointer hover:bg-[var(--color-line-lt)] transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
