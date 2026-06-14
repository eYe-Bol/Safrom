'use client';

import { Topbar } from '@/components/Topbar';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type InvItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorder_level: number;
  supplier: string;
};

export default function SituationRoomPage() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState('all');
  const [toast, setToast] = useState('');

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from('inventory').select('*').eq('user_id', user.id).order('stock');
      if (data) {
        setItems(data);
        const initQtys: Record<string, number> = {};
        data.forEach(i => { initQtys[i.id] = i.reorder_level || 10; });
        setQtys(initQtys);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const situation = items.map(i => ({
    ...i,
    status: i.stock === 0 ? 'out' : i.stock < i.reorder_level ? 'low' : 'healthy'
  })).filter(i => i.status !== 'healthy');

  const counts = {
    all: situation.length,
    out: situation.filter(i => i.status === 'out').length,
    low: situation.filter(i => i.status === 'low').length,
    expiring: 0 // Mock for now
  };

  const filtered = situation.filter(i => tab === 'all' || i.status === tab);

  const StatusChip = ({ s }: { s: string }) => {
    if (s === 'out') return <span className="bg-[var(--color-red-bg)] text-[var(--color-red)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[var(--color-red)]/20">Out of Stock</span>;
    if (s === 'low') return <span className="bg-[var(--color-amber-bg)] text-[var(--color-amber)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[var(--color-amber)]/20">Low Stock</span>;
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Topbar title="Situation Room" sub="Alerts and auto-generated supplier orders" />
      
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-teal)]">
          {toast}
        </div>
      )}

      <div className="p-5 max-w-[1000px] mx-auto w-full flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[
            {label:"Out of Stock", n:counts.out, color:"#C0392B", bg:"#FDF0EE", note:"Immediate reorder"},
            {label:"Low Stock", n:counts.low, color:"#D97706", bg:"#FFFBEB", note:"Below threshold"},
            {label:"Expiring Soon", n:counts.expiring, color:"#8E44AD", bg:"#F5EEF8", note:"Within 30 days"}
          ].map(x => (
            <div key={x.label} className="rounded-2xl p-4 border" style={{background:x.bg, borderColor:`${x.color}22`}}>
              <div className="font-serif text-[28px] font-bold" style={{color:x.color}}>{x.n}</div>
              <div className="text-[13px] font-bold" style={{color:x.color}}>{x.label}</div>
              <div className="text-[11px] opacity-70 mt-0.5" style={{color:x.color}}>{x.note}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[["all","All Alerts"],["out","Out of Stock"],["low","Low Stock"],["expiring","Expiring"]].map(([id,lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 rounded-lg border-[1.5px] font-semibold text-[13px] cursor-pointer transition-colors ${tab === id ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white' : 'bg-white border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)]'}`}>
              {lbl} ({counts[id as keyof typeof counts]})
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-10 text-[var(--color-slate)] text-[14px]">Loading alerts...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[var(--color-line-lt)]">
              <div className="text-[40px] mb-3">✅</div>
              <h3 className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-1">All clear!</h3>
              <p className="text-[13px] text-[var(--color-muted)]">No critical alerts for this category.</p>
            </div>
          ) : filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 md:p-4 border transition-all" style={{borderColor: item.status === 'out' ? '#C0392B44' : 'var(--color-line-lt)', opacity: sent[item.id] ? 0.6 : 1}}>
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                
                <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr] gap-4 flex-1 w-full">
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-[13px] font-bold text-[var(--color-ink)] mb-1">{item.name}</div>
                    <div className="flex gap-2 items-center">
                      <StatusChip s={item.status} />
                      <span className="text-[11px] text-[var(--color-muted)]">{item.category}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Supplier</div>
                    <div className="text-[12px] font-semibold text-[var(--color-slate)]">{item.supplier || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Stock / Reorder</div>
                    <div className={`text-[12px] font-semibold ${item.stock === 0 ? 'text-[var(--color-red)]' : 'text-[var(--color-slate)]'}`}>
                      {item.stock} / {item.reorder_level} units
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-[var(--color-line-lt)] pt-3 md:pt-0 mt-1 md:mt-0">
                  <div className="flex-1 md:flex-none">
                    <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1 md:hidden">Order Qty</div>
                    <input type="number" min="1" value={qtys[item.id] || ''} onChange={e => setQtys({...qtys, [item.id]: parseInt(e.target.value) || 0})}
                      disabled={!!sent[item.id]}
                      className="w-[72px] px-2 py-1.5 border border-[var(--color-line)] rounded-lg text-[13px] outline-none text-center" />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {sent[item.id] ? (
                      <span className="text-[12px] font-bold text-[var(--color-emerald)] bg-[var(--color-emerald-bg)] px-3.5 py-1.5 rounded-lg border border-[var(--color-emerald)]/20">✓ Sent</span>
                    ) : (
                      <>
                        <button onClick={() => fire(`📄 LPO PDF generated for ${item.name}`)}
                          className="px-3 py-1.5 border-[1.5px] border-[var(--color-line)] rounded-lg bg-[var(--color-canvas)] text-[var(--color-slate)] font-semibold text-[12px] cursor-pointer">
                          📄 LPO
                        </button>
                        <button onClick={() => {
                            setSent({...sent, [item.id]: true});
                            fire(`✓ Order sent to ${item.supplier || 'supplier'} via WhatsApp`);
                          }}
                          className="px-3 py-1.5 bg-[var(--color-teal)] text-white border-none rounded-lg font-bold text-[12px] cursor-pointer shadow-[0_3px_10px_rgba(10,92,107,0.2)] hover:opacity-90">
                          💬 Send Order
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
