-- =========================================================================
-- DATABASE MIGRATION: FIX STAFF ROLES, RLS RECURSION, & BRANCH ISOLATION
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =========================================================================

-- 1. Ensure the users role check constraint allows both 'owner' and 'employee'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'employee', 'admin', 'manager'));

-- 2. Create Security Definer functions to prevent RLS infinite recursion
-- These run with admin privileges to safely query public.users without triggering RLS checks recursively.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_name FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_owner_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_store_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role TEXT;
  resolved_owner UUID;
BEGIN
  SELECT role, owner_id INTO current_role, resolved_owner
  FROM public.users
  WHERE id = auth.uid();

  IF current_role = 'employee' THEN
    RETURN resolved_owner;
  ELSE
    RETURN auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_allowed_branch(requested_branch TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role TEXT;
  assigned_branch TEXT;
BEGIN
  SELECT role, branch_name INTO current_role, assigned_branch
  FROM public.users
  WHERE id = auth.uid();

  IF current_role = 'employee' THEN
    RETURN assigned_branch;
  ELSE
    RETURN requested_branch;
  END IF;
END;
$$;

-- 3. Re-define public.users policies (Recursion-free)
DROP POLICY IF EXISTS "Users can read own and owner profile" ON public.users;
DROP POLICY IF EXISTS "Users: view own" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own and owner profile" ON public.users;

CREATE POLICY "Users can read own and owner profile"
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR id = public.get_my_owner_id()
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users: update own" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (id = auth.uid());

-- 4. Re-define public.branch_profiles policies
DROP POLICY IF EXISTS "owner_manage_branch_profiles" ON public.branch_profiles;

CREATE POLICY "owner_manage_branch_profiles" ON public.branch_profiles
  FOR ALL USING (
    owner_id = auth.uid()
    OR owner_id = public.get_my_owner_id()
  );

-- 5. Re-define public.inventory policies with 'employee' checks
DROP POLICY IF EXISTS "Store members can access inventory" ON public.inventory;
CREATE POLICY "Store members can access inventory"
  ON public.inventory
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can insert inventory" ON public.inventory;
CREATE POLICY "Store members can insert inventory"
  ON public.inventory
  FOR INSERT
  WITH CHECK (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can update inventory" ON public.inventory;
CREATE POLICY "Store members can update inventory"
  ON public.inventory
  FOR UPDATE
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can delete inventory" ON public.inventory;
CREATE POLICY "Store members can delete inventory"
  ON public.inventory
  FOR DELETE
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

-- 6. Re-define public.sales policies with 'employee' checks
DROP POLICY IF EXISTS "Store members can access sales" ON public.sales;
CREATE POLICY "Store members can access sales"
  ON public.sales
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can insert sales" ON public.sales;
CREATE POLICY "Store members can insert sales"
  ON public.sales
  FOR INSERT
  WITH CHECK (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

-- 7. Re-define public.expenses policies with 'employee' checks
DROP POLICY IF EXISTS "Store members can access expenses" ON public.expenses;
CREATE POLICY "Store members can access expenses"
  ON public.expenses
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can insert expenses" ON public.expenses;
CREATE POLICY "Store members can insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

-- 8. Re-define public.suppliers policies with 'employee' checks
DROP POLICY IF EXISTS "Store members can access suppliers" ON public.suppliers;
CREATE POLICY "Store members can access suppliers"
  ON public.suppliers
  USING (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

DROP POLICY IF EXISTS "Store members can insert suppliers" ON public.suppliers;
CREATE POLICY "Store members can insert suppliers"
  ON public.suppliers
  FOR INSERT
  WITH CHECK (
    user_id = public.get_store_id()
    AND (
      public.get_my_role() != 'employee'
      OR branch_name = public.get_my_branch()
    )
  );

-- 9. Fix existing user records in case they were registered with role = 'staff'
UPDATE public.users SET role = 'employee' WHERE role = 'staff';
