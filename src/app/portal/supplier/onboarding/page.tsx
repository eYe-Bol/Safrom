'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import ProperCaseInput from '@/components/ProperCaseInput';

type BusinessType = 'distributor' | 'manufacturer' | 'importer' | 'cooperative';

interface CorridorDraft {
  id: string;
  name: string;
  areas: string;
  delivery_days: string[];
  cutoff_time: string;
  surcharge_outside: string;
}

interface FormData {
  company_name: string;
  business_type: BusinessType | '';
  kra_pin: string;
  depot_address: string;
  county: string;
  town: string;
  contact_person: string;
  phone: string;
  website: string;
  brands: string[];
  custom_brand: string;
  business_categories: string[];
  corridors: CorridorDraft[];
  moq_amount: string;
  payment_terms: string;
}

const COUNTIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret / Uasin Gishu','Kiambu',
  'Machakos','Kajiado','Muranga','Nyeri','Meru','Kilifi','Kakamega','Kisii',
  'Bungoma','Siaya','Migori','Homabay','Kericho','Bomet','Nandi','Trans Nzoia',
  'Busia','Vihiga','Laikipia','Nyandarua','Kirinyaga','Embu','Tharaka Nithi',
  'Isiolo','Marsabit','Turkana','West Pokot','Samburu','Elgeyo Marakwet',
  'Baringo','Narok','Taita Taveta','Kwale','Tana River','Lamu','Garissa','Wajir','Mandera',
];

const PRESET_BRANDS = [
  'EABL / Tusker','Brookside Dairy','Kapa Oil (Elianto/Rina)','Unilever (Omo/Sunlight)',
  'Bidco Africa (Cowboy/Malaika)','Britannia','Bakers Inn','Pepsi / Crown Beverages',
  'Coca-Cola / Nairobi Bottlers','Bamburi Cement','ARM Cement','Unga Group (Jogoo/Ndovu)',
  'BAT Kenya','Reckitt (Dettol/Harpic)','Nestle Kenya','Kenmilk / Fresha',
  'Premier Group (Blue Band)','GSK Kenya (Panadol)','Pembe Flour','Carbacid',
];

const CATEGORIES = [
  'FMCG / Beverages','Dairy & Fresh Produce','Household & Personal Care',
  'Pharmaceuticals & OTC','Edible Oils & Fats','Building Materials & Hardware',
  'Electronics & Electrical','Agro-chemicals & Farm Inputs',
  'Animal Feeds & Veterinary','Stationery & Office','Tobacco & Vapes',
  'Spirits & Wines','Cosmetics & Beauty','Textile & Apparel',
];

const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];

const PAYMENT_OPTIONS = [
  { value: 'cod',             label: '100% Pay Before Delivery (Direct M-Pesa Till / Paybill)' },
  { value: 'pod',             label: 'Payment on Delivery (POD - Counter Handover)' },
  { value: 'partial_deposit', label: 'Partial Deposit (50% upfront, 50% on counter offload)' },
  { value: 'credit_7',        label: 'Net 7 Days Credit (verified accounts only)' },
  { value: 'credit_14',       label: 'Net 14 Days Credit (verified accounts only)' },
];

const STEPS = [
  { n: 1, title: 'Business Profile',     icon: '🏭' },
  { n: 2, title: 'Brand Authorizations', icon: '✅' },
  { n: 3, title: 'Delivery Corridors',   icon: '🚚' },
  { n: 4, title: 'Review & Submit',      icon: '🛡️' },
];

const mkCorridor = (): CorridorDraft => ({
  id: Math.random().toString(36).slice(2),
  name: '', areas: '', delivery_days: [], cutoff_time: '17:00', surcharge_outside: '600',
});

export default function SupplierOnboardingPage() {
  const router = useRouter();
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState<FormData>({
    company_name: '', business_type: '', kra_pin: '',
    depot_address: '', county: '', town: '',
    contact_person: '', phone: '', website: '',
    brands: [], custom_brand: '', business_categories: [],
    corridors: [mkCorridor()], moq_amount: '', payment_terms: 'cod',
  });

  const patch = (p: Partial<FormData>) => setForm(prev => ({ ...prev, ...p }));

  const validate = (s: number): string => {
    if (s === 1) {
      if (!form.company_name.trim())   return 'Company name is required.';
      if (!form.business_type)         return 'Please select your business type.';
      if (!form.kra_pin.trim())        return 'KRA PIN is required for verification.';
      if (!form.county)                return 'Please select your county.';
      if (!form.depot_address.trim())  return 'Depot / warehouse address is required.';
      if (!form.contact_person.trim()) return 'Contact person name is required.';
      if (!form.phone.trim())          return 'Phone number is required.';
    }
    if (s === 2) {
      if (!form.brands.length)              return 'Add at least one brand you distribute.';
      if (!form.business_categories.length) return 'Select at least one business category.';
    }
    if (s === 3) {
      if (!form.moq_amount.trim()) return 'Minimum order amount (KES) is required.';
      for (const c of form.corridors) {
        if (!c.name.trim())          return 'Every corridor needs a name.';
        if (!c.areas.trim())         return `Add areas for corridor: ${c.name}`;
        if (!c.delivery_days.length) return `Select delivery days for: ${c.name}`;
      }
    }
    return '';
  };

  const next = () => {
    const e = validate(step);
    if (e) { setError(e); return; }
    setError(''); setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const toggleBrand = (b: string) =>
    patch({ brands: form.brands.includes(b) ? form.brands.filter(x => x !== b) : [...form.brands, b] });
  const addCustom = () => {
    const v = form.custom_brand.trim();
    if (v && !form.brands.includes(v)) patch({ brands: [...form.brands, v], custom_brand: '' });
  };
  const toggleCat = (c: string) =>
    patch({
      business_categories: form.business_categories.includes(c)
        ? form.business_categories.filter(x => x !== c)
        : [...form.business_categories, c],
    });

  const patchC = (id: string, p: Partial<CorridorDraft>) =>
    patch({ corridors: form.corridors.map(c => c.id === id ? { ...c, ...p } : c) });
  const toggleDay = (id: string, day: string) => {
    const c = form.corridors.find(x => x.id === id)!;
    const days = c.delivery_days.includes(day)
      ? c.delivery_days.filter(d => d !== day)
      : [...c.delivery_days, day];
    patchC(id, { delivery_days: days });
  };

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const corridorPayload = form.corridors.map(c => ({
        id: c.id, name: c.name.trim(),
        areas: c.areas.split(',').map(a => a.trim()).filter(Boolean),
        delivery_days: c.delivery_days, cutoff_time: c.cutoff_time,
        min_free_order: parseFloat(form.moq_amount) || 0,
        surcharge_outside: parseFloat(c.surcharge_outside) || 600,
      }));
      const payload = {
        store_name: form.company_name.trim(),
        onboarding_complete: true,
        supplier_profile: {
          business_type: form.business_type,
          kra_pin: form.kra_pin.trim(),
          depot_address: form.depot_address.trim(),
          county: form.county, town: form.town.trim(),
          contact_person: form.contact_person.trim(),
          phone: form.phone.trim(), website: form.website.trim(),
          brands: form.brands,
          business_categories: form.business_categories,
          corridors: corridorPayload,
          moq_amount: parseFloat(form.moq_amount) || 0,
          payment_terms: form.payment_terms,
          verification_status: 'pending_review',
          submitted_at: new Date().toISOString(),
        },
      };
      const { error: dbErr } = await supabase.from('users').update(payload).eq('id', user.id);
      if (dbErr) localStorage.setItem(`sfs_sup_onboarding_${user.id}`, JSON.stringify(payload));
      router.push('/portal/supplier/dashboard?onboarded=1');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inp  = 'w-full py-[9px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--color-teal)]';
  const card = 'bg-white rounded-2xl p-5 border border-[var(--color-line-lt)] shadow-sm';

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] pb-16">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0e3b3e] to-[var(--color-teal)] text-white px-5 py-6">
        <div className="max-w-[680px] mx-auto flex items-center gap-3">
          <span className="text-[28px]">🏭</span>
          <div>
            <h1 className="font-serif text-[20px] font-bold">Wholesale Supplier Registration</h1>
            <p className="text-[12px] text-white/70 mt-0.5">Verified Wholesale Network · Safrom Platform</p>
          </div>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-[var(--color-line)] sticky top-0 z-20 shadow-sm">
        <div className="max-w-[680px] mx-auto px-5 py-3">
          <div className="flex items-center">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
                    step > s.n
                      ? 'bg-emerald-500 text-white'
                      : step === s.n
                        ? 'bg-[var(--color-teal)] text-white shadow-md'
                        : 'bg-[var(--color-canvas)] text-[var(--color-muted)] border-2 border-[var(--color-line)]'
                  }`}>
                    {step > s.n ? '✓' : s.icon}
                  </div>
                  <span className={`text-[10px] font-bold mt-1 text-center leading-tight ${
                    step === s.n ? 'text-[var(--color-teal)]' : 'text-[var(--color-muted)]'
                  }`}>{s.title}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-5 rounded ${step > s.n ? 'bg-emerald-400' : 'bg-[var(--color-line)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[680px] mx-auto px-4 sm:px-5 pt-6 flex flex-col gap-5">

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-800 font-semibold flex gap-2">
            <span className="shrink-0">⚠️</span><span>{error}</span>
          </div>
        )}

        {/* ─── STEP 1 ─── */}
        {step === 1 && (
          <>
            <div className={card}>
              <h2 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-4">🏭 Business Profile</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Company / Business Name *</label>
                  <ProperCaseInput value={form.company_name} onChange={v => patch({ company_name: v })} required className={inp} placeholder="e.g. Metro Beverage Distributors Ltd" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-2">Business Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { v: 'distributor'  as BusinessType, l: 'Distributor',  i: '🚚' },
                      { v: 'manufacturer' as BusinessType, l: 'Manufacturer', i: '🏗️' },
                      { v: 'importer'     as BusinessType, l: 'Importer',     i: '🚢' },
                      { v: 'cooperative'  as BusinessType, l: 'Co-operative', i: '🤝' },
                    ]).map(o => (
                      <button key={o.v} type="button" onClick={() => patch({ business_type: o.v })}
                        className={`py-3 px-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          form.business_type === o.v
                            ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)]'
                            : 'border-[var(--color-line-lt)] text-[var(--color-slate)] hover:border-[var(--color-line)]'
                        }`}>
                        <div className="text-[20px] mb-1">{o.i}</div>
                        <div className="text-[11px] font-bold">{o.l}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">KRA PIN *</label>
                  <input value={form.kra_pin} onChange={e => patch({ kra_pin: e.target.value.toUpperCase() })} placeholder="P0512345678A" maxLength={11} className={`${inp} font-mono`} />
                  <p className="text-[11px] text-[var(--color-muted)] mt-1">Used for KYC only — not shown publicly.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">County *</label>
                    <select value={form.county} onChange={e => patch({ county: e.target.value })} className={`${inp} bg-white`}>
                      <option value="">Select county…</option>
                      {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Town / Area</label>
                    <input value={form.town} onChange={e => patch({ town: e.target.value })} placeholder="e.g. Industrial Area" className={inp} />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Depot / Warehouse Address *</label>
                  <input value={form.depot_address} onChange={e => patch({ depot_address: e.target.value })} placeholder="Plot 15, Lunga Lunga Rd, Industrial Area" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Contact Person *</label>
                    <ProperCaseInput value={form.contact_person} onChange={v => patch({ contact_person: v })} placeholder="e.g. John Kamau" className={inp} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Phone *</label>
                    <input value={form.phone} onChange={e => patch({ phone: e.target.value })} placeholder="0712 345 678" type="tel" className={inp} />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Website <span className="font-normal text-[var(--color-muted)]">(optional)</span></label>
                  <input value={form.website} onChange={e => patch({ website: e.target.value })} placeholder="https://yourcompany.co.ke" type="url" className={inp} />
                </div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 leading-relaxed">
              <strong>🛡️ KYC Notice:</strong> Safrom verifies all wholesale suppliers before they appear publicly. KRA PIN and
              address are cross-checked with the Business Registration Services (BRS) database. Verification takes <strong>1–3 business days</strong>.
            </div>
          </>
        )}

        {/* ─── STEP 2 ─── */}
        {step === 2 && (
          <>
            <div className={card}>
              <h2 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-1">Business Categories *</h2>
              <p className="text-[12px] text-[var(--color-muted)] mb-4">Retailers filter the directory by category. Select all that apply.</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => toggleCat(cat)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
                      form.business_categories.includes(cat)
                        ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]'
                        : 'bg-white text-[var(--color-slate)] border-[var(--color-line)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]'
                    }`}>{cat}</button>
                ))}
              </div>
              {form.business_categories.length > 0 && (
                <p className="mt-3 text-[11px] text-emerald-700 font-semibold">
                  ✓ {form.business_categories.length} categor{form.business_categories.length === 1 ? 'y' : 'ies'} selected
                </p>
              )}
            </div>
            <div className={card}>
              <h2 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-1">Brand Authorizations *</h2>
              <p className="text-[12px] text-[var(--color-muted)] mb-4">Select every brand you are an authorized dealer / distributor for.</p>
              {form.brands.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-[var(--color-teal-bg)] border border-[var(--color-teal)]/20">
                  {form.brands.map(b => (
                    <span key={b} className="flex items-center gap-1 bg-white text-[var(--color-teal)] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[var(--color-teal)]/30">
                      {b}
                      <button type="button" onClick={() => patch({ brands: form.brands.filter(x => x !== b) })} className="text-red-400 hover:text-red-600 cursor-pointer ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {PRESET_BRANDS.filter(b => !form.brands.includes(b)).map(b => (
                  <button key={b} type="button" onClick={() => toggleBrand(b)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-all cursor-pointer">
                    + {b}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={form.custom_brand} onChange={e => patch({ custom_brand: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); }}}
                  placeholder="Add custom brand (e.g. Pembe Flour)" className={`${inp} flex-1`} />
                <button type="button" onClick={addCustom} className="px-4 py-2 bg-[var(--color-teal)] text-white rounded-[8px] text-[12px] font-bold hover:opacity-90 cursor-pointer">Add</button>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-2">ℹ️ Brand authorization letters may be requested during verification.</p>
            </div>
          </>
        )}

        {/* ─── STEP 3 ─── */}
        {step === 3 && (
          <>
            <div className={card}>
              <h2 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-4">Order Policy</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Minimum Order Amount (KES) *</label>
                  <input type="number" value={form.moq_amount} onChange={e => patch({ moq_amount: e.target.value })} placeholder="e.g. 5000" min={0} className={inp} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Payment Terms</label>
                  <select value={form.payment_terms} onChange={e => patch({ payment_terms: e.target.value })} className={`${inp} bg-white`}>
                    {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {form.corridors.map((corridor, idx) => (
              <div key={corridor.id} className={card}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">🚚 Route {idx + 1}</h3>
                  {form.corridors.length > 1 && (
                    <button type="button" onClick={() => patch({ corridors: form.corridors.filter(c => c.id !== corridor.id) })}
                      className="text-[11px] text-red-500 font-bold hover:underline cursor-pointer">Remove</button>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Corridor Name *</label>
                    <input value={corridor.name} onChange={e => patchC(corridor.id, { name: e.target.value })} placeholder="e.g. Nairobi North, Mombasa Coast" className={inp} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Areas Served *</label>
                    <input value={corridor.areas} onChange={e => patchC(corridor.id, { areas: e.target.value })} placeholder="Thika Rd, Kasarani, Roysambu, Ruiru, Githurai" className={inp} />
                    <p className="text-[11px] text-[var(--color-muted)] mt-1">Comma-separated. Retailers match by landmark or road name.</p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-2">Delivery Days *</label>
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map(day => (
                        <button key={day} type="button" onClick={() => toggleDay(corridor.id, day)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border-2 transition-all cursor-pointer ${
                            corridor.delivery_days.includes(day)
                              ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-white'
                              : 'border-[var(--color-line)] text-[var(--color-slate)] hover:border-[var(--color-teal)]'
                          }`}>{day}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Order Cutoff Time</label>
                      <input type="time" value={corridor.cutoff_time} onChange={e => patchC(corridor.id, { cutoff_time: e.target.value })} className={inp} />
                      <p className="text-[11px] text-[var(--color-muted)] mt-1">Cutoff is day before delivery.</p>
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-1">Outside-Corridor Surcharge (KES)</label>
                      <input type="number" value={corridor.surcharge_outside} onChange={e => patchC(corridor.id, { surcharge_outside: e.target.value })} placeholder="600" min={0} className={inp} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => patch({ corridors: [...form.corridors, mkCorridor()] })}
              className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-teal)]/40 text-[var(--color-teal)] text-[13px] font-bold hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-bg)] transition-all cursor-pointer">
              + Add Another Delivery Corridor
            </button>
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[12px] text-blue-900 leading-relaxed">
              <strong>💡 Tip:</strong> Corridors replace radius-based zones. Retailers in your listed areas are auto-matched when
              they sync their location. You can edit corridors anytime from your Supplier Hub.
            </div>
          </>
        )}

        {/* ─── STEP 4 ─── */}
        {step === 4 && (
          <>
            <div className={card}>
              <h2 className="font-serif text-[17px] font-bold text-[var(--color-ink)] mb-4">🛡️ Review Your Application</h2>
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line-lt)]">
                  <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Business Profile</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                    <div><span className="text-[var(--color-muted)]">Company:</span> <strong>{form.company_name}</strong></div>
                    <div><span className="text-[var(--color-muted)]">Type:</span> <strong className="capitalize">{form.business_type}</strong></div>
                    <div><span className="text-[var(--color-muted)]">KRA PIN:</span> <strong className="font-mono">{form.kra_pin}</strong></div>
                    <div><span className="text-[var(--color-muted)]">County:</span> <strong>{form.county}</strong></div>
                    <div className="col-span-2"><span className="text-[var(--color-muted)]">Depot:</span> <strong>{form.depot_address}</strong></div>
                    <div><span className="text-[var(--color-muted)]">Contact:</span> <strong>{form.contact_person}</strong></div>
                    <div><span className="text-[var(--color-muted)]">Phone:</span> <strong>{form.phone}</strong></div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line-lt)]">
                  <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Categories & Brands</div>
                  <p className="text-[12px] mb-2"><span className="text-[var(--color-muted)]">Categories:</span> <strong>{form.business_categories.join(', ')}</strong></p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.brands.map(b => (
                      <span key={b} className="text-[11px] bg-[var(--color-teal-bg)] text-[var(--color-teal)] font-semibold px-2 py-0.5 rounded-full">{b}</span>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-line-lt)]">
                  <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Delivery Corridors ({form.corridors.length})</div>
                  {form.corridors.map((c, i) => (
                    <div key={c.id} className={`text-[12px] ${i > 0 ? 'mt-2 pt-2 border-t border-[var(--color-line-lt)]' : ''}`}>
                      <strong>{c.name || `Route ${i + 1}`}</strong>
                      <span className="text-[var(--color-muted)]"> · {c.delivery_days.join(', ')}</span>
                      <div className="text-[var(--color-slate)] mt-0.5 text-[11px]">{c.areas}</div>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-[var(--color-line-lt)] text-[12px] flex justify-between">
                    <span><span className="text-[var(--color-muted)]">Min Order:</span> <strong>KES {parseInt(form.moq_amount || '0').toLocaleString()}</strong></span>
                    <span><span className="text-[var(--color-muted)]">Payment:</span> <strong>{PAYMENT_OPTIONS.find(o => o.value === form.payment_terms)?.label.split(' (')[0]}</strong></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
              <div className="flex items-start gap-3">
                <span className="text-[24px]">💳</span>
                <div>
                  <div className="font-bold text-[14px] text-amber-900 mb-1">Verified Supplier Listing Fee</div>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    Once approved, a listing fee of <strong>KES 1,000/month</strong> maintains your verified status in the
                    Safrom Wholesale Network. Payment details will be emailed after approval.
                  </p>
                  <p className="text-[11px] text-amber-700 mt-2 font-semibold">✓ First 30 days free during the verification period</p>
                </div>
              </div>
            </div>
            <div className={card}>
              <h3 className="font-bold text-[14px] text-[var(--color-ink)] mb-3">What happens next?</h3>
              <div className="flex flex-col gap-3">
                {[
                  { n: '1', label: 'Application received',        desc: 'Your profile is queued for review by the Safrom team.' },
                  { n: '2', label: 'KYC verification (1–3 days)', desc: 'KRA PIN, BRS registration, and brand authorizations cross-checked.' },
                  { n: '3', label: 'Approval email',              desc: 'You receive confirmation with your verified badge and listing instructions.' },
                  { n: '4', label: 'Go live on the directory',    desc: 'Retailers in your corridors see your profile and can request quotes.' },
                ].map(item => (
                  <div key={item.n} className="flex items-start gap-3 text-[12px]">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-teal-bg)] text-[var(--color-teal)] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">{item.n}</div>
                    <div>
                      <div className="font-bold text-[var(--color-ink)]">{item.label}</div>
                      <div className="text-[var(--color-muted)]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="mt-2 flex gap-3 justify-between">
          {step > 1 ? (
            <button type="button" onClick={back}
              className="px-6 py-3 rounded-xl border-2 border-[var(--color-line)] text-[var(--color-slate)] font-bold text-[13px] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-all cursor-pointer">
              ← Back
            </button>
          ) : <div />}
          {step < 4 ? (
            <button type="button" onClick={next}
              className="px-8 py-3 rounded-xl bg-[var(--color-teal)] text-white font-bold text-[13px] hover:opacity-90 cursor-pointer shadow-sm">
              Continue →
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={loading}
              className="px-8 py-3 rounded-xl bg-[var(--color-gold)] text-white font-bold text-[14px] hover:opacity-90 cursor-pointer shadow-sm disabled:opacity-70 flex items-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Submitting…
                </>
              ) : '🛡️ Submit for Verification'}
            </button>
          )}
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}
