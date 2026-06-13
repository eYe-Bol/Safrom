import Link from 'next/link';
import { SFSBadge } from '@/components/SFSBadge';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <aside className="w-[230px] shrink-0 bg-white border-r border-[var(--color-line)] hidden md:flex flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-[var(--color-line-lt)]">
          <SFSBadge size={32} />
          <span className="font-serif text-[15px] font-bold text-[var(--color-teal)]">SFS Admin</span>
        </div>
        <nav className="p-4 flex flex-col gap-2 flex-1">
          <Link href="/admin/billing" className="px-3 py-2 rounded-lg text-[14px] font-semibold text-[var(--color-slate)] hover:bg-[var(--color-teal-bg)] hover:text-[var(--color-teal)] transition-colors">
            Subscriptions
          </Link>
          <Link href="/portal/dashboard" className="px-3 py-2 rounded-lg text-[14px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] hover:bg-opacity-80 transition-colors mt-auto block text-center">
            Back to Portal
          </Link>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
