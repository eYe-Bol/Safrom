'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SFSLogo } from '@/components/SFSLogo';
import { createClient } from '@/utils/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-teal)] flex flex-col items-center justify-center p-5">
      <div className="bg-white rounded-[20px] py-[36px] px-[30px] w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center gap-3 mb-[24px]">
          <SFSLogo size={64} />
          <div className="text-center">
            <div className="font-serif text-[18px] font-bold text-[var(--color-teal)]">Set New Password</div>
            <div className="text-[11px] text-[var(--color-muted)] mt-[2px]">Choose a strong password</div>
          </div>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="text-[40px] mb-3">🎉</div>
            <div className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-2">Password updated!</div>
            <p className="text-[13px] text-[var(--color-muted)]">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="mb-[14px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-[5px]">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full py-[10px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[9px] text-[14px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)] transition-colors"
              />
            </div>
            <div className="mb-[14px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-[5px]">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full py-[10px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[9px] text-[14px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)] transition-colors"
              />
            </div>

            {error && (
              <div className="text-[12px] text-[var(--color-red)] mb-[12px] py-[8px] px-[12px] bg-[var(--color-red-bg)] rounded-[8px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-[12px] bg-[var(--color-teal)] text-white border-none rounded-[10px] font-bold text-[15px] hover:opacity-90 disabled:opacity-70 transition-opacity"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
