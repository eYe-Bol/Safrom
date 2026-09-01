-- ============================================================
-- Business Type & Price Change Approvals Schema Updates
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure business_type exists on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'retail';

-- 2. Ensure business_type exists on branch_profiles table
ALTER TABLE public.branch_profiles
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'retail';

-- 3. Add pending price approval columns to inventory table
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS pending_sell_price NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_price_staff TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_price_at TIMESTAMPTZ DEFAULT NULL;
