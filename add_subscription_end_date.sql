-- =====================================================
-- Add subscription_end_date to users table
-- Run this in Supabase SQL Editor
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;
