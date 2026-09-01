'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';

export function Topbar({ title, sub, storeName: propStoreName }: { title: string; sub?: string; storeName?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const { role, branchName, storeName: contextStoreName, scale, branchProfiles } = useStore();

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now?.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }) || '';
  const timeStr = now?.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '';

  // Get active business / branch name matching what is created in staff & branches
  const activeBranchKey = branchName || 'Main Branch';
  const effectiveStoreName = propStoreName || contextStoreName || 'Sales From Scratch';
  const activeDisplayName = scale === 'single'
    ? effectiveStoreName
    : (branchProfiles?.[activeBranchKey] || (activeBranchKey === 'Main Branch' ? effectiveStoreName : activeBranchKey) || effectiveStoreName);

  return (
    <div className="pt-[14px] px-[16px] pb-[12px] flex justify-between items-center flex-wrap gap-3 border-b border-[var(--color-line-lt)] bg-white">
      <div className="flex items-center gap-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-[20px] font-bold text-[var(--color-ink)] tracking-[-0.02em] leading-tight">
              {title}
            </h1>
            {scale === 'multi' && (
              <span className="text-[11px] font-sans font-bold bg-[var(--color-teal-bg)] text-[var(--color-teal)] border border-[var(--color-teal)]/20 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                📍 {activeDisplayName}
              </span>
            )}
            {role === 'employee' && (
              <span className="text-[10px] font-sans font-bold bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line)] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Staff
              </span>
            )}
          </div>
          {sub && (
            <p className="text-[12px] text-[var(--color-muted)] mt-[2px]">
              {sub}
            </p>
          )}
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

