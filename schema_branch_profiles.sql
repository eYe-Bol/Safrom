-- ============================================================
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add staff_role column to users table (job title like "Cashier", "Store Manager" etc.)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS staff_role TEXT DEFAULT 'Sales Staff';

-- 2. Create branch_profiles table for branch contact info
CREATE TABLE IF NOT EXISTS public.branch_profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_name   TEXT NOT NULL,           -- 'Main Branch', 'Branch 2', 'Branch 3'
  branch_display_name TEXT,              -- Custom label e.g. "Downtown Shop"
  branch_phone  TEXT,
  branch_email  TEXT,
  branch_address TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, branch_name)
);

-- 3. Enable RLS on branch_profiles
ALTER TABLE public.branch_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Owner can read/write their own branch profiles
CREATE POLICY "owner_manage_branch_profiles" ON public.branch_profiles
  FOR ALL USING (
    owner_id = auth.uid()
    OR owner_id IN (
      SELECT owner_id FROM public.users WHERE id = auth.uid() AND role = 'staff'
    )
  );

-- 5. (Optional) Remove the role check constraint if it's blocking valid inserts
-- Only run this if you see "users_role_check" errors:
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'staff'));
