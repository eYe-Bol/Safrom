'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';

const NAV_ITEMS = [
  { href: '/portal/dashboard',   label: 'Dashboard',          icon: '▦' },
  { href: '/portal/inventory',   label: 'Inventory',          icon: '📦' },
  { href: '/portal/catalogue',   label: 'Product Catalogue',  icon: '🗂' },
  { href: '/portal/suppliers',   label: 'Suppliers',          icon: '🤝' },
  { href: '/portal/situation',   label: 'Situation Room',     icon: '⚡' },
  { href: '/portal/expenses',    label: 'Expenses',           icon: '💸' },
  { href: '/portal/reports',     label: 'Reports',            icon: '📊' },
  { href: '/portal/sales',       label: 'Sales Log',          icon: '🧮' },
  { href: '/portal/settings',    label: 'Settings',           icon: '⚙️' },
];

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="flex flex-col items-end">
      <span className="text-[13px] text-[var(--color-teal)] font-bold font-mono tracking-[0.04em] leading-none">{timeStr}</span>
      <span className="text-[10px] text-[var(--color-muted)] font-medium leading-tight">{dateStr}</span>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeName, setStoreName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('store_name, role').eq('id', user.id).single();
        if (data?.store_name) {
          setStoreName(data.store_name);
        }
        const name = user.user_metadata?.full_name || user.email || 'User';
        setUserName(name);
      }
    };
    fetchUser();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

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

        {/* Bottom: Billing + User Card + Sign Out */}
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
      <div className="md:hidden fixed top-0 left-0 right-0 bg-[var(--color-cream)] border-b border-[var(--color-cream-dk)] flex items-center px-3 h-14 z-30 gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col gap-[5px] p-1 shrink-0"
          aria-label="Open menu"
        >
          {[0,1,2].map(i => (
            <span key={i} className="block w-5 h-0.5 bg-[var(--color-teal)] rounded" />
          ))}
        </button>
        <SFSLogo size={28} href="/portal/dashboard" />
        <span className="font-serif text-[14px] font-bold text-[var(--color-ink)] truncate flex-1">
          {storeName || 'Sales From Scratch'}
        </span>
        {/* Live clock on right */}
        <div className="flex flex-col items-end shrink-0">
          <LiveClock />
        </div>
        {/* Red sign-out avatar */}
        {userName && (
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="w-9 h-9 rounded-full bg-[var(--color-red)] text-white font-bold text-[13px] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(192,57,43,0.4)] hover:opacity-90 transition-opacity"
          >
            {userName[0]?.toUpperCase()}
          </button>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-[220px] flex flex-col min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
