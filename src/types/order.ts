'use client';

export type OrderPaymentMethod = 'pay_before_delivery' | 'pod' | 'bank_transfer' | 'net_7' | 'net_14';
export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'en_route' | 'delivered' | 'cancelled';

export type WholesaleOrderItem = {
  product_id: string;
  name: string;
  brand: string;
  pack_size: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  batch_no?: string;
};

export type WholesaleOrder = {
  id: string; // PO-YYYYMMDD-XXXX
  retailer_store_id: string;
  retailer_store_name: string;
  retailer_phone: string;
  supplier_id: string;
  supplier_name: string;
  corridor: string;
  delivery_landmark: string;
  delivery_day: string;
  items: WholesaleOrderItem[];
  subtotal: number;
  surcharge: number;
  total_amount: number;
  payment_method: OrderPaymentMethod;
  payment_ref?: string; // M-Pesa transaction code or Bank EFT ref
  delivery_handover_pin?: string; // 4-digit counter release PIN for POD
  payment_status: 'pending' | 'paid' | 'verified';
  status: OrderStatus;
  grn_signed: boolean;
  grn_signed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};
