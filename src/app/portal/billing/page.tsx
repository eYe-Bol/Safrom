'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function BillingPage() {
  const [trialEnd, setTrialEnd] = useState<Date | null>(null);
  const [subStatus, setSubStatus] = useState<string>('trial');
  const [mpesaCode, setMpesaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          setTrialEnd(new Date(data.trial_end));
          setSubStatus(data.subscription_status);
        }
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: 'error', text: 'Not authenticated.' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      mpesa_code: mpesaCode,
      amount: 1499, // Assuming Pro plan for this phase
      status: 'pending'
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Transaction code submitted! Our team will review it shortly.' });
      setMpesaCode('');
    }
    setLoading(false);
  };

  const getDaysRemaining = () => {
    if (!trialEnd) return null;
    const diff = trialEnd.getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? days : 0;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div>
      <Topbar title="Billing & Subscription" />
      
      <div className="p-5 max-w-[800px] mx-auto">
        <div className="bg-white rounded-[16px] p-8 border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)]">
          
          <div className="flex items-center justify-between border-b border-[var(--color-line-lt)] pb-6 mb-6">
            <div>
              <h2 className="font-serif text-[22px] font-bold text-[var(--color-ink)] mb-1">Current Plan</h2>
              <p className="text-[14px] text-[var(--color-slate)]">Sales From Scratch Pro</p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-[var(--color-teal-bg)] text-[var(--color-teal)] px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-[0.08em] mb-2">
                {subStatus === 'trial' ? 'Trial Active' : subStatus}
              </div>
              {subStatus === 'trial' && daysRemaining !== null && (
                <div className="text-[13px] font-semibold text-[var(--color-amber)]">
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </div>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-3">Upgrade / Renew</h3>
            <p className="text-[14px] text-[var(--color-slate)] leading-[1.6] mb-4">
              To keep using Sales From Scratch, pay <strong>KES 1,499</strong> via M-Pesa to our Paybill number and enter the transaction code below.
            </p>
            <div className="bg-[var(--color-canvas)] p-4 rounded-[10px] border border-[var(--color-line)] flex flex-col gap-2 mb-6">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[var(--color-muted)] font-semibold uppercase tracking-[0.05em]">Paybill</span>
                <span className="font-mono font-bold text-[var(--color-ink)] text-[16px]">888888</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[var(--color-muted)] font-semibold uppercase tracking-[0.05em]">Account</span>
                <span className="font-mono font-bold text-[var(--color-ink)] text-[16px]">SFS-PRO</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
              <input 
                type="text" 
                value={mpesaCode}
                onChange={(e) => setMpesaCode(e.target.value)}
                placeholder="e.g. QAX9B2K1L"
                required
                className="flex-1 py-[10px] px-[14px] border-[1.5px] border-[var(--color-line)] rounded-[10px] text-[14px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)] font-mono uppercase transition-colors"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="py-[10px] px-[24px] bg-[var(--color-gold)] text-white border-none rounded-[10px] font-bold text-[14px] cursor-pointer hover:opacity-90 disabled:opacity-70 whitespace-nowrap"
              >
                {loading ? 'Submitting...' : 'Submit Code'}
              </button>
            </form>
            
            {message && (
              <div className={`mt-4 text-[13px] font-semibold py-[10px] px-[14px] rounded-[8px] ${message.type === 'success' ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : 'bg-[var(--color-red-bg)] text-[var(--color-red)]'}`}>
                {message.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
