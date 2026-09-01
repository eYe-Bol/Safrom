'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SFSBadge } from '@/components/SFSBadge';
import { createClient } from '@/utils/supabase/client';
import ProperCaseInput from '@/components/ProperCaseInput';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', scale: 'single' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          scale: form.scale,
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      setDone(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-teal)] flex items-center justify-center p-5">
      <div className="bg-white rounded-[20px] py-[36px] px-[30px] w-full max-w-[440px] shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-[14px] mb-[24px]">
          <img src="/logo.png" alt="Sales From Scratch Logo" className="w-12 h-12 object-contain" />
          <div className="font-serif text-[18px] font-bold text-[var(--color-teal)]">
            Sales From Scratch
          </div>
        </div>

        {done ? (
          <div className="text-center py-5">
            <div className="text-[40px] mb-3">🎉</div>
            <div className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-2">
              You're all set!
            </div>
            <p className="text-[14px] text-[var(--color-muted)] leading-[1.7] mb-5">
              Your 7-day free trial has started. Please verify your email if required, or sign in.
            </p>
            <Link href="/login" className="px-[28px] py-[11px] bg-[var(--color-teal)] text-white border-none rounded-[10px] font-bold text-[14px] cursor-pointer hover:opacity-90 inline-block">
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-[18px]">
              Create your account
            </div>
            
            <div className="mb-[12px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Full Name</label>
              <ProperCaseInput value={form.name} onChange={v => setForm({...form, name: v})} required className="w-full py-[9px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]" />
            </div>

            <div className="mb-[12px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Email Address</label>
              <input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required className="w-full py-[9px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]" />
            </div>

            <div className="mb-[18px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-1">Password</label>
              <input type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} required minLength={6} className="w-full py-[9px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none text-[var(--color-ink)] focus:border-[var(--color-teal)]" />
            </div>

            <div className="mb-[24px]">
              <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-2">Business Scale</label>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setForm({...form, scale: 'single'})}
                  className={`flex-1 py-3 px-2 border-2 rounded-[10px] text-center transition-all ${form.scale === 'single' ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold' : 'border-[var(--color-line-lt)] text-[var(--color-slate)] font-semibold hover:border-[var(--color-line)]'}`}
                >
                  <div className="text-[18px] mb-1">🏪</div>
                  <div className="text-[12px]">Single Store</div>
                </button>
                <button 
                  type="button" 
                  onClick={() => setForm({...form, scale: 'multi'})}
                  className={`flex-1 py-3 px-2 border-2 rounded-[10px] text-center transition-all ${form.scale === 'multi' ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-bold' : 'border-[var(--color-line-lt)] text-[var(--color-slate)] font-semibold hover:border-[var(--color-line)]'}`}
                >
                  <div className="text-[18px] mb-1">🏬</div>
                  <div className="text-[12px]">Multi Branch</div>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-[var(--color-red)] mb-[12px] py-[8px] px-[12px] bg-[var(--color-red-bg)] rounded-[8px]">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full p-[12px] bg-[var(--color-gold)] text-white border-none rounded-[10px] font-bold text-[15px] cursor-pointer hover:opacity-90 disabled:opacity-70">
              {loading ? 'Creating...' : 'Start 7-Day Free Trial'}
            </button>

            <div className="text-center mt-[14px] text-[13px] text-[var(--color-muted)]">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--color-teal)] font-bold bg-none border-none cursor-pointer text-[13px] hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
