'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SFSLogo } from '@/components/SFSLogo';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const FEATURES = [
    {icon:"☁️",title:"Real-Time Cloud Sync",   desc:"Every sale and stock update syncs instantly. Check your numbers from home while your cashier runs the till."},
    {icon:"⚡",title:"The Situation Room",      desc:"Auto-generated supplier orders for anything running low. Review, adjust, and send in one tap."},
    {icon:"📦",title:"Product Catalogue",       desc:"Manage your full product list with selling prices, cost prices, and reorder levels — searchable instantly."},
    {icon:"🤝",title:"Supplier Profiles",       desc:"Store every supplier's WhatsApp, email, and terms. Send LPOs directly without digging for contacts."},
    {icon:"📊",title:"Automated Sales Tracking",desc:"Enter closing stock at shift end. Units sold and revenue are calculated and logged automatically."},
    {icon:"🔐",title:"Role-Based Access",       desc:"Owners see everything. Cashiers see only what they need. Your profit figures stay private."},
  ];
  
  const PRICING = [
    {name:"Starter",price:"999",  desc:"One location. Up to 3 staff.",
     feats:["1 branch","Up to 3 users","Inventory & sales","Situation Room","Email support"],hi:false},
    {name:"Pro",    price:"1,499",desc:"Multiple locations, bigger team.",
     feats:["Up to 3 branches","Unlimited users","Everything in Starter","Auto LPO generation","WhatsApp sharing","Priority support"],hi:true},
    {name:"Custom", price:null,   desc:"Chains and distributors.",
     feats:["Unlimited branches","Custom integrations","Dedicated onboarding","SLA support"],hi:false},
  ];

  const FAQS = [
    {q:"Does this app work offline?",            a:"Sales From Scratch is a real-time, cloud-synced platform. A basic mobile data or Wi-Fi connection is all you need."},
    {q:"How does automated sales tracking work?", a:"At shift end, enter your closing stock and wastage. The system calculates units sold and logs revenue automatically."},
    {q:"Can my cashiers see my profits?",         a:"No. Employees get a restricted view — they log inventory and check the Situation Room. Your Dashboard and Reports are hidden."},
    {q:"What happens when my trial ends?",        a:"You'll be prompted to pick a plan to keep adding data. Everything you've entered stays safe and accessible."},
    {q:"Can I manage multiple locations?",        a:"Yes. The Pro plan supports up to 3 branches, each with its own inventory and reports, under one master login."},
  ];

  return (
    <div className="bg-[var(--color-canvas)] text-[var(--color-ink)] min-h-screen">
      {/* ── NAV ── */}
      <nav className="bg-[var(--color-cream)] border-b border-[var(--color-cream-dk)] sticky top-0 z-[100]">
        <div className="max-w-[1080px] mx-auto px-4 h-[60px] flex items-center gap-3">
          <div className="flex items-center gap-2.5 mr-auto shrink-0">
            <SFSLogo size={32} />
            <span className="font-serif text-[17px] font-bold text-[var(--color-teal)] whitespace-nowrap">
              Sales From Scratch
            </span>
          </div>

          <div className="hidden md:flex gap-[22px]">
            {["Features","Pricing","FAQ"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-[14px] font-medium text-[var(--color-slate)] hover:text-[var(--color-teal)] transition-colors">
                {l}
              </a>
            ))}
          </div>

          <div className="hidden md:flex gap-2 items-center ml-3.5">
            <Link href="/login" className="text-[13px] font-semibold text-[var(--color-teal)] bg-transparent border-[1.5px] border-[var(--color-teal)] rounded-lg px-[14px] py-[7px] cursor-pointer hover:bg-[var(--color-teal-bg)] transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="text-[13px] font-bold text-white bg-[var(--color-gold)] border-none rounded-lg px-[18px] py-[8px] cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity">
              Get started
            </Link>
          </div>
          
          {/* Hamburger — animates into X when open */}
          <button className="md:hidden flex flex-col gap-[5px] p-2 ml-auto" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span className="block w-6 h-0.5 bg-[var(--color-teal)] rounded transition-all duration-200"
              style={{transform: mobileMenuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none'}} />
            <span className="block w-6 h-0.5 bg-[var(--color-teal)] rounded transition-all duration-200"
              style={{opacity: mobileMenuOpen ? 0 : 1}} />
            <span className="block w-6 h-0.5 bg-[var(--color-teal)] rounded transition-all duration-200"
              style={{transform: mobileMenuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none'}} />
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[var(--color-cream)] border-t border-[var(--color-cream-dk)] pb-4">
            {["Features","Pricing","FAQ"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                className="block px-5 py-3 text-[15px] font-medium text-[var(--color-ink)] border-b border-[var(--color-cream-dk)]">
                {l}
              </a>
            ))}
            <div className="flex flex-col gap-2.5 px-4 pt-3">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}
                className="text-center text-[14px] font-bold text-[var(--color-teal)] border-[1.5px] border-[var(--color-teal)] py-2.5 rounded-lg">
                Sign In
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}
                className="text-center text-[14px] font-bold text-white bg-[var(--color-gold)] py-2.5 rounded-lg">
                Get started — 7-day free trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="bg-[var(--color-teal)] px-5 pt-16 pb-16 relative overflow-hidden">
        <div className="absolute -right-15 -top-15 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="max-w-[600px] mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 mb-6">
            <span className="text-[13px]">✦</span>
            <span className="text-[11px] font-bold text-white/90 uppercase tracking-[0.1em]">
              One platform for every small business
            </span>
          </div>
          <h1 className="font-serif text-[clamp(34px,7vw,56px)] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-5">
            Stock. Sales.<br/>
            <em className="text-[var(--color-gold)] not-italic">Profits you can see.</em>
          </h1>
          <p className="text-[clamp(15px,2.5vw,17px)] text-white/70 leading-[1.75] max-w-[490px] mx-auto mb-9">
            Sales From Scratch gives you a real-time view of what's selling, what's running low,
            and what you're actually making — all from your phone.
          </p>
          <div className="flex flex-col gap-3 items-stretch max-w-[320px] mx-auto">
            <Link href="/register" className="flex items-center justify-center gap-2.5 bg-[var(--color-gold)] text-white border-none py-[15px] px-[28px] rounded-full font-bold text-[16px] cursor-pointer shadow-[0_4px_20px_rgba(201,151,58,0.45)] hover:opacity-90 transition-opacity">
              💬 Start 7-Day Free Trial
            </Link>
            <a href="tel:+254716630073" className="flex items-center justify-center gap-2.5 bg-white/10 text-white py-[15px] px-[28px] rounded-full font-semibold text-[16px] border border-white/25 hover:bg-white/20 transition-colors">
              📞 Call Now
            </a>
          </div>
          <div className="mt-7 flex gap-4 justify-center flex-wrap">
            {["🛡 Secure cloud backup","📱 Works on any phone","7 days free — no card"].map(t => (
              <span key={t} className="text-[12px] text-white/50 font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR STRIP ── */}
      <div className="bg-[var(--color-cream)] border-b border-[var(--color-cream-dk)] py-3.5 px-5">
        <div className="max-w-[900px] mx-auto flex gap-2.5 items-center justify-center flex-wrap">
          <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">Built for</span>
          {["🍺 Pubs","💊 Chemists","🛒 Retail","✂️ Salons","🍽️ Restaurants","📦 Distributors"].map(t => (
            <span key={t} className="text-[12px] text-[var(--color-slate)] bg-[var(--color-canvas)] px-3 py-1 rounded-full border border-[var(--color-line)] font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className="py-[68px] px-5">
        <div className="max-w-[1040px] mx-auto">
          <div className="text-center mb-11">
            <div className="text-[11px] font-bold text-[var(--color-gold)] uppercase tracking-[0.12em] mb-2.5">What You Get</div>
            <h2 className="font-serif text-[clamp(24px,4vw,36px)] font-bold text-[var(--color-ink)]">
              Everything your business needs.<br/>
              <em className="text-[var(--color-teal)] not-italic">Nothing it doesn't.</em>
            </h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[18px]">
            {FEATURES.map(f=>(
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[var(--color-line-lt)] shadow-[0_1px_6px_rgba(10,92,107,0.05)]">
                <div className="text-[26px] mb-3">{f.icon}</div>
                <div className="font-serif text-[15px] font-bold text-[var(--color-ink)] mb-2">{f.title}</div>
                <div className="text-[13.5px] text-[var(--color-slate)] leading-[1.7]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-[68px] px-5 bg-[var(--color-teal)]">
        <div className="max-w-[980px] mx-auto">
          <div className="text-center mb-11">
            <div className="text-[11px] font-bold text-[var(--color-gold-lt)] uppercase tracking-[0.12em] mb-2.5">Pricing</div>
            <h2 className="font-serif text-[clamp(24px,4vw,36px)] font-bold text-white mb-2">Honest pricing. No surprises.</h2>
            <p className="text-[14px] text-white/55">All plans include a 7-day free trial.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(255px,1fr))] gap-[18px] items-start">
            {PRICING.map(p=>(
              <div key={p.name} className={`rounded-[18px] p-[26px_22px] relative ${p.hi ? 'bg-[var(--color-gold)] border-none shadow-[0_12px_40px_rgba(201,151,58,0.38)] scale-105 z-10' : 'bg-white/10 border border-white/15'}`}>
                {p.hi && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-ink)] text-white text-[10px] font-extrabold px-[14px] py-[3px] rounded-full tracking-[0.08em] whitespace-nowrap">MOST POPULAR</div>}
                <div className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-2 ${p.hi ? 'text-white/70' : 'text-white/45'}`}>{p.name}</div>
                <div className="mb-2">
                  {p.price
                    ? <><span className="font-serif text-[40px] font-bold text-white tracking-[-0.03em]">{p.price}</span><span className="text-[13px] text-white/55 ml-1">KES/mo</span></>
                    : <span className="font-serif text-[28px] font-bold text-white">Talk to us</span>
                  }
                </div>
                <p className="text-[13px] text-white/65 mb-4 leading-[1.6]">{p.desc}</p>
                <div className="border-t border-white/18 pt-3.5 mb-4 flex flex-col gap-1.5">
                  {p.feats.map(f=>(
                    <div key={f} className="flex gap-2 items-start">
                      <span className="text-white text-[12px] shrink-0">✓</span>
                      <span className="text-[13px] text-white/85">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className={`block text-center w-full py-[11px] rounded-[10px] font-bold text-[14px] cursor-pointer transition-opacity hover:opacity-90 ${p.hi ? 'bg-[var(--color-ink)] text-white' : 'bg-white/15 text-white'}`}>
                  {p.price ? 'Start Free Trial' : 'Contact Sales'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-[68px] px-5">
        <div className="max-w-[660px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-bold text-[var(--color-gold)] uppercase tracking-[0.12em] mb-2.5">FAQ</div>
            <h2 className="font-serif text-[clamp(22px,4vw,34px)] font-bold text-[var(--color-ink)]">Questions? Answered.</h2>
          </div>
          <div className="flex flex-col gap-1">
            {FAQS.map((f,i) => (
              <div key={i} className={`border-[1.5px] rounded-xl overflow-hidden transition-colors ${faqOpen === i ? 'border-[var(--color-teal)]' : 'border-[var(--color-line)]'}`}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className={`w-full px-[18px] py-[15px] flex justify-between items-center gap-3 border-none cursor-pointer text-left transition-colors ${faqOpen === i ? 'bg-[var(--color-teal-bg)]' : 'bg-white'}`}
                >
                  <span className="text-[14px] font-semibold text-[var(--color-ink)] leading-[1.4]">{f.q}</span>
                  <span className="text-[var(--color-teal)] text-[20px] shrink-0 leading-none">{faqOpen === i ? '−' : '+'}</span>
                </button>
                {faqOpen === i && (
                  <div className="px-[18px] pb-4 bg-[var(--color-teal-bg)]">
                    <p className="text-[14px] text-[var(--color-slate)] leading-[1.75]">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-[60px] px-5 bg-[var(--color-teal-dk,#074452)] text-center">
        <div className="max-w-[520px] mx-auto">
          <h2 className="font-serif text-[clamp(24px,4vw,36px)] font-bold text-white mb-3.5 leading-[1.15]">
            Your business.<br/><em className="text-[var(--color-gold)] not-italic">Under control.</em>
          </h2>
          <p className="text-[15px] text-white/55 mb-6 leading-[1.7]">Know your numbers — every shift, every day.</p>
          <div className="flex flex-col gap-2.5 items-stretch max-w-[280px] mx-auto">
            <Link href="/register" className="bg-[var(--color-gold)] text-white border-none py-3.5 px-7 rounded-full font-bold text-[15px] text-center hover:opacity-90 transition-opacity">
              Start Free Trial →
            </Link>
            <a href="https://wa.me/254716630073" target="_blank" rel="noreferrer"
              className="bg-white/10 text-white py-3.5 px-7 rounded-full font-semibold text-[15px] border border-white/22 text-center hover:bg-white/20 transition-colors">
              💬 WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[var(--color-ink)] pt-9 pb-6 px-5">
        <div className="max-w-[1040px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 mb-7">
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <SFSLogo size={28} />
                <span className="font-serif text-[15px] font-bold text-white">Sales From Scratch</span>
              </div>
              <p className="text-[13px] text-[var(--color-muted)] leading-[1.7] max-w-[200px]">
                Cloud-synced business management for Kenyan small businesses.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-3">Product</div>
              {["Features","Pricing","FAQ"].map(l => (
                <div key={l} className="mb-1.5">
                  <a href={`#${l.toLowerCase()}`} className="text-[13px] text-[var(--color-muted)] hover:text-white transition-colors">{l}</a>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-3">Contact</div>
              <div className="text-[13px] text-[var(--color-muted)] mb-1.5">📧 Salesfromscratch26@gmail.com</div>
              <div className="text-[13px] text-[var(--color-muted)]">📱 +254 716 630 073</div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 flex flex-col md:flex-row justify-between items-center gap-2 text-[12px] text-[var(--color-muted)]">
            <span>© {new Date().getFullYear()} Sales From Scratch. All rights reserved.</span>
            <span>Made for Kenyan businesses 🇰🇪</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
