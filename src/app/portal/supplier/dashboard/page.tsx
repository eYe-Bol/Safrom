'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { useStore } from '@/context/StoreContext';
import Link from 'next/link';

export default function SupplierDashboardPage() {
  const { storeName } = useStore();
  const [toast, setToast] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('onboarded') === '1') {
      setToast('🎉 Application submitted! Our team will review your profile within 1–3 business days.');
      setTimeout(() => setToast(''), 7000);
      router.replace('/portal/supplier/dashboard');
    }
  }, [searchParams, router]);

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Supplier Command Center" sub="Manage wholesale dispatch, delivery corridors, and connected retail stores" />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-5">
        {/* Verification Status Banner */}
        <div className="bg-gradient-to-r from-[#0e3b3e] to-[var(--color-teal)] text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-[24px]">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-[18px] font-bold">
                  {storeName || 'Metro Wholesale Depot'}
                </h2>
                <span className="text-[10px] font-bold bg-amber-300 text-amber-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ✓ Verified Supplier
                </span>
              </div>
              <p className="text-[12px] text-white/80 mt-0.5">
                Authorized Manufacturer Agent · Tier-1 Wholesale Distributor · Active on Safrom Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fire('Wholesale Catalogue editor opening…')}
              className="px-4 py-2 bg-white text-[var(--color-teal)] font-bold text-[12px] rounded-xl shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Manage Catalogue
            </button>
            <button
              onClick={() => fire('Active Trade Promotions modal opening…')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-[12px] rounded-xl transition-colors cursor-pointer border border-white/20"
            >
              Post Trade Deal
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-[var(--color-line-lt)] shadow-xs">
            <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
              Connected Retail Stores
            </div>
            <div className="font-serif text-[24px] font-bold text-[var(--color-ink)]">
              24 <span className="text-[12px] font-sans font-normal text-emerald-600 font-semibold">+3 this week</span>
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-1">Geo-synced to your corridors</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[var(--color-line-lt)] shadow-xs">
            <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
              Active Delivery Corridors
            </div>
            <div className="font-serif text-[24px] font-bold text-[var(--color-ink)]">
              2 <span className="text-[12px] font-sans font-normal text-[var(--color-teal)] font-semibold">Corridors</span>
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-1">Nairobi North & East</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[var(--color-line-lt)] shadow-xs">
            <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
              Supplier Reliability Score
            </div>
            <div className="font-serif text-[24px] font-bold text-[var(--color-ink)]">
              4.9 ★
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-1">Based on 1,420 delivery sign-offs</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[var(--color-line-lt)] shadow-xs">
            <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
              Active Trade Deals
            </div>
            <div className="font-serif text-[24px] font-bold text-[var(--color-teal)]">
              1 Deal Active
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-1">Buy 25 Crates → 1 Free</div>
          </div>
        </div>

        {/* Two-Column Grid: Delivery Corridors + Connected Stores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Active Delivery Corridors & Schedules */}
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                    🚚 Active Route Corridors
                  </h3>
                  <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                    Fixed delivery schedules for connected retail shops
                  </p>
                </div>
                <span className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2.5 py-1 rounded-lg">
                  2 Active Routes
                </span>
              </div>

              <div className="space-y-3 mt-4">
                <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line)]">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[13px] text-[var(--color-ink)]">
                      Nairobi North Corridor
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Tuesdays & Fridays
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-slate)] mb-2">
                    Thika Superhighway · Roysambu · Kasarani · Ruiru · Githurai · Juja
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] flex justify-between border-t border-[var(--color-line-lt)] pt-1.5">
                    <span>Order Cutoff: <strong>17:00 (Previous Day)</strong></span>
                    <span>Free Delivery: <strong>Orders &gt; KES 15,000</strong></span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line)]">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[13px] text-[var(--color-ink)]">
                      Nairobi East Corridor
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Mondays & Thursdays
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-slate)] mb-2">
                    Jogoo Road · Eastleigh · Buruburu · Umoja · Donholm · Embakasi
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] flex justify-between border-t border-[var(--color-line-lt)] pt-1.5">
                    <span>Order Cutoff: <strong>16:30 (Previous Day)</strong></span>
                    <span>Free Delivery: <strong>Orders &gt; KES 20,000</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--color-line-lt)] flex justify-between items-center text-[12px]">
              <span className="text-[var(--color-muted)]">Outside-Corridor Surcharge: <strong>KES 600 flat</strong></span>
              <button
                onClick={() => fire('Corridor management settings opening…')}
                className="text-[var(--color-teal)] font-bold hover:underline cursor-pointer"
              >
                + Add Another Corridor
              </button>
            </div>
          </div>

          {/* Card 2: Connected Retail Stores */}
          <div className="bg-white rounded-xl p-5 border border-[var(--color-line-lt)] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">
                    🏪 Synced Retail Stores
                  </h3>
                  <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                    Stores connected to your routes ready for replenishment
                  </p>
                </div>
                <Link
                  href="/portal/suppliers"
                  className="text-[11px] font-bold text-[var(--color-teal)] bg-[var(--color-teal-bg)] px-2.5 py-1 rounded-lg hover:opacity-80"
                >
                  View Directory
                </Link>
              </div>

              <div className="space-y-2 mt-4 max-h-[260px] overflow-y-auto pr-1">
                {[
                  { name: 'Sunrise Mini-Mart', area: 'Kasarani (opp. Shell)', corridor: 'Nairobi North', days: 'Tue / Fri', date: 'Yesterday' },
                  { name: 'Valley View Bar & Lounge', area: 'Roysambu Lumumba Dr', corridor: 'Nairobi North', days: 'Tue / Fri', date: '2 days ago' },
                  { name: 'Eastleigh Central Store', area: '1st Avenue Section 2', corridor: 'Nairobi East', days: 'Mon / Thu', date: '3 days ago' },
                  { name: 'Donholm Family Grocers', area: 'Donholm Phase 5', corridor: 'Nairobi East', days: 'Mon / Thu', date: '1 week ago' },
                ].map((st, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line-lt)] flex justify-between items-center">
                    <div>
                      <div className="font-bold text-[13px] text-[var(--color-ink)]">
                        {st.name}
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        📍 {st.area} · <span className="font-semibold text-[var(--color-slate)]">{st.corridor}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold bg-white text-[var(--color-teal)] border border-[var(--color-teal)]/20 px-2 py-0.5 rounded-md">
                        {st.days}
                      </span>
                      <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{st.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--color-line-lt)] flex justify-between items-center text-[12px]">
              <span className="text-[var(--color-muted)]">All stores pre-verified for route offloading</span>
              <button
                onClick={() => fire('Exporting route delivery sheet…')}
                className="text-[var(--color-teal)] font-bold hover:underline cursor-pointer"
              >
                📄 Export Route Sheet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
