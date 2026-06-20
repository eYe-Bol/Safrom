-- =========================================================================
-- FIX: Allow owners to read & update their staff profiles
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =========================================================================

-- 1. Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can read own and owner profile" ON public.users;

-- 2. Create a new SELECT policy that covers all cases:
--    a) Users can read their own profile (id = auth.uid())
--    b) Staff can read their owner's profile (id = get_my_owner_id())
--    c) Owners can read their staff profiles (owner_id = auth.uid())
DROP POLICY IF EXISTS "Users can read own, owner, and staff profiles" ON public.users;
CREATE POLICY "Users can read own, owner, and staff profiles"
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR id = public.get_my_owner_id()
    OR owner_id = auth.uid()
  );

-- 3. Drop existing UPDATE policy and replace with one that also allows owners to update staff
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own and staff profiles" ON public.users;

CREATE POLICY "Users can update own and staff profiles"
  ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR owner_id = auth.uid()
  );
