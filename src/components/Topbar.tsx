'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { SFSLogo } from '@/components/SFSLogo';

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function Topbar({ title, sub, storeName }: { title: string; sub?: string; storeName?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [user, setUser] = useState<{ initials: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase.from('users').select('role').eq('id', authUser.id).single();
        const name = authUser.user_metadata?.full_name || authUser.email || 'User';
        setUser({ initials: getInitials(name), role: data?.role || 'owner' });
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const dateStr = now?.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }) || '';
  const timeStr = now?.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '';

  return (
    <div className="pt-[14px] px-[16px] pb-[10px] flex justify-between items-center flex-wrap gap-2 border-b border-[var(--color-line-lt)] bg-white">
      <div className="flex items-center gap-3">

        <div className="flex flex-col min-w-0">
          <h1 className="font-serif text-[20px] font-bold text-[var(--color-ink)] tracking-[-0.02em] flex items-center gap-2">
            {storeName ? storeName : title}
            {user && storeName && <span className="text-[10px] font-sans font-bold bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-0.5 rounded-full uppercase tracking-wider">{user.role}</span>}
          </h1>
          <div className="flex items-center gap-3 mt-[1px]">
            <p className="text-[12px] text-[var(--color-muted)]">
              {storeName ? title : sub} {storeName && sub ? `· ${sub}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
        <div className="flex text-[11px] text-[var(--color-slate)] bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-lg px-[10px] py-[4px] font-medium">
          {dateStr}
        </div>
        <div className="flex text-[12px] text-white bg-[var(--color-teal)] rounded-lg px-[11px] py-[5px] font-bold tracking-[0.04em] font-mono min-w-[90px] text-center">
          {timeStr}
        </div>
        <div className="flex items-center gap-[5px]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-emerald)] shadow-[0_0_0_3px_var(--color-emerald-bg)]" />
          <span className="text-[10px] text-[var(--color-muted)] font-bold tracking-[0.06em]">LIVE</span>
        </div>
      </div>
    </div>
  );
}
