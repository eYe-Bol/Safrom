'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push('/portal/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-teal)] flex flex-col items-center justify-center p-5">
      {/* Back to home */}
      <Link href="/" className="mb-6 text-white/70 hover:text-white text-[13px] font-semibold flex items-center gap-1 transition-colors">
        ← Back to home
      </Link>

      <div className="bg-white rounded-[20px] py-[36px] px-[30px] w-full max-w-[400px] shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center gap-3 mb-[28px]">
          <div className="text-center">
            <div className="font-serif text-[18px] font-bold text-[var(--color-teal)]">Sales From Scratch</div>
            <div className="text-[11px] text-[var(--color-muted)] mt-[2px]">Sign in to your account</div>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-[14px]">
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-[5px]">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full py-[10px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[9px] text-[14px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)] transition-colors"
            />
          </div>

          <div className="mb-[6px]">
            <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-[5px]">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full py-[10px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[9px] text-[14px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)] transition-colors"
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right mb-[14px]">
            <Link href="/forgot-password" className="text-[12px] text-[var(--color-teal)] font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="text-[12px] text-[var(--color-red)] mb-[12px] py-[8px] px-[12px] bg-[var(--color-red-bg)] rounded-[8px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-[12px] bg-[var(--color-teal)] text-white border-none rounded-[10px] font-bold text-[15px] cursor-pointer shadow-[0_4px_14px_rgba(10,92,107,0.27)] hover:opacity-90 transition-opacity disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4 text-[13px] text-[var(--color-muted)]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--color-teal)] font-bold hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
