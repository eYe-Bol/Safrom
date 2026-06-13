'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const NAV_ITEMS = [
  { href: '/portal/dashboard',  label: 'Dashboard',   icon: '▦' },
  { href: '/portal/inventory',  label: 'Inventory',   icon: '📦' },
  { href: '/portal/sales',      label: 'Sales Log',   icon: '🧮' },
  { href: '/portal/reports',    label: 'Reports',     icon: '📊' },
  { href: '/portal/expenses',   label: 'Expenses',    icon: '💸' },
  { href: '/portal/situation',  label: 'Situation Room', icon: '⚡' },
  { href: '/portal/team',       label: 'Team & Access', icon: '👥' },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--color-line-lt)] flex items-center justify-center">
        <span className="font-serif text-[18px] font-bold text-[var(--color-teal)] text-center leading-tight">
          Sales From<br/>Scratch
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
                isActive
                  ? 'bg-[var(--color-teal)] text-white shadow-[0_4px_12px_rgba(10,92,107,0.25)]'
                  : 'text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)]'
              }`}
            >
              <span className="text-[14px] w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Billing + Sign Out */}
      <div className="p-3 border-t border-[var(--color-line-lt)] flex flex-col gap-2">
        <Link
          href="/portal/billing"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-bold transition-all ${
            pathname === '/portal/billing'
              ? 'bg-[var(--color-gold)] text-white'
              : 'text-[var(--color-gold)] bg-[var(--color-gold-pale)] hover:bg-[var(--color-gold)] hover:text-white'
          }`}
        >
          <span className="text-[14px]">💳</span>
          Subscription
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-[10px] bg-[var(--color-red)] text-white font-bold text-[13px] hover:opacity-90 transition-opacity"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      {/* Desktop Sidebar */}
      <aside className="w-[220px] shrink-0 bg-white border-r border-[var(--color-line)] hidden md:block fixed top-0 left-0 h-full z-30">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-[220px] flex flex-col min-h-screen pb-[70px] md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-line-lt)] flex items-center justify-around px-1 h-[60px] z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[
          { href: '/portal/dashboard', icon: '▦', label: 'Dash' },
          { href: '/portal/inventory', icon: '📦', label: 'Stock' },
          { href: '/portal/sales', icon: '🧮', label: 'Sales' },
          { href: '/portal/expenses', icon: '💸', label: 'Costs' },
          { href: '/portal/team', icon: '👥', label: 'Team' },
        ].map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center w-full h-full gap-[3px] transition-colors ${isActive ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)] hover:text-[var(--color-slate)]'}`}>
              <span className={`text-[20px] ${isActive ? 'scale-110 drop-shadow-sm' : ''} transition-transform`}>{item.icon}</span>
              <span className={`text-[9px] font-bold tracking-wide ${isActive ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)]'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
