import Link from 'next/link'
import { SFSBadge } from '@/components/SFSBadge'

export default function LandingPage() {
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
    {name:"Custom", price:"Contact",   desc:"Chains and distributors.",
     feats:["Unlimited branches","Custom integrations","Dedicated onboarding","SLA support"],hi:false},
  ];

  return (
    <div className="bg-[var(--color-canvas)] text-[var(--color-ink)] min-h-screen">
      <nav className="bg-[var(--color-cream)] border-b border-[var(--color-cream-dk)] sticky top-0 z-[100]">
        <div className="max-w-[1080px] mx-auto px-4 h-[60px] flex items-center gap-3">
          <div className="flex items-center gap-2.5 mr-auto shrink-0">
            <SFSBadge size={38}/>
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
            <Link href="/register" className="text-[13px] font-bold text-[var(--color-white)] bg-[var(--color-gold)] border-none rounded-lg px-[18px] py-[8px] cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <section className="bg-[var(--color-teal)] px-5 pt-16 pb-15 relative overflow-hidden">
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
          </div>
        </div>
      </section>

      <section id="features" className="py-17 px-5">
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
                <div className="font-serif text-[15px] font-bold text-[var(--color-ink)] mb-2">
                  {f.title}
                </div>
                <div className="text-[13.5px] text-[var(--color-slate)] leading-[1.7]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-17 px-5 bg-[var(--color-teal)]">
        <div className="max-w-[980px] mx-auto">
          <div className="text-center mb-11">
            <div className="text-[11px] font-bold text-[var(--color-gold-lt)] uppercase tracking-[0.12em] mb-2.5">Pricing</div>
            <h2 className="font-serif text-[clamp(24px,4vw,36px)] font-bold text-white mb-2">Honest pricing. No surprises.</h2>
            <p className="text-[14px] text-white/55">
              All plans include a 7-day free trial.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(255px,1fr))] gap-[18px] items-start">
            {PRICING.map(p=>(
              <div key={p.name} className={`rounded-[18px] p-[26px_22px] relative ${p.hi ? 'bg-[var(--color-gold)] border-none shadow-[0_12px_40px_rgba(201,151,58,0.38)] scale-105 z-10' : 'bg-white/10 border border-white/15'}`}>
                {p.hi && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-ink)] text-white text-[10px] font-extrabold px-[14px] py-[3px] rounded-full tracking-[0.08em] whitespace-nowrap">MOST POPULAR</div>}
                <div className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-2 ${p.hi ? 'text-white/70' : 'text-white/45'}`}>{p.name}</div>
                <div className="mb-2">
                  <span className={`text-[32px] font-bold ${p.hi ? 'text-white' : 'text-white'}`}>KES {p.price}</span>
                  {p.price !== 'Contact' && <span className={`text-[13px] ${p.hi ? 'text-white/70' : 'text-white/45'}`}> /mo</span>}
                </div>
                <div className={`text-[13px] mb-6 ${p.hi ? 'text-white/90' : 'text-white/60'}`}>{p.desc}</div>
                <div className="flex flex-col gap-3 mb-6">
                  {p.feats.map(f=>(
                    <div key={f} className="flex items-start gap-2.5">
                      <span className={`text-[11px] mt-1 ${p.hi ? 'text-[var(--color-ink)]' : 'text-[var(--color-gold-lt)]'}`}>✔</span>
                      <span className={`text-[13px] ${p.hi ? 'text-[var(--color-ink)] font-semibold' : 'text-white/80'}`}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className={`block text-center w-full py-[11px] rounded-[10px] font-bold text-[14px] cursor-pointer transition-opacity hover:opacity-90 ${p.hi ? 'bg-[var(--color-ink)] text-white' : 'bg-white/15 text-white'}`}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Contact Section */}
      <footer className="bg-[var(--color-ink)] pt-16 pb-8 px-5 border-t border-white/10">
        <div className="max-w-[1040px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="font-serif text-[24px] font-bold text-white mb-4">Ready to take control?</h3>
              <p className="text-[14px] text-white/60 leading-[1.7] max-w-[360px] mb-6">
                Sales From Scratch is built for Kenyan businesses that want to grow without the headache of manual stock taking and lost sales.
              </p>
              <Link href="/register" className="inline-block bg-[var(--color-teal)] text-white font-bold py-[12px] px-[24px] rounded-[10px] text-[14px] hover:opacity-90 transition-opacity">
                Start Your 7-Day Free Trial
              </Link>
            </div>
            <div className="flex flex-col gap-5 md:pl-10">
              <h4 className="text-[12px] font-bold text-[var(--color-gold)] uppercase tracking-[0.1em]">Contact Us</h4>
              
              <a href="https://wa.me/254716630073" target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[18px] group-hover:bg-[#25D366] transition-colors">📱</div>
                <div>
                  <div className="text-[11px] text-white/50 uppercase tracking-widest mb-0.5">WhatsApp Support</div>
                  <div className="text-[14px] font-bold text-white group-hover:text-[#25D366] transition-colors">+254 716 630 073</div>
                </div>
              </a>

              <a href="mailto:Salesfromscratch26@gmail.com" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[18px] group-hover:bg-[var(--color-teal)] transition-colors">✉️</div>
                <div>
                  <div className="text-[11px] text-white/50 uppercase tracking-widest mb-0.5">Email Support</div>
                  <div className="text-[14px] font-bold text-white group-hover:text-[var(--color-teal)] transition-colors">Salesfromscratch26@gmail.com</div>
                </div>
              </a>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[12px] text-white/40">
              &copy; {new Date().getFullYear()} Sales From Scratch. All rights reserved.
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-[12px] text-white/40 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-[12px] text-white/40 hover:text-white transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
