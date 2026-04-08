-- Migration 004: Add display_name to profiles
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
