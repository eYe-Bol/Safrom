'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';

const NAV_ITEMS = [
  { href: '/portal/dashboard',  label: 'Dashboard',   icon: '▦' },
  { href: '/portal/inventory',  label: 'Inventory',   icon: '📦' },
  { href: '/portal/sales',      label: 'Sales Log',   icon: '🧮' },
  { href: '/portal/suppliers',  label: 'Suppliers',   icon: '🚚' },
  { href: '/portal/reports',    label: 'Reports',     icon: '📊' },
  { href: '/portal/expenses',   label: 'Expenses',    icon: '💸' },
  { href: '/portal/situation',  label: 'Situation Room', icon: '⚡' },
  { href: '/portal/team',       label: 'Team & Access', icon: '👥' },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeName, setStoreName] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('store_name').eq('id', user.id).single();
        if (data?.store_name) {
          setStoreName(data.store_name);
        }
      }
    };
    fetchUser();
  }, []);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--color-line-lt)] flex items-center justify-start gap-3">
        <SFSLogo size={38} href="/portal/dashboard" />
        <div className="flex flex-col">
          <span className="font-serif text-[15px] font-bold text-[var(--color-ink)] leading-tight">
            {storeName || 'Sales From Scratch'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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

      {/* Bottom: Billing */}
      <div className="p-3 border-t border-[var(--color-line-lt)] flex flex-col gap-2">
        <Link
          href="/portal/billing"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-bold transition-all ${
            pathname === '/portal/billing'
              ? 'bg-[var(--color-gold)] text-white'
              : 'text-[var(--color-gold)] bg-[var(--color-gold-pale)] hover:bg-[var(--color-gold)] hover:text-white'
          }`}
        >
          <span className="text-[14px]">💳</span>
          Subscription
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      {/* Desktop Sidebar */}
      <aside className="w-[220px] shrink-0 bg-white border-r border-[var(--color-line)] hidden md:block fixed top-0 left-0 h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[240px] bg-white shadow-2xl z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[var(--color-line)] flex items-center px-4 h-14 z-30 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col gap-[5px] p-1"
          aria-label="Open menu"
        >
          {[0,1,2].map(i => (
            <span key={i} className="block w-5 h-0.5 bg-[var(--color-teal)] rounded" />
          ))}
        </button>
        <SFSLogo size={28} href="/portal/dashboard" />
        <span className="font-serif text-[15px] font-bold text-[var(--color-ink)] truncate flex-1">
          {storeName || 'Sales From Scratch'}
        </span>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-[220px] flex flex-col min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
