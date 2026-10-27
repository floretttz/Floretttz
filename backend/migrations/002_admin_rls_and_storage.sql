-- FLORETZ Migration 002: Admin RLS Policies, Image URL, and Supabase Storage Rules
-- Run in Supabase SQL Editor or migration tool after configuring project.

-- 1. Ensure image_url column exists on products
alter table products add column if not exists image_url text;

-- 2. Security Definer helper to check roles safely without recursion
create or replace function public.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from role_assignments
    where user_id = auth.uid()
      and (
        role = required_role
        or (required_role = 'catalog_manager' and role = 'admin')
      )
  );
$$;

-- Grant execution to authenticated and anonymous users
grant execute on function public.has_role(text) to authenticated, anon;

-- 3. Administrative RLS Policies for Catalogue Management
drop policy if exists "catalog_managers and admins can insert products" on products;
create policy "catalog_managers and admins can insert products"
  on products for insert
  with check (public.has_role('catalog_manager'));

drop policy if exists "catalog_managers and admins can update products" on products;
create policy "catalog_managers and admins can update products"
  on products for update
  using (public.has_role('catalog_manager'))
  with check (public.has_role('catalog_manager'));

drop policy if exists "admins can delete products" on products;
create policy "admins can delete products"
  on products for delete
  using (public.has_role('admin'));

drop policy if exists "catalog_managers and admins can insert variants" on product_variants;
create policy "catalog_managers and admins can insert variants"
  on product_variants for insert
  with check (public.has_role('catalog_manager'));

drop policy if exists "catalog_managers and admins can update variants" on product_variants;
create policy "catalog_managers and admins can update variants"
  on product_variants for update
  using (public.has_role('catalog_manager'))
  with check (public.has_role('catalog_manager'));

drop policy if exists "catalog_managers and admins can delete variants" on product_variants;
create policy "catalog_managers and admins can delete variants"
  on product_variants for delete
  using (public.has_role('catalog_manager'));

drop policy if exists "catalog_managers and admins can insert categories" on categories;
create policy "catalog_managers and admins can insert categories"
  on categories for insert
  with check (public.has_role('catalog_manager'));

drop policy if exists "catalog_managers and admins can update categories" on categories;
create policy "catalog_managers and admins can update categories"
  on categories for update
  using (public.has_role('catalog_manager'))
  with check (public.has_role('catalog_manager'));

-- 4. Order Management Policies for Admins
drop policy if exists "admins can read all orders" on orders;
create policy "admins can read all orders"
  on orders for select
  using (public.has_role('admin'));

drop policy if exists "admins can update orders" on orders;
create policy "admins can update orders"
  on orders for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "admins can read all order items" on order_items;
create policy "admins can read all order items"
  on order_items for select
  using (public.has_role('admin'));

-- 5. Role Assignment Management Policies for Admins
drop policy if exists "admins can view all role assignments" on role_assignments;
create policy "admins can view all role assignments"
  on role_assignments for select
  using (public.has_role('admin'));

drop policy if exists "admins can insert or update role assignments" on role_assignments;
create policy "admins can insert or update role assignments"
  on role_assignments for insert
  with check (public.has_role('admin'));

drop policy if exists "admins can modify role assignments" on role_assignments;
create policy "admins can modify role assignments"
  on role_assignments for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "admins can delete role assignments" on role_assignments;
create policy "admins can delete role assignments"
  on role_assignments for delete
  using (public.has_role('admin'));

-- 6. Supabase Storage: Product Images Bucket & Security Policies
-- Insert storage bucket if not already created
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB in bytes
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Public read access
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Storage RLS: Staff upload / update / delete access
drop policy if exists "staff can upload product images" on storage.objects;
create policy "staff can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.has_role('catalog_manager')
  );

drop policy if exists "staff can update product images" on storage.objects;
create policy "staff can update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.has_role('catalog_manager')
  );

drop policy if exists "staff can delete product images" on storage.objects;
create policy "staff can delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.has_role('catalog_manager')
  );
