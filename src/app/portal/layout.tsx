'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SFSLogo } from '@/components/SFSLogo';
import { createClient } from '@/utils/supabase/client';

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{ initials: string; role: string; storeName: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('role, store_name').eq('id', user.id).single();
        const name = user.user_metadata?.full_name || user.email || 'User';
        setUserInfo({
          initials: getInitials(name),
          role: data?.role || 'owner',
          storeName: data?.store_name || '',
        });
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
      {/* Logo + User Identity */}
      <div className="p-4 border-b border-[var(--color-line-lt)] flex flex-col items-center gap-2">
        <SFSLogo size={56} href="/" />
        {userInfo && (
          <div className="text-center mt-1">
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[var(--color-teal)] text-white flex items-center justify-center font-bold text-[10px]">
                {userInfo.initials}
              </div>
              <span className="text-[11px] font-bold text-[var(--color-ink)] capitalize">{userInfo.role}</span>
            </div>
            {userInfo.storeName && (
              <div className="text-[10px] text-[var(--color-muted)] mt-0.5 font-medium">{userInfo.storeName}</div>
            )}
          </div>
        )}
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

      {/* Bottom: Billing + Sign Out */}
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
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[var(--color-line)] flex items-center justify-between px-4 h-14 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col gap-[5px] p-1"
          aria-label="Open menu"
        >
          {[0,1,2].map(i => (
            <span key={i} className="block w-5 h-0.5 bg-[var(--color-teal)] rounded" />
          ))}
        </button>
        <SFSLogo size={36} href="/" />
        {userInfo && (
          <div className="w-8 h-8 rounded-full bg-[var(--color-teal)] text-white flex items-center justify-center font-bold text-[12px]">
            {userInfo.initials}
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-[220px] flex flex-col min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
