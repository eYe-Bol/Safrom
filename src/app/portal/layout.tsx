'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';
import { StoreProvider, useStore } from '@/context/StoreContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NAV_ITEMS = [
  { href: '/portal/dashboard',   label: 'Dashboard',                    icon: '▦',  ownerOnly: false },
  { href: '/portal/situation',   label: 'Inventory & Expiry Tracker',   icon: '📦', ownerOnly: false },
  { href: '/portal/catalogue',   label: 'Product Catalogue',            icon: '🗂', ownerOnly: false },
  { href: '/portal/suppliers',   label: 'Suppliers',                    icon: '🤝', ownerOnly: false },
  { href: '/portal/expenses',    label: 'Expenses',                     icon: '💸', ownerOnly: false },
  { href: '/portal/reports',     label: 'Reports',                      icon: '📊', ownerOnly: false },
  { href: '/portal/sales',       label: 'Sales Tracker',                icon: '🧮', ownerOnly: false },
  { href: '/portal/staff',       label: 'Staff Manager',                icon: '👥', ownerOnly: true  },
  { href: '/portal/settings',    label: 'Settings',                     icon: '⚙️', ownerOnly: true  },
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

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');
  
  const { storeName, role, isActive, storeId, loading, branchName, scale, branchProfiles } = useStore();

  useEffect(() => {
    // If account is deactivated, force them to the billing page instead of logging them out
    if (isActive === false && !pathname.includes('/billing')) {
      router.push('/portal/billing');
    }
  }, [isActive, pathname, router]);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
        <SFSLogo size={42} href="/portal/dashboard" />
        <div className="flex flex-col">
          <span className="font-serif text-[14px] font-bold text-[var(--color-ink)] leading-tight">
            {scale === 'single' ? storeName : (branchProfiles?.[branchName || 'Main Branch'] || (branchName === 'Main Branch' ? storeName : branchName) || 'Sales From Scratch')}
          </span>
          {role === 'employee' && (
            <span className="text-[10px] font-bold text-[var(--color-slate)] uppercase tracking-wider mt-0.5">Staff Account</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          // Hide ownerOnly routes from staff
          if (role === 'employee' && item.ownerOnly) return null;

          let displayLabel = item.label;
          if (item.href === '/portal/staff' && scale === 'multi') displayLabel = 'Staff & Branches';

          const isActiveNav = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
                isActiveNav
                  ? 'bg-[var(--color-teal)] text-white shadow-[0_4px_12px_rgba(10,92,107,0.25)]'
                  : 'text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)]'
              }`}
            >
              <span className="text-[14px] w-5 text-center shrink-0">{item.icon}</span>
              <span className="truncate">{displayLabel}</span>
            </Link>
          );
        })}

        {role === 'admin' && (
          <Link
            href="/admin/users"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12px] font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-all mt-2 shadow-sm"
          >
            <span className="text-[14px] w-5 text-center shrink-0">👑</span>
            <span className="truncate">Admin Console</span>
          </Link>
        )}
      </nav>

      {/* Bottom: Sign Out */}
      <div className="p-3 border-t border-[var(--color-line-lt)]">
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
    <div className="flex min-h-dvh bg-[var(--color-canvas)]">
      {/* Desktop Sidebar */}
      <aside className="w-[230px] shrink-0 bg-white border-r border-[var(--color-line)] hidden md:block fixed top-0 left-0 h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[250px] bg-white shadow-2xl z-50">
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
        <SFSLogo size={32} href="/portal/dashboard" />
        <span className="font-serif text-[14px] font-bold text-[var(--color-ink)] truncate flex-1">
          {scale === 'single' ? storeName : (branchProfiles?.[branchName || 'Main Branch'] || (branchName === 'Main Branch' ? storeName : branchName) || 'Sales From Scratch')}
        </span>
        {/* Live clock on right - visible on all screens */}
        <div className="flex flex-col items-end shrink-0">
          <LiveClock />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-[230px] flex flex-col min-h-dvh pt-14 md:pt-0">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--color-muted)] text-[14px] overflow-auto">
            Loading...
          </div>
        ) : !storeId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 overflow-auto">
            <div className="text-[48px]">⚠️</div>
            <h2 className="font-serif text-[24px] font-bold text-[var(--color-ink)]">Account Setup Incomplete</h2>
            <p className="text-[15px] text-[var(--color-muted)] max-w-lg">
              Your staff account is missing its profile record. This usually happens if the account creation process was interrupted by database constraints.
              <br /><br />
              <strong>Please ask the store owner to delete this staff account in their settings and recreate it.</strong>
            </p>
          </div>
        ) : (
          <ErrorBoundary>{children}</ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </StoreProvider>
  );
}
