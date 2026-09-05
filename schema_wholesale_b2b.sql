-- ============================================================
-- Safrom B2B Wholesale & Supplier Architecture Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Extend users table for wholesale supplier onboarding & KYC
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_profile JSONB;

-- 2. Ensure role constraint allows 'supplier'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'employee', 'staff', 'admin', 'supplier'));

-- 3. Wholesale Products & Catalogue Table
CREATE TABLE IF NOT EXISTS public.wholesale_products (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  brand             TEXT NOT NULL,
  category          TEXT NOT NULL,
  pack_size         TEXT NOT NULL,
  wholesale_price   NUMERIC(12,2) NOT NULL CHECK (wholesale_price > 0),
  rrp               NUMERIC(12,2) NOT NULL CHECK (rrp >= 0),
  moq_packs         INTEGER NOT NULL DEFAULT 1 CHECK (moq_packs > 0),
  stock_status      TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'pre_order')),
  batch_lot_prefix  TEXT,
  active_deal       TEXT,
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes for Catalogue Filtering
CREATE INDEX IF NOT EXISTS idx_wholesale_products_supplier ON public.wholesale_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_products_category ON public.wholesale_products(category);
CREATE INDEX IF NOT EXISTS idx_wholesale_products_status ON public.wholesale_products(stock_status);

-- 4. Wholesale Orders & Replenishment Pipeline Table
CREATE TABLE IF NOT EXISTS public.wholesale_orders (
  id                    TEXT PRIMARY KEY, -- e.g. PO-20260905-4821
  retailer_store_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  retailer_store_name   TEXT NOT NULL,
  retailer_phone        TEXT,
  supplier_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_name         TEXT NOT NULL,
  corridor              TEXT NOT NULL,
  delivery_landmark     TEXT NOT NULL,
  delivery_day          TEXT NOT NULL,
  items                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
  surcharge             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_method        TEXT NOT NULL,
  payment_ref           TEXT,
  delivery_handover_pin TEXT,
  payment_status        TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'verified')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'packed', 'en_route', 'delivered', 'cancelled')),
  grn_signed            BOOLEAN DEFAULT false,
  grn_signed_at         TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes for Order Dispatch
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_supplier ON public.wholesale_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_retailer ON public.wholesale_orders(retailer_store_id, created_at DESC);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.wholesale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;

-- Product Policies
CREATE POLICY "Suppliers can manage their own wholesale products"
  ON public.wholesale_products
  FOR ALL USING (supplier_id = auth.uid());

CREATE POLICY "Authenticated stores can view available wholesale products"
  ON public.wholesale_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Order Policies
CREATE POLICY "Retailers can view and insert their own purchase orders"
  ON public.wholesale_orders
  FOR ALL USING (retailer_store_id = auth.uid());

CREATE POLICY "Suppliers can view and update orders placed to them"
  ON public.wholesale_orders
  FOR ALL USING (supplier_id = auth.uid());