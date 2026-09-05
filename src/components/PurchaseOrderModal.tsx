'use client';

import { useState, useEffect, useMemo } from 'react';
import { VerifiedSupplier, SupplierConnection } from '@/types/supplier';
import { WholesaleProduct, DEFAULT_MOCK_CATALOGUES } from '@/types/catalogue';
import { WholesaleOrder, WholesaleOrderItem, OrderPaymentMethod } from '@/types/order';
import { useStore } from '@/context/StoreContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  supplier: VerifiedSupplier | null;
  connection?: SupplierConnection | null;
  preselectedItemName?: string;
  onOrderCreated?: (order: WholesaleOrder) => void;
}

export default function PurchaseOrderModal({
  isOpen,
  onClose,
  supplier,
  connection,
  preselectedItemName,
  onOrderCreated,
}: Props) {
  const { storeId, storeName } = useStore();
  const [catalogue, setCatalogue] = useState<WholesaleProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('pay_before_delivery');
  const [paymentRef, setPaymentRef] = useState('');
  const [stkPrompting, setStkPrompting] = useState(false);
  const [handoverPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<WholesaleOrder | null>(null);

  // Load supplier catalogue
  useEffect(() => {
    if (!supplier) return;
    const customKey = 'sfs_wholesale_catalogue_' + supplier.id;
    const saved = localStorage.getItem(customKey);
    let items: WholesaleProduct[] = [];
    if (saved) {
      try {
        items = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    if (!items || items.length === 0) {
      items = DEFAULT_MOCK_CATALOGUES[supplier.id] || DEFAULT_MOCK_CATALOGUES['sup_eabl_thika_rd'] || [];
    }
    setCatalogue(items);

    if (preselectedItemName && items.length > 0) {
      const match = items.find(i => i.name.toLowerCase().includes(preselectedItemName.toLowerCase()));
      if (match) {
        setQuantities({ [match.id]: match.moq_packs || 1 });
      }
    } else {
      setQuantities({});
    }

    if (connection?.corridor_matched) {
      const match = supplier.corridors.find(c => c.name.toLowerCase().includes(connection.corridor_matched.toLowerCase()));
      if (match) setSelectedCorridorId(match.id);
    } else if (supplier.corridors.length > 0) {
      setSelectedCorridorId(supplier.corridors[0].id);
    }
    setOrderComplete(null);
    setPaymentRef('');
  }, [supplier, connection, preselectedItemName]);

  // Calculations
  const lineItems: WholesaleOrderItem[] = useMemo(() => {
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = catalogue.find(p => p.id === id);
        if (!prod) return null;
        return {
          product_id: prod.id,
          name: prod.name,
          brand: prod.brand,
          pack_size: prod.pack_size,
          unit_price: prod.wholesale_price,
          qty,
          subtotal: prod.wholesale_price * qty,
          batch_no: prod.batch_lot_prefix,
        };
      })
      .filter(Boolean) as WholesaleOrderItem[];
  }, [quantities, catalogue]);

  const subtotal = useMemo(() => lineItems.reduce((acc, item) => acc + item.subtotal, 0), [lineItems]);
  const activeCorridor = supplier?.corridors.find(c => c.id === selectedCorridorId);
  const isOutsideCorridor = connection ? !connection.is_inside_corridor : false;
  const surcharge = isOutsideCorridor ? (activeCorridor?.surcharge_outside || 600) : 0;
  const totalAmount = subtotal + surcharge;
  const moqRequired = supplier?.moq_amount || 0;
  const moqMet = subtotal >= moqRequired;

  const handleQtyChange = (id: string, delta: number) => {
    const current = quantities[id] || 0;
    const next = Math.max(0, current + delta);
    setQuantities(prev => ({ ...prev, [id]: next }));
  };

  const handleManualQty = (id: string, val: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(0, val) }));
  };

  // Simulate STK Push
  const handleTriggerSTK = () => {
    setStkPrompting(true);
    setTimeout(() => {
      const demoCode = 'SLK' + Math.floor(1000000 + Math.random() * 9000000).toString() + 'X';
      setPaymentRef(demoCode);
      setStkPrompting(false);
    }, 2000);
  };

  // Submit PO
  const handleTransmitPO = () => {
    if (!supplier) return;
    if (lineItems.length === 0) {
      alert('Please add at least one product to your order.');
      return;
    }
    if (!moqMet) {
      alert('This supplier requires a minimum order of KES ' + moqRequired.toLocaleString() + '. Current total is KES ' + subtotal.toLocaleString() + '.');
      return;
    }

    setSubmitting(true);
    const orderId = 'PO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder: WholesaleOrder = {
      id: orderId,
      retailer_store_id: storeId || 'store_current',
      retailer_store_name: storeName || 'My Retail Store',
      retailer_phone: '0712 345 678',
      supplier_id: supplier.id,
      supplier_name: supplier.company_name,
      corridor: activeCorridor?.name || 'General Route',
      delivery_landmark: connection?.synced_landmark || 'Main Branch Counter',
      delivery_day: activeCorridor?.delivery_days.join(' & ') || 'Scheduled Route',
      items: lineItems,
      subtotal,
      surcharge,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_ref: paymentRef || (paymentMethod === 'pay_before_delivery' ? 'PENDING-TILL-VERIFY' : undefined),
      delivery_handover_pin: paymentMethod === 'pod' ? handoverPin : undefined,
      payment_status: paymentRef ? 'paid' : 'pending',
      status: 'pending',
      grn_signed: false,
      notes: orderNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to shared orders storage
    try {
      const ordersKey = 'sfs_wholesale_orders';
      const existing = JSON.parse(localStorage.getItem(ordersKey) || '[]');
      localStorage.setItem(ordersKey, JSON.stringify([newOrder, ...existing]));
    } catch (e) {
      console.error('Error saving order:', e);
    }

    setTimeout(() => {
      setSubmitting(false);
      setOrderComplete(newOrder);
      if (onOrderCreated) onOrderCreated(newOrder);
    }, 500);
  };

  // Generate PDF
  const handleDownloadPDF = () => {
    if (!orderComplete && lineItems.length === 0) return;
    const ord = orderComplete;
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(10, 92, 107);
        doc.text('LOCAL PURCHASE ORDER (LPO)', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text('PO Number: ' + (ord ? ord.id : 'DRAFT'), 14, 28);
        doc.text('Issue Date: ' + new Date().toLocaleDateString('en-KE'), 14, 34);

        // Buyer & Supplier Info
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 40, 182, 28, 3, 3, 'F');

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('BUYER / RETAILER:', 18, 48);
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(storeName || 'Retail Store', 18, 54);
        doc.text('Delivery Point: ' + (connection?.synced_landmark || 'Store Counter'), 18, 60);

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('SUPPLIER / DEPOT:', 110, 48);
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(supplier?.company_name || 'Wholesale Supplier', 110, 54);
        doc.text('Corridor: ' + (activeCorridor?.name?.split('(')[0] || 'Scheduled Route'), 110, 60);

        // Table
        const tableBody = lineItems.map((item, idx) => [
          idx + 1,
          item.name,
          item.pack_size,
          'KES ' + item.unit_price.toLocaleString(),
          item.qty,
          'KES ' + item.subtotal.toLocaleString(),
        ]);

        autoTable(doc, {
          startY: 74,
          head: [['#', 'Item Description', 'Pack Size', 'Unit Price', 'Qty', 'Total (KES)']],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [10, 92, 107] },
          styles: { fontSize: 9, cellPadding: 3.5 },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('Subtotal: KES ' + subtotal.toLocaleString(), 140, finalY);
        if (surcharge > 0) {
          doc.text('Outside Corridor Surcharge: KES ' + surcharge.toLocaleString(), 140, finalY + 6);
        }
        doc.setFontSize(13);
        doc.setTextColor(10, 92, 107);
        doc.text('TOTAL ORDER: KES ' + totalAmount.toLocaleString(), 140, finalY + (surcharge > 0 ? 14 : 8));

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const termsText = paymentMethod === 'pay_before_delivery'
          ? 'M-PESA BUY GOODS TILL (Code: ' + (paymentRef || 'Direct Transfer') + ')'
          : paymentMethod === 'pod'
          ? 'PAYMENT ON DELIVERY (Counter Release PIN: ' + handoverPin + ')'
          : 'DIRECT BANK EFT / RTGS TRANSFER';
        doc.text('Payment Terms: ' + termsText, 14, finalY + 22);
        doc.text('Authorized Safrom Verified B2B Wholesale Document', 14, finalY + 28);

        doc.save('LPO_' + supplier?.company_name.replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf');
      });
    });
  };

  // WhatsApp Dispatch
  const handleWhatsApp = () => {
    if (!supplier) return;
    const phoneClean = supplier.phone.replace(/[^0-9]/g, '');
    let msg = '📄 *LOCAL PURCHASE ORDER (LPO)*\n';
    msg += 'From: *' + (storeName || 'Retail Store') + '*\n';
    msg += 'To: *' + supplier.company_name + '*\n';
    msg += 'Delivery Point: ' + (connection?.synced_landmark || 'Store Counter') + '\n';
    msg += 'Corridor Run: ' + (activeCorridor?.delivery_days.join(' & ') || 'Next Run') + '\n\n';
    msg += '*ORDER ITEMS:*\n';
    lineItems.forEach((it, idx) => {
      msg += (idx + 1) + '. *' + it.name + '* (' + it.pack_size + ') x ' + it.qty + ' = KES ' + it.subtotal.toLocaleString() + '\n';
    });
    msg += '\n*Subtotal:* KES ' + subtotal.toLocaleString() + '\n';
    if (surcharge > 0) msg += '*Outside Surcharge:* KES ' + surcharge.toLocaleString() + '\n';
    msg += '*TOTAL ORDER:* KES ' + totalAmount.toLocaleString() + '\n';
    
    if (paymentMethod === 'pay_before_delivery') {
      msg += '*Payment:* M-PESA BUY GOODS (Till Ref: ' + (paymentRef || 'Paid / Attaching Code') + ')\n';
    } else if (paymentMethod === 'pod') {
      msg += '*Payment:* PAYMENT ON DELIVERY (Counter Handover PIN: ' + handoverPin + ')\n';
    } else {
      msg += '*Payment:* BANK TRANSFER / EFT (Ref: ' + (paymentRef || 'Direct Transfer') + ')\n';
    }

    if (orderNotes) msg += '*Notes:* ' + orderNotes + '\n';
    msg += '\nPlease confirm order receipt, stock allocation, and dispatch schedule.\nThank you!';

    window.open('https://wa.me/' + phoneClean + '?text=' + encodeURIComponent(msg), '_blank');
  };

  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-[780px] shadow-2xl border border-[var(--color-line-lt)] max-h-[92vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-line-lt)] flex justify-between items-start bg-gradient-to-r from-emerald-950 via-[var(--color-teal)] to-slate-900 text-white rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[18px]">🛒</span>
              <h2 className="font-serif text-[18px] sm:text-[20px] font-bold leading-tight">
                Create Purchase Order (PO)
              </h2>
              <span className="text-[10px] font-bold bg-amber-300 text-amber-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                ✓ Verified Supplier
              </span>
            </div>
            <p className="text-[12px] text-white/80">
              Ordering directly from <strong>{supplier.company_name}</strong> · {supplier.town}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-[22px] font-bold p-1 cursor-pointer leading-none"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-[13px]">
          {orderComplete ? (
            /* Order Success View */
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[32px] shadow-xs">
                ✓
              </div>
              <div>
                <h3 className="font-serif text-[22px] font-bold text-[var(--color-ink)]">
                  Purchase Order Transmitted!
                </h3>
                <p className="text-[13px] text-[var(--color-muted)] mt-1">
                  PO Number: <strong className="font-mono text-[var(--color-ink)]">{orderComplete.id}</strong>
                </p>
                <p className="text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mt-3 inline-block">
                  Your order has been queued in <strong>{supplier.company_name}</strong>'s dispatch system for the{' '}
                  <strong>{orderComplete.delivery_day}</strong> route run.
                </p>
              </div>

              {/* Transaction Details Confirmation Card */}
              <div className="w-full max-w-md bg-[var(--color-canvas)] border border-[var(--color-line-lt)] rounded-2xl p-4 text-left text-[12px] space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--color-line-lt)]">
                  <span className="text-[var(--color-muted)]">Total Amount:</span>
                  <strong className="font-serif text-[16px] text-[var(--color-teal)]">
                    KES {orderComplete.total_amount.toLocaleString()}
                  </strong>
                </div>

                {orderComplete.payment_method === 'pay_before_delivery' && (
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-muted)]">M-Pesa Reference:</span>
                    <strong className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {orderComplete.payment_ref || 'Direct Buy Goods Settlement'}
                    </strong>
                  </div>
                )}

                {orderComplete.payment_method === 'pod' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                      Counter Delivery Handover PIN
                    </div>
                    <div className="font-mono text-[24px] font-bold tracking-widest text-center text-amber-900 my-1">
                      {orderComplete.delivery_handover_pin}
                    </div>
                    <div className="text-[11px] text-amber-800 text-center">
                      Give this PIN to the delivery crew only after inspecting all crates at your counter.
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 text-[11px] text-[var(--color-muted)]">
                  <span>Corridor Run:</span>
                  <span className="font-semibold text-[var(--color-ink)]">{orderComplete.delivery_day}</span>
                </div>
              </div>

              {/* Action Buttons for Transmitted Order */}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <button
                  onClick={handleDownloadPDF}
                  className="px-5 py-2.5 bg-[var(--color-teal)] hover:bg-[#104347] text-white font-bold rounded-xl text-[13px] shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>📄</span> Download Official PDF LPO
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-[13px] shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>📲</span> Dispatch via WhatsApp
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 border border-[var(--color-line)] text-[var(--color-slate)] hover:bg-[var(--color-canvas)] font-bold rounded-xl text-[13px] transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Main PO Composer */
            <>
              {/* Corridor & Route Banner */}
              <div className="p-3 bg-[var(--color-canvas)] rounded-2xl border border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[12px]">
                <div>
                  <span className="font-bold text-[var(--color-slate)]">🚚 Delivery Route & Schedule:</span>
                  <div className="text-[var(--color-muted)] mt-0.5">
                    {connection ? (
                      <>
                        Synced Landmark: <strong>{connection.synced_landmark}</strong> ({connection.corridor_matched})
                      </>
                    ) : (
                      'Direct wholesale order'
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-[var(--color-slate)]">Route Run:</label>
                  <select
                    value={selectedCorridorId}
                    onChange={e => setSelectedCorridorId(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-[var(--color-line)] rounded-lg text-[11px] font-bold text-[var(--color-ink)] outline-none"
                  >
                    {supplier.corridors.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name.split('(')[0]} ({c.delivery_days.join(' & ')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Wholesale Products List */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider">
                    Select Wholesale Products
                  </label>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {catalogue.length} items available from this depot
                  </span>
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {catalogue.map(prod => {
                    const qty = quantities[prod.id] || 0;
                    return (
                      <div
                        key={prod.id}
                        className={'p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ' +
                          (qty > 0
                            ? 'bg-emerald-50/50 border-emerald-300'
                            : 'bg-white border-[var(--color-line-lt)] hover:border-[var(--color-line)]')}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line)] px-1.5 py-0.2 rounded">
                              {prod.brand}
                            </span>
                            <span className="font-bold text-[13px] text-[var(--color-ink)]">{prod.name}</span>
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                            📦 {prod.pack_size} · <strong className="text-[var(--color-teal)] font-serif">KES {prod.wholesale_price.toLocaleString()}</strong>/pack
                            {prod.active_deal && (
                              <span className="ml-2 text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.2 rounded text-[10px]">
                                🎁 {prod.active_deal}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Qty Controls */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(prod.id, -1)}
                            className="w-7 h-7 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-line)] font-bold text-[14px] flex items-center justify-center hover:bg-gray-200 cursor-pointer"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={qty}
                            onChange={e => handleManualQty(prod.id, parseInt(e.target.value) || 0)}
                            min={0}
                            className="w-14 text-center py-1 border border-[var(--color-line)] rounded-lg font-mono font-bold text-[13px] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(prod.id, 1)}
                            className="w-7 h-7 rounded-lg bg-[var(--color-teal)] text-white font-bold text-[14px] flex items-center justify-center hover:bg-[#104347] cursor-pointer"
                          >
                            +
                          </button>
                          <span className="text-[11px] text-[var(--color-muted)] w-16 text-right font-mono">
                            {qty > 0 ? 'KES ' + (prod.wholesale_price * qty).toLocaleString() : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Summary & MOQ Progress */}
              <div className="p-3.5 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-line-lt)] space-y-2">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-[var(--color-slate)]">Order Subtotal ({lineItems.length} items):</span>
                  <strong className="font-mono text-[14px]">KES {subtotal.toLocaleString()}</strong>
                </div>

                {surcharge > 0 && (
                  <div className="flex justify-between items-center text-[12px] text-amber-900">
                    <span>Outside Corridor Surcharge:</span>
                    <strong className="font-mono">+ KES {surcharge.toLocaleString()}</strong>
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--color-line-lt)] flex justify-between items-center">
                  <span className="font-bold text-[13px] text-[var(--color-ink)]">Total Order Amount:</span>
                  <strong className="font-serif text-[18px] text-[var(--color-teal)]">
                    KES {totalAmount.toLocaleString()}
                  </strong>
                </div>

                {/* MOQ Progress Bar */}
                <div className="pt-1">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[var(--color-muted)]">
                      Supplier MOQ: <strong>KES {moqRequired.toLocaleString()}</strong>
                    </span>
                    <span className={moqMet ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {moqMet
                        ? '✓ MOQ Requirement Met'
                        : 'Need KES ' + (moqRequired - subtotal).toLocaleString() + ' more'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={'h-full transition-all ' + (moqMet ? 'bg-emerald-500' : 'bg-amber-500')}
                      style={{ width: Math.min(100, (subtotal / (moqRequired || 1)) * 100) + '%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method & Transaction Completion Feature */}
              <div className="bg-white rounded-2xl p-4 border border-[var(--color-line-lt)] shadow-xs">
                <label className="block text-[12px] font-bold text-[var(--color-slate)] mb-2 uppercase tracking-wider">
                  Payment Method & Transaction Completion
                </label>

                {/* 3 Active Payment Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pay_before_delivery')}
                    className={'p-2.5 rounded-xl border text-left transition-all cursor-pointer ' +
                      (paymentMethod === 'pay_before_delivery'
                        ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] shadow-xs ring-1 ring-[var(--color-teal)]'
                        : 'border-[var(--color-line)] bg-[var(--color-canvas)] hover:border-[var(--color-teal)]/50')}
                  >
                    <div className="font-bold text-[12px] text-[var(--color-ink)] flex items-center gap-1">
                      <span>📲</span> M-Pesa Buy Goods
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                      Direct till payment with transaction verification
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pod')}
                    className={'p-2.5 rounded-xl border text-left transition-all cursor-pointer ' +
                      (paymentMethod === 'pod'
                        ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] shadow-xs ring-1 ring-[var(--color-teal)]'
                        : 'border-[var(--color-line)] bg-[var(--color-canvas)] hover:border-[var(--color-teal)]/50')}
                  >
                    <div className="font-bold text-[12px] text-[var(--color-ink)] flex items-center gap-1">
                      <span>🚚</span> Pay on Delivery (POD)
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                      Counter crate inspection with Handover PIN
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={'p-2.5 rounded-xl border text-left transition-all cursor-pointer ' +
                      (paymentMethod === 'bank_transfer'
                        ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] shadow-xs ring-1 ring-[var(--color-teal)]'
                        : 'border-[var(--color-line)] bg-[var(--color-canvas)] hover:border-[var(--color-teal)]/50')}
                  >
                    <div className="font-bold text-[12px] text-[var(--color-ink)] flex items-center gap-1">
                      <span>🏦</span> Bank EFT / Transfer
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                      Direct bank wire for large depot orders
                    </div>
                  </button>
                </div>

                {/* Dynamic Transaction Completion Feature Box */}
                {paymentMethod === 'pay_before_delivery' && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 text-[12px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                          Verified Wholesale Till
                        </span>
                        <span className="font-mono text-[16px] font-bold text-emerald-950">
                          Till No: 849 201
                        </span>
                        <span className="text-[11px] text-emerald-800 block">
                          ({supplier.company_name})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-800 block">Amount to Send:</span>
                        <strong className="font-serif text-[15px] text-emerald-950">
                          KES {totalAmount.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/60 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={e => setPaymentRef(e.target.value.toUpperCase())}
                        placeholder="Enter M-Pesa Code (e.g. SKB94X82LK)"
                        maxLength={12}
                        className="w-full sm:flex-1 py-2 px-3 border border-emerald-300 rounded-lg text-[12px] font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleTriggerSTK}
                        disabled={stkPrompting}
                        className="w-full sm:w-auto px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {stkPrompting ? 'Sending STK Prompt…' : '📲 Request M-Pesa Prompt'}
                      </button>
                    </div>
                    {paymentRef && (
                      <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                        <span>✓</span> M-Pesa confirmation code attached to order receipt.
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'pod' && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-[12px]">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-blue-900">
                        Counter Handover Release Code:
                      </span>
                      <span className="font-mono text-[18px] font-bold bg-white text-blue-950 px-3 py-0.5 rounded-lg border border-blue-300 shadow-xs tracking-wider">
                        {handoverPin}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      💡 <strong>Inspection Policy:</strong> Inspect goods, crates, and batch numbers with the van salesman upon counter arrival.
                      Provide this 4-digit code to the delivery driver to officially sign off and release payment via driver M-Pesa / Cash.
                    </p>
                  </div>
                )}

                {paymentMethod === 'bank_transfer' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[12px]">
                    <div className="flex justify-between text-[11px] text-[var(--color-slate)]">
                      <span>Equity Bank · Industrial Area Branch</span>
                      <span className="font-mono font-bold">A/C: 0110 4829 1029 00</span>
                    </div>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value.toUpperCase())}
                      placeholder="Enter Bank EFT Reference / Slip No."
                      className="w-full py-2 px-3 border border-[var(--color-line)] rounded-lg text-[12px] font-mono bg-white outline-none focus:border-[var(--color-teal)] uppercase"
                    />
                  </div>
                )}
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-slate)] mb-1">
                  Delivery Notes / Counter Gate Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="e.g. Ring phone at main gate, unload through back entrance"
                  className="w-full py-2 px-3 border border-[var(--color-line)] rounded-xl outline-none focus:border-[var(--color-teal)] text-[12px]"
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!orderComplete && (
          <div className="p-4 border-t border-[var(--color-line-lt)] flex flex-col sm:flex-row justify-between items-center gap-3 bg-[var(--color-canvas)] rounded-b-3xl">
            <div className="text-[12px] text-[var(--color-muted)]">
              {moqMet ? (
                <span className="text-emerald-700 font-bold">✓ Ready for dispatch queue</span>
              ) : (
                <span>Add more items to meet supplier MOQ</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 border border-[var(--color-line)] text-[var(--color-slate)] hover:bg-white rounded-xl font-bold text-[12px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransmitPO}
                disabled={submitting || lineItems.length === 0 || !moqMet}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[#b07d10] text-white font-bold rounded-xl text-[13px] shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? 'Transmitting…' : '🚀 Transmit Purchase Order'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
