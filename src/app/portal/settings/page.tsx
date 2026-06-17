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

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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
        <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)]">
          <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-4">Plan & Upgrades</h2>
          {[
            {label:'Add Branch', icon:'🏪', desc:'Open a new location'},
            {label:'Upgrade Plan', icon:'🚀', desc:'More branches & users'},
          ].map(a => (
            <div key={a.label} className="flex justify-between items-center p-3.5 border border-[var(--color-line-lt)] rounded-xl mb-2.5">
              <div className="flex gap-2.5 items-center">
                <span className="text-[20px]">{a.icon}</span>
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-ink)]">{a.label}</div>
                  <div className="text-[11px] text-[var(--color-muted)]">{a.desc}</div>
                </div>
              </div>
              <button onClick={() => setShowUpgrade(true)} className="px-3 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg text-[12px] font-semibold text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] cursor-pointer">
                Go →
              </button>
            </div>
          ))}
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
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] text-center" onClick={e => e.stopPropagation()}>
            <div className="text-[36px] mb-3">🚀</div>
            <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)] mb-2">Upgrade Your Plan</h2>
            <p className="text-[14px] text-[var(--color-muted)] leading-[1.7] mb-6">
              Contact our team to upgrade instantly and unlock more branches and users.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowUpgrade(false)} className="flex-1 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl font-semibold text-[14px] text-[var(--color-slate)]">Maybe Later</button>
              <a href="https://wa.me/254716630073" target="_blank" rel="noreferrer"
                className="flex-1 py-2.5 bg-[var(--color-teal)] rounded-xl font-bold text-[14px] text-white text-center">
                💬 Contact Sales
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
