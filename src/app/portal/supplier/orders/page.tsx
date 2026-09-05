'use client';

import { useState, useEffect, useMemo } from 'react';
import { Topbar } from '@/components/Topbar';
import { useStore } from '@/context/StoreContext';
import { WholesaleOrder, OrderStatus } from '@/types/order';
import { createClient } from '@/utils/supabase/client';

const isUUID = (str?: string | null) =>
  !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const INITIAL_MOCK_ORDERS: WholesaleOrder[] = [
  {
    id: 'PO-20260904-4821',
    retailer_store_id: 'store_sunrise_kasarani',
    retailer_store_name: 'Sunrise Mini-Mart',
    retailer_phone: '0722 111 222',
    supplier_id: 'sup_eabl_thika_rd',
    supplier_name: 'Metro Beverage Distributors Ltd',
    corridor: 'Nairobi North Corridor (Thika Rd / Kasarani)',
    delivery_landmark: 'Kasarani (Opposite Shell Petrol Station)',
    delivery_day: 'Tuesday & Friday',
    items: [
      {
        product_id: 'prod_eabl_tusker_crate',
        name: 'Tusker Lager 500ml',
        brand: 'EABL',
        pack_size: 'Crate (25 bottles)',
        unit_price: 4100,
        qty: 8,
        subtotal: 32800,
        batch_no: 'EABL-TUS-2026',
      },
      {
        product_id: 'prod_eabl_guinness_crate',
        name: 'Guinness Foreign Extra Stout 500ml',
        brand: 'EABL',
        pack_size: 'Crate (25 bottles)',
        unit_price: 4650,
        qty: 3,
        subtotal: 13950,
        batch_no: 'EABL-GNS-2026',
      },
    ],
    subtotal: 46750,
    surcharge: 0,
    total_amount: 46750,
    payment_method: 'pay_before_delivery',
    payment_status: 'paid',
    status: 'packed',
    grn_signed: false,
    notes: 'Please offload at side gate before 11:00 AM.',
    created_at: '2026-09-04T08:30:00Z',
    updated_at: '2026-09-04T10:15:00Z',
  },
  {
    id: 'PO-20260903-8812',
    retailer_store_id: 'store_valley_view_roysambu',
    retailer_store_name: 'Valley View Bar & Lounge',
    retailer_phone: '0733 999 888',
    supplier_id: 'sup_eabl_thika_rd',
    supplier_name: 'Metro Beverage Distributors Ltd',
    corridor: 'Nairobi North Corridor (Thika Rd / Kasarani)',
    delivery_landmark: 'Roysambu Lumumba Drive',
    delivery_day: 'Tuesday & Friday',
    items: [
      {
        product_id: 'prod_eabl_tusker_crate',
        name: 'Tusker Lager 500ml',
        brand: 'EABL',
        pack_size: 'Crate (25 bottles)',
        unit_price: 4100,
        qty: 15,
        subtotal: 61500,
        batch_no: 'EABL-TUS-2026',
      },
      {
        product_id: 'prod_eabl_chrome_vodka',
        name: 'Chrome Vodka 250ml',
        brand: 'UDV',
        pack_size: 'Carton (24 bottles)',
        unit_price: 3750,
        qty: 5,
        subtotal: 18750,
        batch_no: 'UDV-CHR-2026',
      },
    ],
    subtotal: 80250,
    surcharge: 0,
    total_amount: 80250,
    payment_method: 'pod',
    payment_status: 'pending',
    status: 'en_route',
    grn_signed: false,
    notes: 'Van salesman to collect M-Pesa Till payment at counter.',
    created_at: '2026-09-03T14:20:00Z',
    updated_at: '2026-09-05T06:00:00Z',
  },
];

export default function SupplierOrdersPage() {
  const { storeId, storeName } = useStore();
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // Load orders: Query Supabase wholesale_orders, falling back to local storage
  useEffect(() => {
    const fetchOrders = async () => {
      let cloudOrders: WholesaleOrder[] = [];
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const effectiveSupplierId = (user?.id && isUUID(user.id)) ? user.id : (storeId && isUUID(storeId) ? storeId : null);

        if (effectiveSupplierId) {
          const { data, error } = await supabase
            .from('wholesale_orders')
            .select('*')
            .eq('supplier_id', effectiveSupplierId)
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            cloudOrders = data as WholesaleOrder[];
          }
        }
      } catch (e) {
        console.warn('Supabase orders fetch fallback:', e);
      }

      // Check local cache
      const key = 'sfs_wholesale_orders';
      const saved = localStorage.getItem(key);
      let localOrders: WholesaleOrder[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localOrders = parsed;
          }
        } catch (e) {
          console.error('Error reading wholesale orders cache:', e);
        }
      }

      // Merge cloud and local orders without duplicates by ID
      if (cloudOrders.length > 0) {
        const mergedMap = new Map<string, WholesaleOrder>();
        cloudOrders.forEach(o => mergedMap.set(o.id, o));
        localOrders.forEach(o => {
          if (!mergedMap.has(o.id)) {
            mergedMap.set(o.id, o);
          }
        });
        const merged = Array.from(mergedMap.values());
        setOrders(merged);
        localStorage.setItem(key, JSON.stringify(merged));
        return;
      }

      if (localOrders.length > 0) {
        setOrders(localOrders);
        return;
      }

      setOrders(INITIAL_MOCK_ORDERS);
      localStorage.setItem(key, JSON.stringify(INITIAL_MOCK_ORDERS));
    };

    fetchOrders();
  }, [storeId]);

  const saveOrders = (updated: WholesaleOrder[]) => {
    setOrders(updated);
    localStorage.setItem('sfs_wholesale_orders', JSON.stringify(updated));
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: newStatus,
          grn_signed: newStatus === 'delivered' ? true : o.grn_signed,
          grn_signed_at: newStatus === 'delivered' ? new Date().toISOString() : o.grn_signed_at,
          payment_status: newStatus === 'delivered' && o.payment_method === 'pod' ? 'paid' : o.payment_status,
          updated_at: new Date().toISOString(),
        };
      }
      return o;
    });
    saveOrders(updated);

    // Sync to Supabase if order exists in cloud
    try {
      const targetOrder = updated.find(o => o.id === orderId);
      if (targetOrder) {
        const supabase = createClient();
        await supabase
          .from('wholesale_orders')
          .update({
            status: newStatus,
            grn_signed: targetOrder.grn_signed,
            grn_signed_at: targetOrder.grn_signed_at,
            payment_status: targetOrder.payment_status,
            updated_at: targetOrder.updated_at,
          })
          .eq('id', orderId);
      }
    } catch (err) {
      console.warn('Supabase status update fallback to local:', err);
    }

    fire(`Order ${orderId} marked as ${newStatus.replace('_', ' ').toUpperCase()}`);
  };

  // Export Route Sheet
  const handleExportRouteSheet = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.setTextColor(10, 92, 107);
        doc.text('VAN DISPATCH & ROUTE DELIVERY MANIFEST', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(`Depot: ${storeName || 'Wholesale Depot'}`, 14, 28);
        doc.text(`Run Date: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 34);

        const activeOrders = orders.filter(o => o.status !== 'cancelled');
        const rows = activeOrders.map((o, idx) => [
          idx + 1,
          o.id,
          o.retailer_store_name,
          o.delivery_landmark,
          `KES ${o.total_amount.toLocaleString()}`,
          o.payment_method.toUpperCase(),
          o.status.toUpperCase(),
        ]);

        autoTable(doc, {
          startY: 42,
          head: [['#', 'PO Number', 'Retail Store', 'Offloading Point', 'Amount', 'Terms', 'Status']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [10, 92, 107] },
          styles: { fontSize: 9, cellPadding: 3.5 },
        });

        doc.save(`Route_Manifest_${new Date().toISOString().split('T')[0]}.pdf`);
        fire('✓ Route Dispatch Sheet downloaded as PDF');
      });
    });
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.retailer_store_name.toLowerCase().includes(search.toLowerCase()) ||
        o.delivery_landmark.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchCorridor = corridorFilter === 'all' || o.corridor.toLowerCase().includes(corridorFilter.toLowerCase());
      return matchSearch && matchStatus && matchCorridor;
    });
  }, [orders, search, statusFilter, corridorFilter]);

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full bg-[var(--color-canvas)]">
      <Topbar
        title="Wholesale Orders & Route Dispatch"
        sub="Review incoming store replenishment orders, pack crates, assign delivery corridors, and manage offloading sign-offs"
      />

      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-[var(--color-ink)] text-white px-4 py-3 rounded-xl text-[13px] font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.22)] border-l-4 border-[var(--color-gold)]">
          {toast}
        </div>
      )}

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-5">
        {/* Top Summary & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-[var(--color-line-lt)] shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-[17px] sm:text-[18px] font-bold text-[var(--color-ink)]">
                Wholesale Order Pipeline
              </h2>
              <span className="text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                {orders.filter(o => o.status === 'pending' || o.status === 'packed').length} Pending Dispatch
              </span>
            </div>
            <p className="text-[11px] sm:text-[12px] text-[var(--color-muted)] mt-0.5">
              Orders placed by connected retail stores in your delivery corridors.
            </p>
          </div>

          <button
            onClick={handleExportRouteSheet}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold text-[13px] rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-2 shrink-0"
          >
            <span>📄</span> Export Route Sheet (PDF)
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-3.5 rounded-xl border border-[var(--color-line-lt)] flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search by PO #, store name, or landmark…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] outline-none focus:border-[var(--color-teal)] w-full sm:flex-1"
          />

          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] font-medium text-[var(--color-ink)] outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="en_route">En Route</option>
              <option value="delivered">Delivered</option>
            </select>

            <select
              value={corridorFilter}
              onChange={e => setCorridorFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-line)] rounded-xl text-[12px] font-medium text-[var(--color-ink)] outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Corridors</option>
              <option value="north">Nairobi North</option>
              <option value="east">Nairobi East</option>
            </select>
          </div>
        </div>

        {/* Orders List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-[var(--color-line-lt)] flex flex-col items-center gap-3">
            <div className="text-[40px]">📑</div>
            <div className="font-serif text-[18px] font-bold text-[var(--color-ink)]">No Orders in this View</div>
            <p className="text-[13px] text-[var(--color-muted)] max-w-md">
              When connected retail shops submit purchase orders via the directory or situation tracker, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => {
              const isExpanded = expandedOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-5 border border-[var(--color-line-lt)] shadow-xs flex flex-col gap-4 hover:border-[var(--color-teal)]/30 transition-colors"
                >
                  {/* Card Header Row */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[var(--color-line-lt)]">
                    <div className="w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-[13px] sm:text-[14px] text-[var(--color-teal)]">
                          {order.id}
                        </span>
                        <span className="text-[10px] font-bold bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line-lt)] px-2 py-0.5 rounded">
                          {new Date(order.created_at).toLocaleDateString('en-KE')}
                        </span>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            order.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'en_route'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'packed'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          ● {order.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="font-serif text-[16px] sm:text-[17px] font-bold text-[var(--color-ink)] mt-1">
                        {order.retailer_store_name}
                      </h3>
                      <div className="text-[11px] sm:text-[12px] text-[var(--color-muted)]">
                        📍 Offload Point: <strong className="text-[var(--color-slate)]">{order.delivery_landmark}</strong> · Corridor:{' '}
                        <span className="font-semibold text-[var(--color-ink)]">{order.corridor.split('(')[0]}</span>
                      </div>
                    </div>

                    {/* Amount & Terms */}
                    <div className="w-full sm:w-auto bg-[var(--color-canvas)] sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end border sm:border-0 border-[var(--color-line-lt)]">
                      <div>
                        <div className="text-[10px] sm:text-[11px] text-[var(--color-muted)] uppercase tracking-wider sm:text-right">Total Value</div>
                        <div className="font-serif text-[18px] sm:text-[20px] font-bold text-[var(--color-teal)] sm:text-right">
                          KES {order.total_amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-[11px] font-medium text-[var(--color-slate)] text-right">
                        <div>{order.payment_method === 'pay_before_delivery' ? '📲 Pay Before' : '🚚 Pay on Delivery'}</div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white sm:bg-[var(--color-canvas)] border border-[var(--color-line-lt)] uppercase">
                          {order.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Preview / Table */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] sm:text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                        Ordered Items ({order.items.reduce((acc, it) => acc + it.qty, 0)} total packs)
                      </span>
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="text-[11px] text-[var(--color-teal)] font-bold hover:underline cursor-pointer py-1 px-2 rounded hover:bg-[var(--color-teal-bg)] transition-colors"
                      >
                        {isExpanded ? 'Hide Line Items ▲' : 'View Line Items ▼'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mb-3">
                        {/* Mobile Card List for Small Screens */}
                        <div className="sm:hidden space-y-2">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="p-3 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-line-lt)] text-[12px]">
                              <div className="flex justify-between items-start gap-2 font-bold text-[var(--color-ink)]">
                                <span>{it.name}</span>
                                <span className="text-[var(--color-teal)] font-mono font-bold shrink-0">
                                  KES {it.subtotal.toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--color-slate)] mt-0.5">
                                Pack: {it.pack_size} · Lot: <span className="font-mono text-[var(--color-muted)]">{it.batch_no || 'Std Lot'}</span>
                              </div>
                              <div className="mt-1 flex justify-between items-center text-[11px] text-[var(--color-muted)] pt-1 border-t border-[var(--color-line-lt)]">
                                <span>Qty: <strong className="text-[var(--color-ink)] text-[12px]">{it.qty}</strong></span>
                                <span className="font-mono">KES {it.unit_price.toLocaleString()} / pack</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table for Tablet & Desktop */}
                        <div className="hidden sm:block bg-[var(--color-canvas)] rounded-xl p-3 border border-[var(--color-line-lt)] overflow-x-auto">
                          <table className="w-full text-left text-[12px]">
                            <thead>
                              <tr className="border-b border-[var(--color-line-lt)] text-[var(--color-muted)] font-bold">
                                <th className="pb-1.5">Product Description</th>
                                <th className="pb-1.5">Pack Size</th>
                                <th className="pb-1.5">Batch / Lot</th>
                                <th className="pb-1.5 text-center">Qty</th>
                                <th className="pb-1.5 text-right">Price</th>
                                <th className="pb-1.5 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-line-lt)]">
                              {order.items.map((it, idx) => (
                                <tr key={idx} className="py-1.5">
                                  <td className="py-1.5 font-bold text-[var(--color-ink)]">{it.name}</td>
                                  <td className="py-1.5 text-[var(--color-slate)]">{it.pack_size}</td>
                                  <td className="py-1.5 font-mono text-[11px] text-[var(--color-muted)]">
                                    {it.batch_no || 'Standard Lot'}
                                  </td>
                                  <td className="py-1.5 text-center font-bold">{it.qty}</td>
                                  <td className="py-1.5 text-right font-mono">KES {it.unit_price.toLocaleString()}</td>
                                  <td className="py-1.5 text-right font-mono font-bold text-[var(--color-teal)]">
                                    KES {it.subtotal.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[12px] text-amber-900">
                      <strong>Delivery Instructions:</strong> {order.notes}
                    </div>
                  )}

                  {/* Actions & Status Pipeline Progression */}
                  <div className="pt-2 border-t border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-[11px] sm:text-[12px] text-[var(--color-muted)]">
                      {order.grn_signed ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          ✓ Goods Received Note (GRN) Signed by Retailer
                        </span>
                      ) : (
                        <span>Awaiting offload verification at store counter</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(order.id, 'confirmed')}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 bg-[var(--color-teal)] text-white font-bold text-[12px] rounded-lg hover:bg-[#104347] transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          Confirm Order
                        </button>
                      )}

                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(order.id, 'packed')}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 bg-purple-700 text-white font-bold text-[12px] rounded-lg hover:bg-purple-800 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          📦 Mark Crates Packed
                        </button>
                      )}

                      {order.status === 'packed' && (
                        <button
                          onClick={() => updateStatus(order.id, 'en_route')}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 bg-blue-600 text-white font-bold text-[12px] rounded-lg hover:bg-blue-700 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          🚚 Dispatch on Run
                        </button>
                      )}

                      {order.status === 'en_route' && (
                        <button
                          onClick={() => updateStatus(order.id, 'delivered')}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 bg-emerald-600 text-white font-bold text-[12px] rounded-lg hover:bg-emerald-700 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          ✓ Confirm Delivery
                        </button>
                      )}

                      <a
                        href={`https://wa.me/${order.retailer_phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-initial text-center justify-center px-3.5 py-2 border border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)] font-bold text-[12px] rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98]"
                      >
                        <span>💬</span> Contact Shop
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
