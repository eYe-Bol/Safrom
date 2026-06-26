'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [paymentCycle, setPaymentCycle] = useState<4 | 8 | 12>(4);
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const storeId = userData?.id;

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
        setUser(authUser);
        const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (data) {
          setUserData(data);
          setStoreName(data.store_name || '');
        }
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('users').update({ 
      store_name: storeName,
      store_phone: userData?.store_phone,
      store_email: userData?.store_email
    }).eq('id', user.id);
    if (error) {
      fire(`Error: ${error.message}`);
    } else {
      setUserData((p: any) => ({...p, store_name: storeName, store_phone: userData?.store_phone, store_email: userData?.store_email}));
      fire('✓ Business profile updated!');
      window.location.reload(); // Force reload to update layout
    }
    setSaving(false);
    setEditMode(false);
  };

  const handleCheckout = async (plan: 'BASIC' | 'PRO') => {
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
          name: userData?.store_name
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        const errorMessage = data.details ? JSON.stringify(data.details) : data.error;
        fire('Checkout error: ' + errorMessage);
        console.error('Intasend error details:', data);
        setCheckingOutPlan(null);
      }
    } catch (err) {
      fire('Failed to start checkout');
      setCheckingOutPlan(null);
    }
  };

  const trialDaysLeft = userData?.trial_end
    ? Math.max(0, Math.ceil((new Date(userData.trial_end).getTime() - Date.now()) / (1000*60*60*24)))
    : null;

  return (
    <div className="flex flex-col min-h-screen pb-10">
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
                <input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store WhatsApp Number</label>
                <input value={userData?.store_phone || ''} onChange={e => setUserData({...userData, store_phone: e.target.value})} placeholder="e.g. +254700000000" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Store Email</label>
                <input value={userData?.store_email || ''} onChange={e => setUserData({...userData, store_email: e.target.value})} placeholder="store@example.com" className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditMode(false)} className="flex-1 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg font-semibold text-[13px] text-[var(--color-slate)]">Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-2 bg-[var(--color-teal)] text-white rounded-lg font-bold text-[13px] disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
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
              <button onClick={() => setEditMode(true)} className="mt-4 px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[13px] rounded-lg hover:opacity-90">
                Edit Profile
              </button>
            </>
          )}
        </div>

        {/* Plan & Upgrades */}
        <div className="md:col-span-2 bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Plan & Upgrades (Staff & Branches)</h2>
            <button onClick={() => setShowUpgrade(true)} className="px-3 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg text-[12px] font-semibold text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] cursor-pointer">
              Upgrade Plan 🚀
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

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[520px] shadow-[0_24px_64px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-[36px] mb-2">🚀</div>
              <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)]">Upgrade Your Plan</h2>
              {userData?.subscription_plan ? (
                <p className="text-[13px] text-[var(--color-muted)] mt-1">
                  Current plan: <strong className="text-[var(--color-teal)]">KES {userData.subscription_plan}/mo</strong>
                </p>
              ) : (
                <p className="text-[13px] text-[var(--color-muted)] mt-1">
                  You're on the <strong className="text-[var(--color-gold)]">Free Trial</strong>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 mb-5">
              
              <div className="flex flex-col mb-2">
                <label className="text-[12px] font-bold text-[var(--color-slate)] mb-1">Select Payment Cycle</label>
                <select 
                  value={paymentCycle} 
                  onChange={e => setPaymentCycle(parseInt(e.target.value) as 4 | 8 | 12)}
                  className="w-full px-3 py-2 border border-[var(--color-teal)] rounded-lg text-[14px] outline-none"
                >
                  <option value={4}>4 Months</option>
                  <option value={8}>8 Months</option>
                  <option value={12}>12 Months</option>
                </select>
              </div>

              {/* Plan 999 */}
              {userData?.subscription_plan !== '999' && userData?.subscription_plan !== 'basic' && userData?.subscription_plan !== '1499' && userData?.subscription_plan !== 'pro' && (
                <div className="border-2 border-[var(--color-teal)]/30 rounded-xl p-4 bg-[var(--color-teal-bg)]/30">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Starter Plan</h3>
                    <div className="text-right">
                      <div className="font-serif text-[18px] font-bold text-[var(--color-teal)]">KES {(999 * paymentCycle).toLocaleString()}</div>
                      <div className="text-[11px] font-normal text-[var(--color-muted)]">for {paymentCycle} months (KES 999/mo)</div>
                    </div>
                  </div>
                  <ul className="text-[12px] text-[var(--color-slate)] space-y-1.5 mb-3">
                    <li>✅ 1 Branch (Main Branch)</li>
                    <li>✅ 1 Staff account</li>
                    <li>✅ Full dashboard & reports</li>
                    <li>✅ Sales tracker & inventory</li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('BASIC')}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-2.5 bg-[var(--color-teal)] rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {checkingOutPlan === 'BASIC' ? 'Loading...' : 'Proceed to Payment'}
                  </button>
                </div>
              )}

              {/* Plan 1499 */}
              {userData?.subscription_plan !== '1499' && userData?.subscription_plan !== 'pro' && (
                <div className="border-2 border-[var(--color-gold)]/30 rounded-xl p-4 bg-[var(--color-gold-pale)]/30">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Growth Plan</h3>
                      {(userData?.subscription_plan === '999' || userData?.subscription_plan === 'basic') && (
                        <span className="text-[10px] font-bold text-[var(--color-gold)] bg-[var(--color-gold-pale)] px-2 py-0.5 rounded-full uppercase tracking-wider">Recommended Upgrade</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[18px] font-bold text-[var(--color-gold)]">KES {(1499 * paymentCycle).toLocaleString()}</div>
                      <div className="text-[11px] font-normal text-[var(--color-muted)]">for {paymentCycle} months (KES 1499/mo)</div>
                    </div>
                  </div>
                  <ul className="text-[12px] text-[var(--color-slate)] space-y-1.5 mb-3">
                    <li>✅ 3 Branches (Main + 2 extra)</li>
                    <li>✅ Up to 4 Staff accounts</li>
                    <li>✅ Full dashboard & reports</li>
                    <li>✅ Multi-branch analytics</li>
                    <li>✅ Priority support</li>
                  </ul>
                  <button
                    onClick={() => handleCheckout('PRO')}
                    disabled={checkingOutPlan !== null}
                    className="block w-full py-2.5 bg-[var(--color-gold)] rounded-xl font-bold text-[13px] text-white text-center hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {checkingOutPlan === 'PRO' ? 'Loading...' : 'Proceed to Payment'}
                  </button>
                </div>
              )}

              {/* Already on highest plan */}
              {(userData?.subscription_plan === '1499' || userData?.subscription_plan === 'pro') && (
                <div className="border-2 border-[var(--color-emerald)]/30 rounded-xl p-4 bg-[var(--color-emerald-bg)] text-center">
                  <div className="text-[28px] mb-2">🎉</div>
                  <h3 className="font-serif text-[16px] font-bold text-[var(--color-emerald)]">You're on the Growth Plan!</h3>
                  <p className="text-[13px] text-[var(--color-slate)] mt-1">You have access to all features including 3 branches and 4 staff accounts.</p>
                </div>
              )}
            </div>

            <button onClick={() => setShowUpgrade(false)} disabled={checkingOutPlan !== null} className="w-full py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)] hover:bg-gray-50 transition-colors disabled:opacity-50">
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
