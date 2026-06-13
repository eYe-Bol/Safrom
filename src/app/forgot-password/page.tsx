'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SFSLogo } from '@/components/SFSLogo';
import { createClient } from '@/utils/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-teal)] flex flex-col items-center justify-center p-5">
      <Link href="/login" className="mb-6 text-white/70 hover:text-white text-[13px] font-semibold flex items-center gap-1 transition-colors">
        ← Back to Sign In
      </Link>

      <div className="bg-white rounded-[20px] py-[36px] px-[30px] w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center gap-3 mb-[24px]">
          <SFSLogo size={64} />
          <div className="text-center">
            <div className="font-serif text-[18px] font-bold text-[var(--color-teal)]">Reset Password</div>
            <div className="text-[11px] text-[var(--color-muted)] mt-[2px]">We&apos;ll send a reset link to your email</div>
          </div>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="text-[40px] mb-3">📬</div>
            <div className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-2">Check your inbox</div>
            <p className="text-[13px] text-[var(--color-muted)] leading-[1.7]">
              We sent a password reset link to <strong>{email}</strong>. Follow the link to set a new password.
            </p>
            <Link href="/login" className="inline-block mt-5 px-6 py-2.5 bg-[var(--color-teal)] text-white rounded-[10px] font-bold text-[14px] hover:opacity-90">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-[14px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-[5px]">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
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
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
