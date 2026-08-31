'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SFSLogo } from '@/components/SFSLogo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { href: '/admin/users', label: 'Users & Subscriptions', icon: '👥' },
    { href: '/admin/billing', label: 'Pending Approvals', icon: '💳' },
  ];

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

          <Link
            href="/portal/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] hover:bg-opacity-80 transition-colors md:mt-auto whitespace-nowrap"
          >
            <span>🏪</span>
            <span>Back to Portal</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
