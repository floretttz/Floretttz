-- FLORETTTZ Migration 003: Payment Verification Audit Fields and Order Status Update
-- Run in Supabase SQL Editor or migration tool after configuring project.

-- 1. Add payment audit columns to orders table
alter table orders add column if not exists payment_screenshot_url text;
alter table orders add column if not exists payment_verified_by text;
alter table orders add column if not exists payment_verified_at timestamptz;

-- 2. Update status constraint to include 'pending_verification'
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (
  status in (
    'pending',
    'pending_verification',
    'awaiting_confirmation',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  )
);
