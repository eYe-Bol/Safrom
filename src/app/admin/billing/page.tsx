'use client';

import { Topbar } from '@/components/Topbar';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

type Subscription = {
  id: string;
  user_id: string;
  mpesa_code: string;
  status: string;
  amount: number;
  created_at: string;
  users: {
    email: string;
  };
};

export default function AdminBillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('subscriptions')
      .select('*, users(email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) setSubscriptions(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleAction = async (id: string, userId: string, action: 'approved' | 'rejected') => {
    const supabase = createClient();
    
    // Update subscription status
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({ status: action })
      .eq('id', id);

    if (action === 'approved' && !subError) {
      // Extend trial_end by 30 days and set status to active
      const { data: user } = await supabase.from('users').select('trial_end').eq('id', userId).single();
      const currentEnd = user?.trial_end ? new Date(user.trial_end) : new Date();
      const newEnd = new Date(Math.max(currentEnd.getTime(), new Date().getTime()));
      newEnd.setDate(newEnd.getDate() + 30); // Add 30 days
      
      await supabase.from('users').update({
        subscription_status: 'active',
        trial_end: newEnd.toISOString()
      }).eq('id', userId);
    }

    fetchSubscriptions();
  };

  return (
    <div>
      <Topbar title="Admin Subscriptions" sub="Pending M-Pesa Approvals" />
      
      <div className="p-5 max-w-[1000px] mx-auto">
        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-[0_1px_4px_rgba(10,92,107,0.06)] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)] text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-[0.05em]">
                <th className="p-4">Date</th>
                <th className="p-4">User</th>
                <th className="p-4">M-Pesa Code</th>
                <th className="p-4">Amount</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-4 text-center text-[14px] text-[var(--color-muted)]">Loading...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-[14px] text-[var(--color-muted)]">No pending subscriptions.</td></tr>
              ) : (
                subscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-[var(--color-line-lt)] hover:bg-[var(--color-teal-bg)] transition-colors">
                    <td className="p-4 text-[13px] text-[var(--color-slate)]">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-[14px] font-semibold text-[var(--color-ink)]">
                      {sub.users?.email}
                    </td>
                    <td className="p-4 text-[14px] font-mono font-bold text-[var(--color-ink)]">
                      {sub.mpesa_code}
                    </td>
                    <td className="p-4 text-[14px] text-[var(--color-ink)]">
                      KES {sub.amount}
                    </td>
                    <td className="p-4 flex gap-2 justify-end">
                      <button onClick={() => handleAction(sub.id, sub.user_id, 'approved')} className="px-3 py-1.5 bg-[var(--color-emerald)] text-white text-[12px] font-bold rounded-lg hover:opacity-90">
                        Approve
                      </button>
                      <button onClick={() => handleAction(sub.id, sub.user_id, 'rejected')} className="px-3 py-1.5 bg-[var(--color-red)] text-white text-[12px] font-bold rounded-lg hover:opacity-90">
                        Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
