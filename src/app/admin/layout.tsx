'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SFSLogo } from '@/components/SFSLogo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const NAV_ITEMS = [
    { href: '/admin/users', label: 'Users & Subscriptions', icon: '👥' },
    { href: '/admin/billing', label: 'Pending Approvals', icon: '💳' },
  ];

  useEffect(() => {
    // Check if admin session is already unlocked in this browser tab
    const token = sessionStorage.getItem('sfs_admin_token');
    if (token) {
      setIsUnlocked(true);
    }
    setLoading(false);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setVerifying(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem('sfs_admin_token', data.token);
        setIsUnlocked(true);
        setPin('');
      } else {
        setErrorMsg(data.error || 'Invalid Admin Security PIN');
      }
    } catch {
      setErrorMsg('Failed to verify PIN. Please try again.');
    }
    setVerifying(false);
  };

  const handleLock = () => {
    sessionStorage.removeItem('sfs_admin_token');
    setIsUnlocked(false);
    setPin('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center">
        <div className="text-[14px] text-[var(--color-muted)] font-medium">Verifying admin session…</div>
      </div>
    );
  }

  // ─── 🔐 SECONDARY SECURITY PASSCODE GATE ───
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-[420px] w-full shadow-xl border border-[var(--color-line)] flex flex-col gap-6 text-center">
          
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center text-[30px] shadow-sm">
              🛡️
            </div>
            <div>
              <div className="inline-block bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                2-Factor Protected
              </div>
              <h1 className="font-serif text-[22px] font-bold text-[var(--color-ink)]">
                Super Admin Gate
              </h1>
              <p className="text-[13px] text-[var(--color-muted)] mt-1">
                Enter your secondary Master Admin Passcode to unlock the platform management console.
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-4 text-left">
            <div>
              <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1.5">
                Admin Master PIN / Passcode
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter admin passcode"
                  required
                  autoFocus
                  className="w-full px-4 py-3 pr-11 border-[1.5px] border-[var(--color-line)] rounded-xl text-[15px] outline-none font-medium focus:border-[var(--color-teal)] text-[var(--color-ink)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || !pin.trim()}
              className="w-full py-3 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            >
              {verifying ? 'Verifying PIN…' : 'Unlock Admin Console 🔓'}
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--color-line-lt)]">
            <Link
              href="/portal/dashboard"
              className="text-[13px] font-semibold text-[var(--color-slate)] hover:text-[var(--color-teal)] transition-colors inline-flex items-center gap-1.5"
            >
              ← Return to Store Portal
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // ─── UNLOCKED ADMIN CONSOLE ───
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--color-canvas)]">
      {/* Sidebar */}
      <aside className="w-full md:w-[240px] shrink-0 bg-white border-r border-[var(--color-line)] flex flex-col z-20">
        <div className="p-4 sm:p-5 flex items-center justify-between md:justify-start gap-3 border-b border-[var(--color-line-lt)]">
          <div className="flex items-center gap-2.5">
            <SFSLogo size={36} href="/admin/users" />
            <div className="flex flex-col">
              <span className="font-serif text-[15px] font-bold text-[var(--color-ink)] leading-tight">SFS Admin</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded uppercase tracking-wider">Super Console</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible flex-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--color-teal)] text-white shadow-sm'
                    : 'text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="md:mt-auto flex flex-col gap-1.5 pt-2 border-t border-[var(--color-line-lt)]">
            <button
              onClick={handleLock}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer text-left"
            >
              <span>🔒</span>
              <span>Lock Console</span>
            </button>

            <Link
              href="/portal/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] hover:bg-opacity-80 transition-colors whitespace-nowrap"
            >
              <span>🏪</span>
              <span>Back to Portal</span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
